-- spec-001 T-03: perfis, auditoria e helpers de permissão
-- RF-02, RN-03, RN-05; spec-006/RF-01, RF-10 a RF-12; constituição P-02, P-06.

create extension if not exists citext with schema extensions;

-- Enums ----------------------------------------------------------------------

create type public.perfil as enum ('admin', 'solicitante');
create type public.status_usuario as enum ('pendente', 'ativo', 'inativo');

-- Utilitário: atualizado_em --------------------------------------------------

create function public.definir_atualizado_em()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.atualizado_em := now();
  return new;
end;
$$;

-- profiles (RF-02) -----------------------------------------------------------

create table public.profiles (
  id            uuid primary key references auth.users (id),
  nome          text not null check (length(btrim(nome)) > 0),
  email         extensions.citext not null unique,
  matricula     text check (matricula is null or length(btrim(matricula)) > 0),
  perfil        public.perfil not null default 'solicitante',
  status        public.status_usuario not null default 'pendente',
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

comment on table public.profiles is 'Usuários do sistema (spec-001/RF-02). Escrita só por RPC.';

-- RN-05: matrícula única quando preenchida
create unique index profiles_matricula_key on public.profiles (matricula) where matricula is not null;

create trigger profiles_definir_atualizado_em
  before update on public.profiles
  for each row execute function public.definir_atualizado_em();

-- Políticas de profiles ficam em T-08; até lá, RLS sem política = nada acessível.
alter table public.profiles enable row level security;

-- Helpers de permissão (usados em políticas e RPCs) -------------------------
-- SECURITY DEFINER para ler profiles sem depender da RLS de profiles.
-- Só respondem sobre o próprio auth.uid(), então podem ser chamados por authenticated.

create function public.eh_admin_ativo()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.perfil = 'admin' and p.status = 'ativo'
  );
$$;

create function public.usuario_ativo()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.status = 'ativo'
  );
$$;

revoke execute on function public.eh_admin_ativo() from public, anon;
revoke execute on function public.usuario_ativo() from public, anon;
grant execute on function public.eh_admin_ativo() to authenticated;
grant execute on function public.usuario_ativo() to authenticated;

-- auditoria (spec-006/RF-01) -------------------------------------------------

create table public.auditoria (
  id               bigint generated always as identity primary key,
  tabela           text not null,
  registro_id      uuid not null,
  acao             text not null check (acao in ('INSERT', 'UPDATE', 'DELETE')),
  usuario_id       uuid,  -- nulo = "Sistema" (spec-006/RF-04)
  dados_antes      jsonb,
  dados_depois     jsonb,
  campos_alterados text[],
  motivo           text,
  criado_em        timestamptz not null default now()
);

comment on table public.auditoria is 'Trilha imutável de alterações (spec-006). Gravada só pelo trigger auditar().';

create index auditoria_tabela_registro_idx on public.auditoria (tabela, registro_id, criado_em desc);
create index auditoria_usuario_idx on public.auditoria (usuario_id);
create index auditoria_criado_em_idx on public.auditoria (criado_em);

-- spec-006/RF-10: leitura só para admin ativo; sem escrita pela aplicação
alter table public.auditoria enable row level security;

create policy auditoria_select_admin on public.auditoria
  for select to authenticated
  using ((select public.eh_admin_ativo()));

revoke all on public.auditoria from anon;
revoke insert, update, delete, truncate on public.auditoria from authenticated;

-- spec-006/RF-12: imutável, inclusive para service_role
create function public.bloquear_alteracao_auditoria()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception using
    errcode = 'P0001',
    message = 'A auditoria não pode ser alterada nem apagada.';
end;
$$;

create trigger auditoria_imutavel
  before update or delete on public.auditoria
  for each row execute function public.bloquear_alteracao_auditoria();

create trigger auditoria_imutavel_truncate
  before truncate on public.auditoria
  for each statement execute function public.bloquear_alteracao_auditoria();
