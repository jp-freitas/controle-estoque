-- spec-001 T-11: edição de nome/matrícula (RF-15, RF-16, RN-05; CA-16, CA-17)
begin;
create extension if not exists pgtap with schema extensions;
select plan(28);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0003-0000000000a1', 't-admin@teste.test'),
  ('00000000-0000-0000-0003-0000000000a2', 't-admininat@teste.test'),
  ('00000000-0000-0000-0003-0000000000b1', 't-ativo@teste.test'),
  ('00000000-0000-0000-0003-0000000000b2', 't-ativo2@teste.test'),
  ('00000000-0000-0000-0003-0000000000c1', 't-pendente@teste.test'),
  ('00000000-0000-0000-0003-0000000000d1', 't-inativo@teste.test');
insert into public.profiles (id, nome, email, matricula, perfil, status) values
  ('00000000-0000-0000-0003-0000000000a1', 'Admin', 't-admin@teste.test', null, 'admin', 'ativo'),
  ('00000000-0000-0000-0003-0000000000a2', 'Admin inativo', 't-admininat@teste.test', null, 'admin', 'inativo'),
  ('00000000-0000-0000-0003-0000000000b1', 'Ativo', 't-ativo@teste.test', 'T-100', 'solicitante', 'ativo'),
  ('00000000-0000-0000-0003-0000000000b2', 'Ativo 2', 't-ativo2@teste.test', 'T-200', 'solicitante', 'ativo'),
  ('00000000-0000-0000-0003-0000000000c1', 'Pendente', 't-pendente@teste.test', null, 'solicitante', 'pendente'),
  ('00000000-0000-0000-0003-0000000000d1', 'Inativo', 't-inativo@teste.test', null, 'solicitante', 'inativo');

create function pg_temp.como(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;
create function pg_temp.perfil(uid uuid) returns public.profiles language sql as $$
  select * from public.profiles where id = uid;
$$;

-- CA-16: só nome e matrícula podem ser passados ----------------------------
select bag_eq(
  $$ select proname::text from pg_proc
     where pronamespace = 'public'::regnamespace and proname in ('atualizar_meu_perfil', 'atualizar_usuario') $$,
  array['atualizar_meu_perfil', 'atualizar_usuario'],
  'CA-16: uma única versão de cada RPC de edição (sem sobrecarga com email/perfil/status)');
select has_function('public', 'atualizar_meu_perfil', array['text', 'text'],
  'CA-16: atualizar_meu_perfil(nome, matricula) — sem email, perfil ou status');
select has_function('public', 'atualizar_usuario', array['uuid', 'text', 'text'],
  'RF-16: atualizar_usuario(id, nome, matricula) — sem email, perfil ou status');

set local role authenticated;

-- RF-15 / CA-16: usuário ativo edita o próprio nome e matrícula -------------
select pg_temp.como('00000000-0000-0000-0003-0000000000b1');
select lives_ok($$ select public.atualizar_meu_perfil('  Prof. Ativo  ', '  T-101 ') $$,
  'CA-16: ativo edita o próprio nome e matrícula');
select is((pg_temp.perfil('00000000-0000-0000-0003-0000000000b1')).nome, 'Prof. Ativo', 'nome sem espaços nas pontas');
select is((pg_temp.perfil('00000000-0000-0000-0003-0000000000b1')).matricula, 'T-101', 'matrícula sem espaços nas pontas');
select lives_ok($$ select public.atualizar_meu_perfil('Prof. Ativo', '   ') $$, 'matrícula em branco é aceita');
select is((pg_temp.perfil('00000000-0000-0000-0003-0000000000b1')).matricula, null, 'RN-05: matrícula em branco vira null');
select lives_ok($$ select public.atualizar_meu_perfil('Prof. Ativo', null) $$, 'RN-05: matrícula nula é aceita');
select is((public.atualizar_meu_perfil('Prof. Ativo', 'T-101')).matricula, 'T-101', 'a RPC devolve o perfil atualizado');
select ok(
  (pg_temp.perfil('00000000-0000-0000-0003-0000000000b1')).perfil = 'solicitante'
  and (pg_temp.perfil('00000000-0000-0000-0003-0000000000b1')).status = 'ativo'
  and (pg_temp.perfil('00000000-0000-0000-0003-0000000000b1')).email = 't-ativo@teste.test',
  'CA-16: email, perfil e status não mudam');
select throws_ok($$ select public.atualizar_meu_perfil('   ', 'T-101') $$,
  'P0001', 'Informe o nome.', 'nome em branco → mensagem clara');

-- CA-17: matrícula duplicada ------------------------------------------------
select throws_ok($$ select public.atualizar_meu_perfil('Prof. Ativo', 'T-200') $$,
  'P0001', 'Matrícula já cadastrada.', 'CA-17: matrícula de outro usuário → "Matrícula já cadastrada"');
select throws_ok($$ select public.atualizar_meu_perfil('Prof. Ativo', ' T-200 ') $$,
  'P0001', 'Matrícula já cadastrada.', 'CA-17: duplicada mesmo com espaços');
select lives_ok($$ select public.atualizar_meu_perfil('Prof. Ativo', 'T-101') $$,
  'manter a própria matrícula não conta como duplicada');

-- RF-15: só usuário ativo ----------------------------------------------------
select pg_temp.como('00000000-0000-0000-0003-0000000000c1');
select throws_ok($$ select public.atualizar_meu_perfil('X', null) $$,
  'P0001', 'Apenas usuários ativos podem editar o perfil.', 'RF-15: pendente não edita o próprio perfil');
select pg_temp.como('00000000-0000-0000-0003-0000000000d1');
select throws_ok($$ select public.atualizar_meu_perfil('X', null) $$,
  'P0001', 'Apenas usuários ativos podem editar o perfil.', 'CA-07: inativo não edita o próprio perfil');
select pg_temp.como('00000000-0000-0000-0003-0000000000ff');
select throws_ok($$ select public.atualizar_meu_perfil('X', null) $$,
  'P0001', 'Apenas usuários ativos podem editar o perfil.', 'usuário sem profiles não edita nada');

-- RF-16: admin edita nome/matrícula de outro --------------------------------
select pg_temp.como('00000000-0000-0000-0003-0000000000a1');
select lives_ok($$ select public.atualizar_usuario('00000000-0000-0000-0003-0000000000c1', ' Prof. Pendente ', 'T-300') $$,
  'RF-16: admin edita nome e matrícula de outro usuário');
select ok((pg_temp.perfil('00000000-0000-0000-0003-0000000000c1')).nome = 'Prof. Pendente'
  and (pg_temp.perfil('00000000-0000-0000-0003-0000000000c1')).matricula = 'T-300'
  and (pg_temp.perfil('00000000-0000-0000-0003-0000000000c1')).status = 'pendente',
  'RF-16: nome e matrícula mudam; status não');
select throws_ok($$ select public.atualizar_usuario('00000000-0000-0000-0003-0000000000c1', 'X', 'T-200') $$,
  'P0001', 'Matrícula já cadastrada.', 'CA-17: admin também não duplica matrícula');
select throws_ok($$ select public.atualizar_usuario('00000000-0000-0000-0003-0000000000ff', 'X', null) $$,
  'P0001', 'Usuário não encontrado.', 'usuário inexistente → mensagem clara');

-- Caminhos negados de atualizar_usuario -------------------------------------
select pg_temp.como('00000000-0000-0000-0003-0000000000b1');
select throws_ok($$ select public.atualizar_usuario('00000000-0000-0000-0003-0000000000b2', 'X', null) $$,
  'P0001', 'Apenas administradores ativos podem alterar usuários.', 'RF-16: solicitante não edita outro');
select throws_ok($$ select public.atualizar_usuario('00000000-0000-0000-0003-0000000000b1', 'X', null) $$,
  'P0001', 'Apenas administradores ativos podem alterar usuários.', 'solicitante não usa a RPC de admin nem para si');
select pg_temp.como('00000000-0000-0000-0003-0000000000a2');
select throws_ok($$ select public.atualizar_usuario('00000000-0000-0000-0003-0000000000b2', 'X', null) $$,
  'P0001', 'Apenas administradores ativos podem alterar usuários.', 'admin inativo não edita ninguém');
reset role;

set local role anon;
select throws_ok($$ select public.atualizar_meu_perfil('X', null) $$, '42501', null, 'anon não executa atualizar_meu_perfil');
select throws_ok($$ select public.atualizar_usuario('00000000-0000-0000-0003-0000000000b2', 'X', null) $$,
  '42501', null, 'anon não executa atualizar_usuario');
reset role;

select is((pg_temp.perfil('00000000-0000-0000-0003-0000000000b2')).nome, 'Ativo 2', 'tentativas negadas não alteraram nada');

select * from finish();
rollback;
