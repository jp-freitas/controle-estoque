-- spec-003 T-06: cancelar_solicitacao (RF-09; CA-05, CA-06, CA-07, CA-08)
begin;
create extension if not exists pgtap with schema extensions;
select plan(14);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0304-0000000000a1', 't-admin@teste.test'),
  ('00000000-0000-0000-0304-0000000000b1', 't-ana@teste.test'),
  ('00000000-0000-0000-0304-0000000000b2', 't-beto@teste.test');
insert into public.profiles (id, nome, email, perfil, status) values
  ('00000000-0000-0000-0304-0000000000a1', 'Admin', 't-admin@teste.test', 'admin', 'ativo'),
  ('00000000-0000-0000-0304-0000000000b1', 'Ana', 't-ana@teste.test', 'solicitante', 'ativo'),
  ('00000000-0000-0000-0304-0000000000b2', 'Beto', 't-beto@teste.test', 'solicitante', 'ativo');
insert into public.local (id, nome) values ('00000000-0000-0000-0304-00000000f001', 'T-Sala');
insert into public.item (id, nome, tipo_id, local_id, quantidade_total) values
  ('00000000-0000-0000-0304-00000000e001', 'T-Lupa', (select id from public.tipo_item where nome = 'Ferramenta'),
   '00000000-0000-0000-0304-00000000f001', 5);
-- A 004 ainda não existe: os status são montados direto (tasks T-06)
insert into public.solicitacao (id, solicitante_id, justificativa, status) values
  ('00000000-0000-0000-0304-00000000d001', '00000000-0000-0000-0304-0000000000b1', 'Pendente', 'pendente'),
  ('00000000-0000-0000-0304-00000000d002', '00000000-0000-0000-0304-0000000000b1', 'Aprovada', 'aprovada'),
  ('00000000-0000-0000-0304-00000000d003', '00000000-0000-0000-0304-0000000000b1', 'Retirada', 'retirada'),
  ('00000000-0000-0000-0304-00000000d004', '00000000-0000-0000-0304-0000000000b1', 'Recusada', 'recusada'),
  ('00000000-0000-0000-0304-00000000d005', '00000000-0000-0000-0304-0000000000b2', 'Do Beto', 'pendente'),
  ('00000000-0000-0000-0304-00000000d006', '00000000-0000-0000-0304-0000000000b1', 'Concluída', 'concluida');
insert into public.solicitacao_item (solicitacao_id, item_id, item_nome, quantidade_solicitada) values
  ('00000000-0000-0000-0304-00000000d001', '00000000-0000-0000-0304-00000000e001', 'T-Lupa', 2);

create function pg_temp.como(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;
create function pg_temp.status(p_id uuid) returns text language sql as $$
  select status::text from public.solicitacao where id = p_id;
$$;

set local role authenticated;
select pg_temp.como('00000000-0000-0000-0304-0000000000b1');

-- CA-05 -------------------------------------------------------------------------
select is((public.cancelar_solicitacao('00000000-0000-0000-0304-00000000d001')).status,
  'cancelada'::public.status_solicitacao, 'CA-05: dono cancela pendente');
select ok((select cancelado_em is not null from public.solicitacao where id = '00000000-0000-0000-0304-00000000d001'),
  'CA-05: registra quando foi cancelada');
select results_eq($$ select quantidade_total, quantidade_reservada, quantidade_em_uso from public.item
  where id = '00000000-0000-0000-0304-00000000e001' $$, $$ values (5, 0, 0) $$, 'CA-05: nenhum contador muda');
select throws_ok($$ select public.cancelar_solicitacao('00000000-0000-0000-0304-00000000d001') $$,
  'P0001', 'Solicitação já cancelada.', 'cancelar de novo é rejeitado');

-- CA-06 -------------------------------------------------------------------------
select throws_ok($$ select public.cancelar_solicitacao('00000000-0000-0000-0304-00000000d002') $$,
  'P0001', 'Solicitação já aprovada; peça ao administrador para cancelar.', 'CA-06: aprovada não é cancelada pelo solicitante');
select throws_ok($$ select public.cancelar_solicitacao('00000000-0000-0000-0304-00000000d003') $$,
  'P0001', 'Solicitação já retirada; não pode mais ser cancelada.', 'CA-06: retirada não é cancelada');
select throws_ok($$ select public.cancelar_solicitacao('00000000-0000-0000-0304-00000000d006') $$,
  'P0001', 'Solicitação já retirada; não pode mais ser cancelada.', 'CA-06: concluída não é cancelada');
select throws_ok($$ select public.cancelar_solicitacao('00000000-0000-0000-0304-00000000d004') $$,
  'P0001', 'Solicitação recusada; não pode ser cancelada.', 'recusada não é cancelada');
select is(pg_temp.status('00000000-0000-0000-0304-00000000d002'), 'aprovada', 'CA-06: aprovada continua aprovada');

-- Só o dono --------------------------------------------------------------------------
select throws_ok($$ select public.cancelar_solicitacao('00000000-0000-0000-0304-00000000d005') $$,
  'P0001', 'Solicitação não encontrada.', 'CA-07: Ana não cancela a do Beto');
select pg_temp.como('00000000-0000-0000-0304-0000000000a1');
select throws_ok($$ select public.cancelar_solicitacao('00000000-0000-0000-0304-00000000d005') $$,
  'P0001', 'Solicitação não encontrada.', 'admin não usa o fluxo do solicitante para cancelar a de outro (spec-004/RF-10)');
select is(pg_temp.status('00000000-0000-0000-0304-00000000d005'), 'pendente', 'a do Beto continua pendente');

-- CA-08 ------------------------------------------------------------------------------
reset role;
update public.profiles set status = 'inativo' where id = '00000000-0000-0000-0304-0000000000b2';
set local role authenticated;
select pg_temp.como('00000000-0000-0000-0304-0000000000b2');
select throws_ok($$ select public.cancelar_solicitacao('00000000-0000-0000-0304-00000000d005') $$,
  'P0001', 'Seu acesso não permite cancelar solicitações.', 'CA-08: inativo não cancela');
reset role;
set local role anon;
select throws_ok($$ select public.cancelar_solicitacao('00000000-0000-0000-0304-00000000d005') $$,
  '42501', null, 'anon não executa');

select * from finish();
rollback;
