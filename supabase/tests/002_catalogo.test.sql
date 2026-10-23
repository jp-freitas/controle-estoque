-- spec-002 T-11: view catalogo (RF-10, RF-11; CA-05, CA-10)
-- Item de tipo/local desativado não existe ativo (RN-03, testado em 002_item.test.sql),
-- então a visibilidade depende só de item.ativo.
begin;
create extension if not exists pgtap with schema extensions;
select plan(13);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0206-0000000000a1', 't-admin@teste.test'),
  ('00000000-0000-0000-0206-0000000000b1', 't-ativo@teste.test'),
  ('00000000-0000-0000-0206-0000000000c1', 't-pendente@teste.test');
insert into public.profiles (id, nome, email, perfil, status) values
  ('00000000-0000-0000-0206-0000000000a1', 'Admin', 't-admin@teste.test', 'admin', 'ativo'),
  ('00000000-0000-0000-0206-0000000000b1', 'Ativo', 't-ativo@teste.test', 'solicitante', 'ativo'),
  ('00000000-0000-0000-0206-0000000000c1', 'Pendente', 't-pendente@teste.test', 'solicitante', 'pendente');
insert into public.local (id, nome) values ('00000000-0000-0000-0206-00000000f001', 'T-Lab');
insert into public.item (id, nome, tipo_id, local_id, quantidade_total) values
  ('00000000-0000-0000-0206-00000000e001', 'T-Multímetro', (select id from public.tipo_item where nome = 'Ferramenta'),
   '00000000-0000-0000-0206-00000000f001', 10),
  ('00000000-0000-0000-0206-00000000e002', 'T-Osciloscópio', (select id from public.tipo_item where nome = 'Máquina'),
   '00000000-0000-0000-0206-00000000f001', 1),
  ('00000000-0000-0000-0206-00000000e003', 'T-Antigo', (select id from public.tipo_item where nome = 'Ferramenta'),
   '00000000-0000-0000-0206-00000000f001', 2);
update public.item set quantidade_reservada = 3, quantidade_em_uso = 2 where id = '00000000-0000-0000-0206-00000000e001';
update public.item set operante = false where id = '00000000-0000-0000-0206-00000000e002';
update public.item set ativo = false where id = '00000000-0000-0000-0206-00000000e003';

create function pg_temp.como(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;

select has_view('public', 'catalogo', 'RF-10: view catalogo existe');
select ok((select 'security_invoker=true' = any(reloptions) from pg_class where oid = 'public.catalogo'::regclass),
  'catalogo respeita a RLS (security_invoker)');

set local role authenticated;
select pg_temp.como('00000000-0000-0000-0206-0000000000b1');

select is((select disponivel from public.catalogo where nome = 'T-Multímetro'), 5,
  'RF-11: disponível = total − reservada − em_uso');
select results_eq($$ select tipo_nome, local_nome, consumivel from public.catalogo where nome = 'T-Multímetro' $$,
  $$ values ('Ferramenta', 'T-Lab', false) $$, 'RF-10: catálogo traz tipo e local');
select is((select operante from public.catalogo where nome = 'T-Osciloscópio'), false,
  'CA-05: inoperante aparece para o professor, sinalizado');
select is_empty($$ select 1 from public.catalogo where nome = 'T-Antigo' $$,
  'CA-10: desativado não aparece no catálogo do professor');
select is_empty($$ select 1 from public.item where nome = 'T-Antigo' $$,
  'CA-10: nem pela API direta na tabela');
select is((select count(*)::int from public.catalogo where nome like 'T-%'), 2, 'professor vê os 2 itens ativos');

select pg_temp.como('00000000-0000-0000-0206-0000000000c1');
select is_empty($$ select 1 from public.catalogo $$, 'pendente não vê o catálogo');

select pg_temp.como('00000000-0000-0000-0206-0000000000a1');
select is((select ativo from public.catalogo where nome = 'T-Antigo'), false,
  'CA-10: admin vê o desativado (o front filtra "incluir desativados")');
select is((select count(*)::int from public.catalogo where nome like 'T-%'), 3, 'admin vê os 3 itens');

reset role;
set local role anon;
select throws_ok($$ select 1 from public.catalogo $$, '42501', null, 'anon não lê o catálogo');
reset role;
select ok(not has_table_privilege('authenticated', 'public.catalogo', 'insert'), 'catálogo é só leitura');

select * from finish();
rollback;
