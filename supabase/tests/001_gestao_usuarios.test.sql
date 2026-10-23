-- spec-001 T-09: gestão de usuários por RPC (RF-05, RF-06, RF-07; CA-03 a CA-06; P-07, P-08)
-- A concorrência de RF-07 fica em supabase/tests/concorrencia/001_gestao_usuarios.test.ts.
begin;
create extension if not exists pgtap with schema extensions;
select plan(31);

-- Isola dos dados do seed: só os admins deste teste ficam ativos.
update public.profiles set status = 'inativo' where perfil = 'admin';

insert into auth.users (id, email) values
  ('00000000-0000-0000-0002-0000000000a1', 't-admin1@teste.test'),
  ('00000000-0000-0000-0002-0000000000a2', 't-admin2@teste.test'),
  ('00000000-0000-0000-0002-0000000000b1', 't-ativo@teste.test'),
  ('00000000-0000-0000-0002-0000000000c1', 't-pendente@teste.test'),
  ('00000000-0000-0000-0002-0000000000d1', 't-inativo@teste.test'),
  ('00000000-0000-0000-0002-0000000000e1', 't-adminpend@teste.test');
insert into public.profiles (id, nome, email, perfil, status) values
  ('00000000-0000-0000-0002-0000000000a1', 'Admin 1', 't-admin1@teste.test', 'admin', 'ativo'),
  ('00000000-0000-0000-0002-0000000000a2', 'Admin 2', 't-admin2@teste.test', 'admin', 'inativo'),
  ('00000000-0000-0000-0002-0000000000b1', 'Ativo', 't-ativo@teste.test', 'solicitante', 'ativo'),
  ('00000000-0000-0000-0002-0000000000c1', 'Pendente', 't-pendente@teste.test', 'solicitante', 'pendente'),
  ('00000000-0000-0000-0002-0000000000d1', 'Inativo', 't-inativo@teste.test', 'solicitante', 'inativo'),
  ('00000000-0000-0000-0002-0000000000e1', 'Admin pendente', 't-adminpend@teste.test', 'admin', 'pendente');

create function pg_temp.como(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;
create function pg_temp.status_de(uid uuid) returns text language sql as $$
  select status::text from public.profiles where id = uid;
$$;
create function pg_temp.perfil_de(uid uuid) returns text language sql as $$
  select perfil::text from public.profiles where id = uid;
$$;

set local role authenticated;

-- CA-05: único admin ativo não se rebaixa nem se inativa ---------------------
select pg_temp.como('00000000-0000-0000-0002-0000000000a1');
select throws_ok(
  $$ select public.alterar_perfil_usuario('00000000-0000-0000-0002-0000000000a1', 'solicitante') $$,
  'P0001', 'Você é o único administrador ativo. Promova outro usuário antes, pois o sistema não pode ficar sem administrador.',
  'CA-05: único admin não se rebaixa, com mensagem explicando o motivo');
select throws_ok(
  $$ select public.alterar_status_usuario('00000000-0000-0000-0002-0000000000a1', 'inativo') $$,
  'P0001', 'Você é o único administrador ativo. Promova outro usuário antes, pois o sistema não pode ficar sem administrador.',
  'CA-05: único admin não se inativa');

-- CA-03: admin aprova pendente → ativo, com auditoria ------------------------
select lives_ok(
  $$ select public.alterar_status_usuario('00000000-0000-0000-0002-0000000000c1', 'ativo') $$,
  'CA-03: admin aprova usuário pendente');
select is(pg_temp.status_de('00000000-0000-0000-0002-0000000000c1'), 'ativo', 'CA-03: status vira ativo');
reset role;
select results_eq(
  $$ select acao, campos_alterados, usuario_id from public.auditoria
     where registro_id = '00000000-0000-0000-0002-0000000000c1' order by id desc limit 1 $$,
  $$ values ('UPDATE'::text, array['status']::text[], '00000000-0000-0000-0002-0000000000a1'::uuid) $$,
  'CA-03: aprovação aparece na auditoria com o admin como autor');
set local role authenticated;
select pg_temp.como('00000000-0000-0000-0002-0000000000a1');

-- RF-05: inativar, reativar, promover --------------------------------------
select lives_ok(
  $$ select public.alterar_status_usuario('00000000-0000-0000-0002-0000000000b1', 'inativo') $$,
  'RF-05: admin inativa usuário');
select is(pg_temp.status_de('00000000-0000-0000-0002-0000000000b1'), 'inativo', 'RF-05: status vira inativo');
select lives_ok(
  $$ select public.alterar_status_usuario('00000000-0000-0000-0002-0000000000b1', 'ativo') $$,
  'RF-05: admin reativa usuário');
select is(pg_temp.status_de('00000000-0000-0000-0002-0000000000b1'), 'ativo', 'RF-05: status volta a ativo');
select throws_ok(
  $$ select public.alterar_status_usuario('00000000-0000-0000-0002-0000000000b1', 'pendente') $$,
  'P0001', 'Status inválido: use ativo ou inativo.', 'RF-05: não se volta um usuário para pendente');
select lives_ok(
  $$ select public.alterar_perfil_usuario('00000000-0000-0000-0002-0000000000a2', 'admin') $$,
  'RF-05: admin altera perfil (sem mudança de valor, sem erro)');
select lives_ok(
  $$ select public.alterar_status_usuario('00000000-0000-0000-0002-0000000000a2', 'ativo') $$,
  'RF-05: admin reativa outro admin');
select throws_ok(
  $$ select public.alterar_status_usuario('00000000-0000-0000-0002-0000000000ff', 'ativo') $$,
  'P0001', 'Usuário não encontrado.', 'usuário inexistente → mensagem clara');
select is(
  (public.alterar_status_usuario('00000000-0000-0000-0002-0000000000b1', 'ativo')).id,
  '00000000-0000-0000-0002-0000000000b1'::uuid,
  'a RPC devolve o perfil atualizado');

-- RF-06: com dois admins, ninguém altera a si mesmo -------------------------
select throws_ok(
  $$ select public.alterar_perfil_usuario('00000000-0000-0000-0002-0000000000a1', 'solicitante') $$,
  'P0001', 'Você não pode alterar o próprio perfil nem o próprio status. Peça a outro administrador.',
  'RF-06: admin não altera o próprio perfil');
select throws_ok(
  $$ select public.alterar_status_usuario('00000000-0000-0000-0002-0000000000a1', 'inativo') $$,
  'P0001', 'Você não pode alterar o próprio perfil nem o próprio status. Peça a outro administrador.',
  'RF-06: admin não altera o próprio status');

-- CA-06: com dois admins, um rebaixa o outro ---------------------------------
select lives_ok(
  $$ select public.alterar_perfil_usuario('00000000-0000-0000-0002-0000000000a2', 'solicitante') $$,
  'CA-06: um admin rebaixa o outro');
select is(pg_temp.perfil_de('00000000-0000-0000-0002-0000000000a2'), 'solicitante', 'CA-06: perfil vira solicitante');
reset role;
select is(
  (select dados_depois->>'perfil' from public.auditoria
   where registro_id = '00000000-0000-0000-0002-0000000000a2' order by id desc limit 1),
  'solicitante', 'CA-06: rebaixamento fica na auditoria');
set local role authenticated;

-- CA-04: solicitante não vira admin -----------------------------------------
select pg_temp.como('00000000-0000-0000-0002-0000000000b1');
select throws_ok(
  $$ select public.alterar_perfil_usuario('00000000-0000-0000-0002-0000000000b1', 'admin') $$,
  'P0001', 'Apenas administradores ativos podem alterar usuários.', 'CA-04: solicitante não se promove por RPC');
select throws_ok(
  $$ select public.alterar_perfil_usuario('00000000-0000-0000-0002-0000000000c1', 'admin') $$,
  'P0001', 'Apenas administradores ativos podem alterar usuários.', 'CA-04: solicitante não promove outro');
select throws_ok(
  $$ select public.alterar_status_usuario('00000000-0000-0000-0002-0000000000d1', 'ativo') $$,
  'P0001', 'Apenas administradores ativos podem alterar usuários.', 'solicitante não reativa ninguém');

-- Caminhos negados: pendente, inativo, admin pendente ------------------------
select pg_temp.como('00000000-0000-0000-0002-0000000000d1');
select throws_ok(
  $$ select public.alterar_status_usuario('00000000-0000-0000-0002-0000000000d1', 'ativo') $$,
  'P0001', 'Apenas administradores ativos podem alterar usuários.', 'CA-07: inativo não se reativa');
select throws_ok(
  $$ select public.alterar_perfil_usuario('00000000-0000-0000-0002-0000000000b1', 'admin') $$,
  'P0001', 'Apenas administradores ativos podem alterar usuários.', 'CA-07: inativo não altera perfil');

select pg_temp.como('00000000-0000-0000-0002-0000000000e1');
select throws_ok(
  $$ select public.alterar_status_usuario('00000000-0000-0000-0002-0000000000d1', 'ativo') $$,
  'P0001', 'Apenas administradores ativos podem alterar usuários.', 'RN-04: admin pendente ainda não tem poderes');
select throws_ok(
  $$ select public.alterar_perfil_usuario('00000000-0000-0000-0002-0000000000b1', 'admin') $$,
  'P0001', 'Apenas administradores ativos podem alterar usuários.', 'RN-04: admin pendente não promove');

-- usuário autenticado sem profiles
select pg_temp.como('00000000-0000-0000-0002-0000000000ff');
select throws_ok(
  $$ select public.alterar_status_usuario('00000000-0000-0000-0002-0000000000d1', 'ativo') $$,
  'P0001', 'Apenas administradores ativos podem alterar usuários.', 'usuário sem profiles não altera ninguém');
reset role;

set local role anon;
select throws_ok(
  $$ select public.alterar_status_usuario('00000000-0000-0000-0002-0000000000d1', 'ativo') $$,
  '42501', null, 'anon não executa alterar_status_usuario');
select throws_ok(
  $$ select public.alterar_perfil_usuario('00000000-0000-0000-0002-0000000000b1', 'admin') $$,
  '42501', null, 'anon não executa alterar_perfil_usuario');
reset role;

select is(pg_temp.status_de('00000000-0000-0000-0002-0000000000d1'), 'inativo', 'tentativas negadas não alteraram nada');
select is(pg_temp.perfil_de('00000000-0000-0000-0002-0000000000b1'), 'solicitante', 'solicitante continua solicitante');

select * from finish();
rollback;
