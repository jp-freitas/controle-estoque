-- spec-001 T-17: hook before_user_created (RF-03, CA-01)
-- O Auth chama a função como supabase_auth_admin antes de criar qualquer usuário
-- (signUp, signInWithOtp, admin API). Ver plan.md → Achados do spike T-01.
begin;
create extension if not exists pgtap with schema extensions;
select plan(16);

insert into auth.users (id, email) values ('00000000-0000-0000-0006-0000000000a1', 't-admin@teste.test');
insert into public.profiles (id, nome, email, perfil, status) values
  ('00000000-0000-0000-0006-0000000000a1', 'Admin', 't-admin@teste.test', 'admin', 'ativo');
insert into public.convite (email, nome, convidado_por, criado_em, expira_em, cancelado_em, aceito_em) values
  ('aberto@teste.test', 'Aberto', '00000000-0000-0000-0006-0000000000a1', now(), now() + interval '7 days', null, null),
  ('Misto@Teste.test', 'Misto', '00000000-0000-0000-0006-0000000000a1', now(), now() + interval '7 days', null, null),
  ('expirado@teste.test', 'Expirado', '00000000-0000-0000-0006-0000000000a1',
     now() - interval '8 days', now() - interval '1 day', null, null),
  ('cancelado@teste.test', 'Cancelado', '00000000-0000-0000-0006-0000000000a1', now(), now() + interval '7 days', now(), null),
  ('aceito@teste.test', 'Aceito', '00000000-0000-0000-0006-0000000000a1', now(), now() + interval '7 days', null, now());

create function pg_temp.evento(p_email text) returns jsonb language sql as $$
  select jsonb_build_object(
    'user', jsonb_build_object('id', gen_random_uuid(), 'email', p_email, 'aud', 'authenticated',
                               'app_metadata', jsonb_build_object('provider', 'email')),
    'metadata', jsonb_build_object('name', 'before-user-created'));
$$;

select is_definer('public', 'validar_cadastro_por_convite', array['jsonb'], 'hook é SECURITY DEFINER (lê convite, que tem RLS)');

-- postgres não pode assumir supabase_auth_admin; a função é SECURITY DEFINER,
-- então roda como o dono de qualquer forma. O privilégio do Auth é checado no fim
-- e o fluxo real pela API foi validado no spike T-01 (e no E2E, T-28).

-- Liberado: convite em aberto ---------------------------------------------
select is(public.validar_cadastro_por_convite(pg_temp.evento('aberto@teste.test')), '{}'::jsonb,
  'CA-01: e-mail com convite em aberto pode criar conta');
select is(public.validar_cadastro_por_convite(pg_temp.evento('misto@teste.test')), '{}'::jsonb,
  'RN-03: convite gravado com maiúsculas é reconhecido');
select is(public.validar_cadastro_por_convite(pg_temp.evento('  ABERTO@teste.test ')), '{}'::jsonb,
  'RN-03: e-mail do evento com maiúsculas/espaços é reconhecido');

-- Barrado ------------------------------------------------------------------
select is(public.validar_cadastro_por_convite(pg_temp.evento('intruso@teste.test')) -> 'error' ->> 'http_code', '403',
  'CA-01: e-mail sem convite → 403');
select is(public.validar_cadastro_por_convite(pg_temp.evento('intruso@teste.test')) -> 'error' ->> 'message',
  'Cadastro só por convite. Procure a administração da escola.',
  'CA-01: mensagem legível para o front');
select is(public.validar_cadastro_por_convite(pg_temp.evento('expirado@teste.test')) -> 'error' ->> 'http_code', '403',
  'CA-01 / RF-12: convite expirado não libera');
select is(public.validar_cadastro_por_convite(pg_temp.evento('cancelado@teste.test')) -> 'error' ->> 'http_code', '403',
  'CA-01 / RF-13: convite cancelado não libera');
select is(public.validar_cadastro_por_convite(pg_temp.evento('aceito@teste.test')) -> 'error' ->> 'http_code', '403',
  'convite já aceito não libera nova conta');
select is(public.validar_cadastro_por_convite(pg_temp.evento(null)) -> 'error' ->> 'http_code', '403',
  'cadastro sem e-mail (ex.: telefone) é barrado');

-- Nunca lança exceção (senão o front recebe 500 genérico) ----------------------
select lives_ok($$ select public.validar_cadastro_por_convite(null) $$, 'evento nulo não lança exceção');
select is(public.validar_cadastro_por_convite(null) -> 'error' ->> 'http_code', '403', 'evento nulo é barrado');
select lives_ok($$ select public.validar_cadastro_por_convite('{"user": "não é objeto"}'::jsonb) $$,
  'evento malformado não lança exceção');

-- Só o Auth executa ----------------------------------------------------------
set local role authenticated;
select throws_ok($$ select public.validar_cadastro_por_convite('{}'::jsonb) $$, '42501', null,
  'authenticated não executa o hook');
reset role;
set local role anon;
select throws_ok($$ select public.validar_cadastro_por_convite('{}'::jsonb) $$, '42501', null,
  'anon não executa o hook (não serve para descobrir e-mails convidados)');
reset role;

select ok(has_function_privilege('supabase_auth_admin', 'public.validar_cadastro_por_convite(jsonb)', 'execute'),
  'supabase_auth_admin executa o hook');

select * from finish();
rollback;
