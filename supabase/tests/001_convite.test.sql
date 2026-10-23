-- spec-001 T-13: convite (RF-10, RF-12 a RF-14, RN-03, RN-05; CA-08, CA-12, CA-13, CA-17)
-- A concorrência (dois admins convidando o mesmo e-mail) fica em
-- supabase/tests/concorrencia/001_convite.test.ts.
begin;
create extension if not exists pgtap with schema extensions;
select plan(47);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0004-0000000000a1', 't-admin@teste.test'),
  ('00000000-0000-0000-0004-0000000000a2', 't-admin2@teste.test'),
  ('00000000-0000-0000-0004-0000000000b1', 't-ativo@teste.test'),
  ('00000000-0000-0000-0004-0000000000c1', 't-pendente@teste.test'),
  ('00000000-0000-0000-0004-0000000000d1', 't-inativo@teste.test');
insert into public.profiles (id, nome, email, matricula, perfil, status) values
  ('00000000-0000-0000-0004-0000000000a1', 'Admin', 't-admin@teste.test', null, 'admin', 'ativo'),
  ('00000000-0000-0000-0004-0000000000a2', 'Admin 2', 't-admin2@teste.test', null, 'admin', 'ativo'),
  ('00000000-0000-0000-0004-0000000000b1', 'Ativo', 't-ativo@teste.test', '12345', 'solicitante', 'ativo'),
  ('00000000-0000-0000-0004-0000000000c1', 'Pendente', 't-pendente@teste.test', null, 'solicitante', 'pendente'),
  ('00000000-0000-0000-0004-0000000000d1', 'Inativo', 't-inativo@teste.test', null, 'solicitante', 'inativo');

create function pg_temp.como(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;
create function pg_temp.conv(p_email text) returns public.convite_situacao language sql as $$
  select * from public.convite_situacao where email = p_email::extensions.citext order by criado_em desc limit 1;
$$;

-- Estrutura -------------------------------------------------------------------
select has_table('public', 'convite', 'RF-10: tabela convite existe');
select col_type_is('public', 'convite', 'email', 'extensions.citext', 'RN-03: convite.email é citext');
select col_is_null('public', 'convite', 'matricula', 'RN-05: matrícula do convite é opcional');
select col_default_is('public', 'convite', 'perfil', 'solicitante', 'RF-10: perfil padrão = solicitante');
select ok((select relrowsecurity from pg_class where oid = 'public.convite'::regclass), 'P-02: RLS habilitado em convite');
select ok(
  (select 'security_invoker=true' = any(reloptions) from pg_class where oid = 'public.convite_situacao'::regclass),
  'view convite_situacao respeita a RLS (security_invoker)');

set local role authenticated;
select pg_temp.como('00000000-0000-0000-0004-0000000000a1');

-- CA-08: admin cria convite --------------------------------------------------
select lives_ok(
  $$ select public.convidar_usuario('prof@escola.br', '  Prof. Novo ', null, 'solicitante') $$,
  'CA-08: admin ativo convida prof@escola.br');
select is((pg_temp.conv('prof@escola.br')).situacao, 'enviado', 'CA-08: situação enviado');
select is((pg_temp.conv('prof@escola.br')).nome, 'Prof. Novo', 'CA-08: nome registrado (sem espaços nas pontas)');
select is((pg_temp.conv('prof@escola.br')).perfil, 'solicitante'::public.perfil, 'CA-08: perfil registrado');
select is((pg_temp.conv('prof@escola.br')).convidado_por, '00000000-0000-0000-0004-0000000000a1'::uuid,
  'CA-08: registra quem convidou');
select is((pg_temp.conv('prof@escola.br')).expira_em - (pg_temp.conv('prof@escola.br')).criado_em, interval '7 days',
  'CA-08 / RF-12: validade de 7 dias');
select is((public.convidar_usuario('padrao@escola.br', 'Padrão', null)).perfil, 'solicitante'::public.perfil,
  'RF-10: sem perfil informado, solicitante');
select is((public.convidar_usuario('chefe@escola.br', 'Chefe', ' 777 ', 'admin')).matricula, '777',
  'RF-10: matrícula e perfil admin registrados');

-- Validação de entrada ------------------------------------------------------
select throws_ok($$ select public.convidar_usuario('sem-arroba', 'X', null) $$,
  'P0001', 'E-mail inválido.', 'e-mail sem formato válido → mensagem clara');
select throws_ok($$ select public.convidar_usuario('ok@escola.br', '  ', null) $$,
  'P0001', 'Informe o nome.', 'nome em branco → mensagem clara');

-- CA-13 / RF-14 / RN-03: e-mail com conta ou convite em aberto ---------------
select throws_ok($$ select public.convidar_usuario('t-ativo@teste.test', 'X', null) $$,
  'P0001', 'Já existe uma conta com este e-mail.', 'CA-13: e-mail que já tem conta');
select throws_ok($$ select public.convidar_usuario('T-Ativo@Teste.TEST', 'X', null) $$,
  'P0001', 'Já existe uma conta com este e-mail.', 'RN-03: conta reconhecida sem diferenciar maiúsculas');
select throws_ok($$ select public.convidar_usuario('prof@escola.br', 'X', null) $$,
  'P0001', 'Já existe um convite em aberto para este e-mail.', 'CA-13: e-mail com convite em aberto');
select throws_ok($$ select public.convidar_usuario('  Prof@Escola.br ', 'X', null) $$,
  'P0001', 'Já existe um convite em aberto para este e-mail.', 'RN-03: Prof@Escola.br = prof@escola.br');

-- CA-17 / RN-05: matrícula --------------------------------------------------
select throws_ok($$ select public.convidar_usuario('m1@escola.br', 'X', '12345') $$,
  'P0001', 'Matrícula já cadastrada.', 'CA-17: matrícula de usuário existente');
select throws_ok($$ select public.convidar_usuario('m2@escola.br', 'X', '777') $$,
  'P0001', 'Matrícula já cadastrada.', 'RN-05: matrícula de convite em aberto');

-- Convite expirado ou cancelado libera e-mail e matrícula -------------------
reset role;
update public.convite set criado_em = now() - interval '8 days', expira_em = now() - interval '1 day'
 where email = 'chefe@escola.br';
set local role authenticated;
select pg_temp.como('00000000-0000-0000-0004-0000000000a1');

select is((pg_temp.conv('chefe@escola.br')).situacao, 'expirado', 'RF-12 / RF-13: convite vencido aparece como expirado');
select lives_ok($$ select public.convidar_usuario('outro@escola.br', 'Outro', '777') $$,
  'RN-05: matrícula de convite expirado pode ser reutilizada');
select lives_ok($$ select public.convidar_usuario('chefe@escola.br', 'Chefe', null, 'admin') $$,
  'CA-13: e-mail com convite expirado pode receber novo convite');
select is((select count(*) from public.convite where email = 'chefe@escola.br'), 2::bigint,
  'o convite expirado continua registrado (histórico)');

-- RF-13: cancelar -------------------------------------------------------------
select lives_ok(
  format('select public.cancelar_convite(%L)', (pg_temp.conv('padrao@escola.br')).id),
  'RF-13: admin cancela convite não aceito');
select is((pg_temp.conv('padrao@escola.br')).situacao, 'cancelado', 'RF-13: situação cancelado');
select throws_ok(
  format('select public.cancelar_convite(%L)', (pg_temp.conv('padrao@escola.br')).id),
  'P0001', 'Este convite já foi cancelado.', 'cancelar duas vezes → mensagem clara');
select lives_ok($$ select public.convidar_usuario('padrao@escola.br', 'Padrão', null) $$,
  'CA-13: e-mail com convite cancelado pode receber novo convite');
select throws_ok($$ select public.cancelar_convite('00000000-0000-0000-0004-0000000000ff') $$,
  'P0001', 'Convite não encontrado.', 'convite inexistente → mensagem clara');

reset role;
update public.convite set aceito_em = now() where email = 'outro@escola.br';
set local role authenticated;
select pg_temp.como('00000000-0000-0000-0004-0000000000a1');
select is((pg_temp.conv('outro@escola.br')).situacao, 'aceito', 'RF-13: convite aceito aparece como aceito');
select throws_ok(
  format('select public.cancelar_convite(%L)', (pg_temp.conv('outro@escola.br')).id),
  'P0001', 'Este convite já foi aceito e não pode ser cancelado.', 'RF-13: convite aceito não é cancelado');

-- RN-05 × edição de perfil (achado da T-12) ------------------------------------
select lives_ok($$ select public.convidar_usuario('reserva@escola.br', 'Reserva', 'R-1') $$,
  'convite com matrícula R-1');
select pg_temp.como('00000000-0000-0000-0004-0000000000b1');
select throws_ok($$ select public.atualizar_meu_perfil('Ativo', 'R-1') $$,
  'P0001', 'Matrícula já cadastrada.', 'CA-17 / RN-05: usuário não usa a matrícula de um convite em aberto');
select pg_temp.como('00000000-0000-0000-0004-0000000000a1');
select throws_ok($$ select public.atualizar_usuario('00000000-0000-0000-0004-0000000000b1', 'Ativo', 'R-1') $$,
  'P0001', 'Matrícula já cadastrada.', 'CA-17 / RN-05: nem o admin, pela edição de outro usuário');

-- RF-10: lista para o admin -------------------------------------------------
select ok((select count(*) from public.convite_situacao) >= 7, 'RF-13: admin lista os convites com situação');

-- CA-12: solicitante, pendente e inativo -------------------------------------
select pg_temp.como('00000000-0000-0000-0004-0000000000b1');
select throws_ok($$ select public.convidar_usuario('x1@escola.br', 'X', null) $$,
  'P0001', 'Apenas administradores ativos podem gerenciar convites.', 'CA-12: solicitante não cria convite');
select is_empty('select id from public.convite_situacao', 'CA-12: solicitante não lista convites');
select throws_ok(format('select public.cancelar_convite(%L)', (select id from public.convite limit 1)),
  'P0001', 'Apenas administradores ativos podem gerenciar convites.', 'CA-12: solicitante não cancela convite');

select pg_temp.como('00000000-0000-0000-0004-0000000000c1');
select throws_ok($$ select public.convidar_usuario('x2@escola.br', 'X', null) $$,
  'P0001', 'Apenas administradores ativos podem gerenciar convites.', 'CA-12: pendente não cria convite');
select is_empty('select id from public.convite', 'CA-12: pendente não lista convites');

select pg_temp.como('00000000-0000-0000-0004-0000000000d1');
select throws_ok($$ select public.convidar_usuario('x3@escola.br', 'X', null) $$,
  'P0001', 'Apenas administradores ativos podem gerenciar convites.', 'CA-12: inativo não cria convite');
select is_empty('select id from public.convite', 'CA-12: inativo não lista convites');

-- Escrita direta negada (só por RPC) ------------------------------------------
select pg_temp.como('00000000-0000-0000-0004-0000000000a1');
select throws_ok(
  $$ insert into public.convite (email, nome, convidado_por) values ('d@escola.br', 'D', '00000000-0000-0000-0004-0000000000a1') $$,
  '42501', null, 'admin não insere convite direto (só por RPC)');
select throws_ok($$ update public.convite set cancelado_em = now() $$,
  '42501', null, 'admin não altera convite direto');
reset role;

set local role anon;
select throws_ok($$ select public.convidar_usuario('x4@escola.br', 'X', null) $$,
  '42501', null, 'CA-12: anon não executa convidar_usuario');
reset role;

select * from finish();
rollback;
