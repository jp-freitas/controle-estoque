-- Dados de exemplo para desenvolvimento local (aplicados por `supabase db reset`).
-- Nunca coloque dados reais aqui.

-- spec-001 T-06 / RN-01: primeiro admin criado sem convite, mais um solicitante
-- de cada status. Senha de todos (só dev): Senha!123
with usuarios (id, email, nome, matricula, perfil, status) as (
  values
    ('00000000-0000-4000-8000-000000000001'::uuid, 'admin@escola.test',    'Admin da Escola', null,     'admin'::public.perfil,       'ativo'::public.status_usuario),
    ('00000000-0000-4000-8000-000000000002'::uuid, 'ativo@escola.test',    'Prof. Ativo',     'M-1001', 'solicitante'::public.perfil, 'ativo'::public.status_usuario),
    ('00000000-0000-4000-8000-000000000003'::uuid, 'pendente@escola.test', 'Prof. Pendente',  null,     'solicitante'::public.perfil, 'pendente'::public.status_usuario),
    ('00000000-0000-4000-8000-000000000004'::uuid, 'inativo@escola.test',  'Prof. Inativo',   'M-1004', 'solicitante'::public.perfil, 'inativo'::public.status_usuario)
),
novos_users as (
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    -- o Auth não aceita NULL nestes campos ao ler o usuário
    confirmation_token, recovery_token, email_change_token_new, email_change
  )
  select
    '00000000-0000-0000-0000-000000000000', u.id, 'authenticated', 'authenticated', u.email,
    extensions.crypt('Senha!123', extensions.gen_salt('bf')), now(),
    '{"provider": "email", "providers": ["email"]}', '{}', now(), now(),
    '', '', '', ''
  from usuarios u
  returning id
),
novas_identidades as (
  insert into auth.identities (id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at)
  select gen_random_uuid(), u.id, u.id::text, 'email',
         jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
         now(), now(), now()
  from usuarios u
  join novos_users n on n.id = u.id
  returning user_id
)
insert into public.profiles (id, nome, email, matricula, perfil, status)
select u.id, u.nome, u.email, u.matricula, u.perfil, u.status
from usuarios u
join novas_identidades i on i.user_id = u.id;
