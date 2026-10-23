-- spec-001 T-07: RLS de profiles (CA-02, CA-07, RF-04, RF-09; constituição P-02)
begin;
create extension if not exists pgtap with schema extensions;
select plan(19);

-- Fixtures ------------------------------------------------------------------
insert into auth.users (id, email) values
  ('00000000-0000-0000-0001-0000000000a1', 't-admin@teste.test'),
  ('00000000-0000-0000-0001-0000000000b1', 't-ativo@teste.test'),
  ('00000000-0000-0000-0001-0000000000c1', 't-pendente@teste.test'),
  ('00000000-0000-0000-0001-0000000000d1', 't-inativo@teste.test'),
  ('00000000-0000-0000-0001-0000000000e1', 't-semperfil@teste.test');
insert into public.profiles (id, nome, email, perfil, status) values
  ('00000000-0000-0000-0001-0000000000a1', 'Admin', 't-admin@teste.test', 'admin', 'ativo'),
  ('00000000-0000-0000-0001-0000000000b1', 'Ativo', 't-ativo@teste.test', 'solicitante', 'ativo'),
  ('00000000-0000-0000-0001-0000000000c1', 'Pendente', 't-pendente@teste.test', 'solicitante', 'pendente'),
  ('00000000-0000-0000-0001-0000000000d1', 'Inativo', 't-inativo@teste.test', 'solicitante', 'inativo');

create function pg_temp.como(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;

select count(*) as total from public.profiles \gset

-- Leitura -------------------------------------------------------------------
set local role authenticated;

select pg_temp.como('00000000-0000-0000-0001-0000000000c1');
select results_eq(
  'select id from public.profiles',
  $$ values ('00000000-0000-0000-0001-0000000000c1'::uuid) $$,
  'CA-02 / RF-04: pendente lê só o próprio profiles');
select is((select count(*) from public.auditoria), 0::bigint, 'CA-02: pendente não lê auditoria');

select pg_temp.como('00000000-0000-0000-0001-0000000000d1');
select results_eq(
  'select id from public.profiles',
  $$ values ('00000000-0000-0000-0001-0000000000d1'::uuid) $$,
  'RF-04: inativo lê só o próprio profiles (para a tela "acesso desativado")');

select pg_temp.como('00000000-0000-0000-0001-0000000000b1');
select results_eq(
  'select id from public.profiles',
  $$ values ('00000000-0000-0000-0001-0000000000b1'::uuid) $$,
  'solicitante ativo lê só o próprio perfil');

select pg_temp.como('00000000-0000-0000-0001-0000000000e1');
select is_empty('select id from public.profiles',
  'usuário autenticado sem profiles (convite não aceito) não lê nada');

select pg_temp.como('00000000-0000-0000-0001-0000000000a1');
select is((select count(*) from public.profiles), :'total'::bigint, 'RF-09: admin ativo lê todos os profiles');

reset role;
update public.profiles set perfil = 'admin' where id = '00000000-0000-0000-0001-0000000000c1';
update public.profiles set perfil = 'admin' where id = '00000000-0000-0000-0001-0000000000d1';
set local role authenticated;

select pg_temp.como('00000000-0000-0000-0001-0000000000c1');
select is((select count(*) from public.profiles), 1::bigint, 'RN-04: admin pendente não lê os outros');
select pg_temp.como('00000000-0000-0000-0001-0000000000d1');
select is((select count(*) from public.profiles), 1::bigint, 'admin inativo não lê os outros');
reset role;

set local role anon;
select throws_ok('select id from public.profiles', '42501', null, 'anon não lê profiles (sem privilégio)');
reset role;

-- Escrita direta: negada para todos; só por RPC (RF-05, RF-06, CA-04, CA-07) --
set local role authenticated;

select pg_temp.como('00000000-0000-0000-0001-0000000000b1');
select throws_ok(
  $$ update public.profiles set perfil = 'admin' where id = '00000000-0000-0000-0001-0000000000b1' $$,
  '42501', null, 'CA-04: solicitante não se promove por update direto');
select throws_ok(
  $$ update public.profiles set nome = 'X' where id = '00000000-0000-0000-0001-0000000000b1' $$,
  '42501', null, 'RF-15: nem o próprio nome por update direto (só por RPC)');
select throws_ok(
  $$ insert into public.profiles (id, nome, email) values ('00000000-0000-0000-0001-0000000000e1', 'X', 't-semperfil@teste.test') $$,
  '42501', null, 'RF-03: usuário não cria o próprio profiles por insert direto');
select throws_ok(
  $$ delete from public.profiles where id = '00000000-0000-0000-0001-0000000000b1' $$,
  '42501', null, 'solicitante não apaga profiles');

select pg_temp.como('00000000-0000-0000-0001-0000000000d1');
select throws_ok(
  $$ update public.profiles set status = 'ativo' where id = '00000000-0000-0000-0001-0000000000d1' $$,
  '42501', null, 'CA-07 / RF-06: inativo não se reativa por update direto');
select throws_ok(
  $$ update public.profiles set nome = 'X' where id = '00000000-0000-0000-0001-0000000000d1' $$,
  '42501', null, 'CA-07: inativo não escreve em profiles');

select pg_temp.como('00000000-0000-0000-0001-0000000000a1');
select throws_ok(
  $$ update public.profiles set status = 'ativo' where id = '00000000-0000-0000-0001-0000000000c1' $$,
  '42501', null, 'admin também não faz update direto (só por RPC, com auditoria e trava de último admin)');
select throws_ok(
  $$ delete from public.profiles where id = '00000000-0000-0000-0001-0000000000c1' $$,
  '42501', null, 'admin não apaga profiles direto');
reset role;

set local role anon;
select throws_ok(
  $$ update public.profiles set status = 'ativo' $$,
  '42501', null, 'anon não escreve em profiles');
reset role;

select is((select status::text from public.profiles where id = '00000000-0000-0000-0001-0000000000d1'), 'inativo',
  'nenhuma tentativa alterou os dados');

select * from finish();
rollback;
