-- spec-001 T-15: aceite do convite (RF-11, RN-03, RN-04; CA-09 a CA-11, CA-14, CA-15, CA-18)
begin;
create extension if not exists pgtap with schema extensions;
select plan(25);

-- O convidado já está em auth.users: o signInWithOtp cria a linha no envio (spike T-01).
insert into auth.users (id, email) values
  ('00000000-0000-0000-0005-0000000000a1', 't-admin@teste.test'),
  ('00000000-0000-0000-0005-000000000001', 'valido@teste.test'),
  ('00000000-0000-0000-0005-000000000002', 'expirado@teste.test'),
  ('00000000-0000-0000-0005-000000000003', 'cancelado@teste.test'),
  ('00000000-0000-0000-0005-000000000004', 'chefe@teste.test'),
  ('00000000-0000-0000-0005-000000000005', 'semconvite@teste.test'),
  ('00000000-0000-0000-0005-000000000006', 'renovado@teste.test');
insert into public.profiles (id, nome, email, perfil, status) values
  ('00000000-0000-0000-0005-0000000000a1', 'Admin', 't-admin@teste.test', 'admin', 'ativo');

insert into public.convite (email, nome, matricula, perfil, convidado_por, criado_em, expira_em, cancelado_em) values
  ('Valido@Teste.test', 'Prof. Válido', '12345', 'solicitante', '00000000-0000-0000-0005-0000000000a1', now(), now() + interval '7 days', null),
  ('expirado@teste.test', 'Prof. Expirado', null, 'solicitante', '00000000-0000-0000-0005-0000000000a1',
     now() - interval '8 days', now() - interval '1 day', null),
  ('cancelado@teste.test', 'Prof. Cancelado', null, 'solicitante', '00000000-0000-0000-0005-0000000000a1',
     now(), now() + interval '7 days', now()),
  ('chefe@teste.test', 'Chefe', null, 'admin', '00000000-0000-0000-0005-0000000000a1', now(), now() + interval '7 days', null),
  -- convite antigo expirado + convite novo em aberto para o mesmo e-mail
  ('renovado@teste.test', 'Antigo', null, 'solicitante', '00000000-0000-0000-0005-0000000000a1',
     now() - interval '10 days', now() - interval '3 days', null),
  ('renovado@teste.test', 'Renovado', null, 'solicitante', '00000000-0000-0000-0005-0000000000a1',
     now() - interval '1 day', now() + interval '6 days', null);

create function pg_temp.como(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;
create function pg_temp.perfil(uid uuid) returns public.profiles language sql as $$
  select * from public.profiles where id = uid;
$$;
create function pg_temp.situacao(p_email text) returns text language sql as $$
  select situacao from public.convite_situacao where email = p_email::extensions.citext order by criado_em desc limit 1;
$$;

set local role authenticated;

-- CA-09 / CA-15: aceite válido ----------------------------------------------
select pg_temp.como('00000000-0000-0000-0005-000000000001');
select lives_ok($$ select public.aceitar_convite() $$, 'CA-09: convidado aceita convite válido');
reset role;
select is((pg_temp.perfil('00000000-0000-0000-0005-000000000001')).email, 'valido@teste.test'::extensions.citext,
  'CA-09 / RN-03: profiles com o e-mail da conta (sem diferenciar maiúsculas do convite)');
select is((pg_temp.perfil('00000000-0000-0000-0005-000000000001')).nome, 'Prof. Válido', 'RF-11: nome do convite');
select is((pg_temp.perfil('00000000-0000-0000-0005-000000000001')).perfil, 'solicitante'::public.perfil, 'CA-09: perfil do convite');
select is((pg_temp.perfil('00000000-0000-0000-0005-000000000001')).status, 'pendente'::public.status_usuario,
  'CA-09 / RN-04: status pendente');
select is((pg_temp.perfil('00000000-0000-0000-0005-000000000001')).matricula, '12345', 'CA-15: matrícula copiada do convite');
select is(pg_temp.situacao('valido@teste.test'), 'aceito', 'CA-09: convite passa a aceito');
select is(
  (select acao from public.auditoria where registro_id = '00000000-0000-0000-0005-000000000001' order by id desc limit 1),
  'INSERT', 'RN-02 / spec-006/RF-06: criação do profiles é auditada');
set local role authenticated;

-- Aceitar duas vezes não cria dois perfis ------------------------------------
select pg_temp.como('00000000-0000-0000-0005-000000000001');
select is((public.aceitar_convite()).id, '00000000-0000-0000-0005-000000000001'::uuid,
  'aceitar de novo devolve o mesmo perfil, sem erro');
reset role;
select is((select count(*) from public.profiles where email = 'valido@teste.test'), 1::bigint,
  'aceitar duas vezes não cria dois perfis');
set local role authenticated;

-- CA-10: expirado -------------------------------------------------------------
select pg_temp.como('00000000-0000-0000-0005-000000000002');
select throws_ok($$ select public.aceitar_convite() $$,
  'P0001', 'Convite expirado. Peça um novo convite à administração da escola.', 'CA-10: convite expirado é rejeitado');
reset role;
select is(pg_temp.perfil('00000000-0000-0000-0005-000000000002'), null, 'CA-10: nenhum profiles criado');
set local role authenticated;

-- CA-11: cancelado ------------------------------------------------------------
select pg_temp.como('00000000-0000-0000-0005-000000000003');
select throws_ok($$ select public.aceitar_convite() $$,
  'P0001', 'Convite cancelado. Procure a administração da escola.', 'CA-11: convite cancelado é rejeitado');
reset role;
select is(pg_temp.perfil('00000000-0000-0000-0005-000000000003'), null, 'CA-11: nenhum profiles criado');
set local role authenticated;

-- CA-14 / CA-18: convite admin, sem matrícula ---------------------------------
select pg_temp.como('00000000-0000-0000-0005-000000000004');
select lives_ok($$ select public.aceitar_convite() $$, 'CA-18: convite sem matrícula é aceito sem erro');
reset role;
select is((pg_temp.perfil('00000000-0000-0000-0005-000000000004')).matricula, null, 'CA-18: matrícula vazia');
select ok((pg_temp.perfil('00000000-0000-0000-0005-000000000004')).perfil = 'admin'
  and (pg_temp.perfil('00000000-0000-0000-0005-000000000004')).status = 'pendente',
  'CA-14: convite admin → perfil admin, status pendente');
set local role authenticated;
select pg_temp.como('00000000-0000-0000-0005-000000000004');
select is(public.eh_admin_ativo(), false, 'CA-14 / RN-04: sem poderes de admin até a aprovação');
select throws_ok($$ select public.convidar_usuario('x@escola.br', 'X', null) $$,
  'P0001', 'Apenas administradores ativos podem gerenciar convites.', 'CA-14: admin pendente não convida');
select is_empty('select id from public.convite', 'CA-14: admin pendente não lista convites');

-- Convite novo depois de um expirado: vale o mais recente --------------------
select pg_temp.como('00000000-0000-0000-0005-000000000006');
select is((public.aceitar_convite()).nome, 'Renovado', 'vale o convite em aberto mais recente, não o expirado');

-- Sem convite / sem login ------------------------------------------------------
select pg_temp.como('00000000-0000-0000-0005-000000000005');
select throws_ok($$ select public.aceitar_convite() $$,
  'P0001', 'Não há convite para este e-mail. Procure a administração da escola.', 'RF-03: sem convite, sem profiles');
select set_config('request.jwt.claims', '', true);
select throws_ok($$ select public.aceitar_convite() $$,
  'P0001', 'Abra o link do convite enviado para o seu e-mail.', 'sem usuário autenticado → mensagem clara');
reset role;

set local role anon;
select throws_ok($$ select public.aceitar_convite() $$, '42501', null, 'anon não executa aceitar_convite');
reset role;

select is((select count(*) from public.profiles where email in ('semconvite@teste.test', 'expirado@teste.test', 'cancelado@teste.test')),
  0::bigint, 'RF-03: nenhuma tentativa negada criou profiles');

select * from finish();
rollback;
