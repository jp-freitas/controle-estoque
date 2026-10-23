-- spec-001 T-02: estrutura de profiles e auditoria (RF-02, RN-05; spec-006/RF-01, RF-10)
begin;
create extension if not exists pgtap with schema extensions;
select plan(37);

-- Enums
select has_enum('public', 'perfil', 'RF-02: enum perfil existe');
select enum_has_labels('public', 'perfil', array['admin', 'solicitante'], 'RF-02: perfil = admin | solicitante');
select has_enum('public', 'status_usuario', 'RF-02: enum status_usuario existe');
select enum_has_labels('public', 'status_usuario', array['pendente', 'ativo', 'inativo'],
  'RF-02: status_usuario = pendente | ativo | inativo');

-- profiles
select has_table('public', 'profiles', 'RF-02: tabela profiles existe');
select col_is_pk('public', 'profiles', 'id', 'profiles.id é PK');
select col_type_is('public', 'profiles', 'id', 'uuid', 'profiles.id é uuid');
select fk_ok('public', 'profiles', 'id', 'auth', 'users', 'id', 'profiles.id referencia auth.users');
select col_type_is('public', 'profiles', 'nome', 'text', 'profiles.nome é text');
select col_not_null('public', 'profiles', 'nome', 'profiles.nome é obrigatório');
select col_type_is('public', 'profiles', 'email', 'extensions.citext', 'RN-03: profiles.email é citext');
select col_not_null('public', 'profiles', 'email', 'profiles.email é obrigatório');
select col_is_unique('public', 'profiles', 'email', 'profiles.email é único');
select col_type_is('public', 'profiles', 'matricula', 'text', 'profiles.matricula é text');
select col_is_null('public', 'profiles', 'matricula', 'RN-05: profiles.matricula é opcional');
select col_type_is('public', 'profiles', 'perfil', 'perfil', 'profiles.perfil usa o enum perfil');
select col_default_is('public', 'profiles', 'perfil', 'solicitante', 'profiles.perfil padrão = solicitante');
select col_type_is('public', 'profiles', 'status', 'status_usuario', 'profiles.status usa o enum status_usuario');
select col_default_is('public', 'profiles', 'status', 'pendente', 'RN-04: profiles.status padrão = pendente');
select col_not_null('public', 'profiles', 'criado_em', 'profiles.criado_em é obrigatório');
select col_not_null('public', 'profiles', 'atualizado_em', 'profiles.atualizado_em é obrigatório');

select ok(
  exists (
    select 1 from pg_indexes
    where schemaname = 'public' and tablename = 'profiles'
      and indexdef ilike 'create unique index%(matricula)%where (matricula is not null)'
  ),
  'RN-05: índice único parcial em profiles(matricula) where matricula is not null'
);

-- auditoria (spec-006/RF-01)
select has_table('public', 'auditoria', 'spec-006/RF-01: tabela auditoria existe');
select columns_are('public', 'auditoria', array[
  'id', 'tabela', 'registro_id', 'acao', 'usuario_id', 'dados_antes', 'dados_depois',
  'campos_alterados', 'motivo', 'criado_em'
], 'spec-006/RF-01: colunas de auditoria');
select col_type_is('public', 'auditoria', 'dados_antes', 'jsonb', 'auditoria.dados_antes é jsonb');
select col_type_is('public', 'auditoria', 'campos_alterados', 'text[]', 'auditoria.campos_alterados é text[]');
select col_is_null('public', 'auditoria', 'usuario_id', 'spec-006/RF-04: usuario_id anulável ("Sistema")');
select col_has_check('public', 'auditoria', 'acao', 'auditoria.acao restrita a INSERT/UPDATE/DELETE');
select has_index('public', 'auditoria', 'auditoria_tabela_registro_idx', 'índice por (tabela, registro_id, criado_em)');

-- RLS habilitado (P-02)
select ok(
  (select relrowsecurity from pg_class where oid = 'public.profiles'::regclass),
  'P-02: RLS habilitado em profiles'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.auditoria'::regclass),
  'P-02: RLS habilitado em auditoria'
);

-- Helpers: SECURITY DEFINER com search_path fixo
select has_function('public', 'eh_admin_ativo', '{}'::name[], 'eh_admin_ativo() existe');
select is_definer('public', 'eh_admin_ativo', '{}'::name[], 'eh_admin_ativo() é SECURITY DEFINER');
select has_function('public', 'usuario_ativo', '{}'::name[], 'usuario_ativo() existe');
select is_definer('public', 'usuario_ativo', '{}'::name[], 'usuario_ativo() é SECURITY DEFINER');
select ok(
  (select bool_and(exists (select 1 from unnest(p.proconfig) c where c like 'search_path=%'))
   from pg_proc p
   where p.pronamespace = 'public'::regnamespace and p.proname in ('eh_admin_ativo', 'usuario_ativo')),
  'helpers fixam search_path'
);

-- Privilégios: ninguém da aplicação escreve direto na auditoria (spec-006/RF-10)
select ok(
  not has_table_privilege('authenticated', 'public.auditoria', 'INSERT, UPDATE, DELETE, TRUNCATE')
  and not has_table_privilege('anon', 'public.auditoria', 'INSERT, UPDATE, DELETE, TRUNCATE'),
  'spec-006/RF-10: anon e authenticated sem privilégio de escrita em auditoria'
);

select * from finish();
rollback;
