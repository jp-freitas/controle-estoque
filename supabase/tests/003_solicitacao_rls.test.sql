-- spec-003 T-02: RLS de solicitacao e solicitacao_item (RF-10, RF-11; CA-07, CA-08)
begin;
create extension if not exists pgtap with schema extensions;
select plan(17);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0302-0000000000a1', 't-admin@teste.test'),
  ('00000000-0000-0000-0302-0000000000b1', 't-ana@teste.test'),
  ('00000000-0000-0000-0302-0000000000b2', 't-beto@teste.test'),
  ('00000000-0000-0000-0302-0000000000d1', 't-inativo@teste.test');
insert into public.profiles (id, nome, email, perfil, status) values
  ('00000000-0000-0000-0302-0000000000a1', 'Admin', 't-admin@teste.test', 'admin', 'ativo'),
  ('00000000-0000-0000-0302-0000000000b1', 'Ana', 't-ana@teste.test', 'solicitante', 'ativo'),
  ('00000000-0000-0000-0302-0000000000b2', 'Beto', 't-beto@teste.test', 'solicitante', 'ativo'),
  ('00000000-0000-0000-0302-0000000000d1', 'Inativo', 't-inativo@teste.test', 'solicitante', 'ativo');
insert into public.local (id, nome) values ('00000000-0000-0000-0302-00000000f001', 'T-Sala');
insert into public.item (id, nome, tipo_id, local_id, quantidade_total) values
  ('00000000-0000-0000-0302-00000000e001', 'T-Compasso', (select id from public.tipo_item where nome = 'Ferramenta'),
   '00000000-0000-0000-0302-00000000f001', 5);
insert into public.solicitacao (id, solicitante_id, justificativa) values
  ('00000000-0000-0000-0302-00000000d0a1', '00000000-0000-0000-0302-0000000000b1', 'Aula da Ana'),
  ('00000000-0000-0000-0302-00000000d0b1', '00000000-0000-0000-0302-0000000000b2', 'Aula do Beto'),
  ('00000000-0000-0000-0302-00000000d0d1', '00000000-0000-0000-0302-0000000000d1', 'Aula antiga');
insert into public.solicitacao_item (solicitacao_id, item_id, item_nome, quantidade_solicitada) values
  ('00000000-0000-0000-0302-00000000d0a1', '00000000-0000-0000-0302-00000000e001', 'T-Compasso', 1),
  ('00000000-0000-0000-0302-00000000d0b1', '00000000-0000-0000-0302-00000000e001', 'T-Compasso', 2),
  ('00000000-0000-0000-0302-00000000d0d1', '00000000-0000-0000-0302-00000000e001', 'T-Compasso', 1);
update public.profiles set status = 'inativo' where id = '00000000-0000-0000-0302-0000000000d1';

create function pg_temp.como(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;

set local role authenticated;

-- CA-07: cada professor só vê as próprias ----------------------------------------
select pg_temp.como('00000000-0000-0000-0302-0000000000b1');
select results_eq($$ select justificativa from public.solicitacao $$, $$ values ('Aula da Ana') $$,
  'CA-07: Ana só vê a própria solicitação');
select is((select count(*)::int from public.solicitacao_item), 1, 'CA-07: Ana só vê as próprias linhas');
select is_empty($$ select 1 from public.solicitacao where id = '00000000-0000-0000-0302-00000000d0b1' $$,
  'CA-07: Ana não lê a do Beto nem pelo id');
select is_empty($$ select 1 from public.solicitacao_item where solicitacao_id = '00000000-0000-0000-0302-00000000d0b1' $$,
  'CA-07: Ana não lê as linhas do Beto');

-- RF-11: nada de escrita direta ----------------------------------------------------
select throws_ok($$ insert into public.solicitacao (solicitante_id, justificativa)
  values ('00000000-0000-0000-0302-0000000000b1', 'Direto') $$, '42501', null, 'RF-11: insert direto negado');
select throws_ok($$ update public.solicitacao set status = 'aprovada' $$, '42501', null,
  'RF-11: update direto negado (aprovar a si mesma)');
select throws_ok($$ delete from public.solicitacao $$, '42501', null, 'delete direto negado');
select throws_ok($$ insert into public.solicitacao_item (solicitacao_id, item_id, item_nome, quantidade_solicitada)
  values ('00000000-0000-0000-0302-00000000d0a1', '00000000-0000-0000-0302-00000000e001', 'x', 9) $$,
  '42501', null, 'RF-11: insert direto de linha negado');
select throws_ok($$ update public.solicitacao_item set quantidade_solicitada = 9 $$, '42501', null,
  'RF-11: editar quantidade direto negado');

-- RF-10: admin vê todas, mas também não escreve direto ---------------------------------
select pg_temp.como('00000000-0000-0000-0302-0000000000a1');
select is((select count(*)::int from public.solicitacao where justificativa like 'Aula%'), 3, 'RF-10: admin vê todas');
select is((select count(*)::int from public.solicitacao_item where item_nome = 'T-Compasso'), 3, 'RF-10: admin vê todas as linhas');
select throws_ok($$ update public.solicitacao set status = 'aprovada' $$, '42501', null,
  'admin também não muda status direto (só RPC)');

-- CA-08: inativo não vê nem as próprias ------------------------------------------------
select pg_temp.como('00000000-0000-0000-0302-0000000000d1');
select is_empty($$ select 1 from public.solicitacao $$, 'CA-08: inativo não lê solicitações');
select is_empty($$ select 1 from public.solicitacao_item $$, 'CA-08: inativo não lê linhas');

-- anon ------------------------------------------------------------------------------
reset role;
set local role anon;
select throws_ok($$ select 1 from public.solicitacao $$, '42501', null, 'anon não lê solicitações');
select throws_ok($$ select 1 from public.solicitacao_item $$, '42501', null, 'anon não lê linhas');
reset role;
select is((select status from public.solicitacao where id = '00000000-0000-0000-0302-00000000d0a1'),
  'pendente'::public.status_solicitacao, 'tentativas negadas não mudaram nada');

select * from finish();
rollback;
