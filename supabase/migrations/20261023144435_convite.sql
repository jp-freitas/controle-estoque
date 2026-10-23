-- spec-001 T-14: convite (RF-10, RF-12 a RF-14, RN-03, RN-05; CA-08, CA-12, CA-13, CA-17)
-- Ver plan.md → Convite. O e-mail é enviado pelo front (signInWithOtp) depois
-- de convidar_usuario; o hook before_user_created (T-18) barra quem não tem convite.

create table public.convite (
  id            uuid primary key default gen_random_uuid(),
  email         extensions.citext not null check (email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  nome          text not null check (length(btrim(nome)) > 0),
  matricula     text check (matricula is null or length(btrim(matricula)) > 0),
  perfil        public.perfil not null default 'solicitante',
  convidado_por uuid not null references public.profiles (id),
  criado_em     timestamptz not null default now(),
  expira_em     timestamptz not null default now() + interval '7 days',
  aceito_em     timestamptz,
  cancelado_em  timestamptz,
  check (not (aceito_em is not null and cancelado_em is not null))
);

comment on table public.convite is 'Convites de acesso (spec-001/RF-10). Escrita só por RPC.';

-- Unicidade de convite "em aberto" depende de now() e fica nas RPCs (plan.md);
-- estes índices servem às buscas por e-mail e matrícula.
create index convite_email_idx on public.convite (email);
create index convite_matricula_idx on public.convite (matricula) where matricula is not null;
create index convite_convidado_por_idx on public.convite (convidado_por);

alter table public.convite enable row level security;

create policy convite_select_admin on public.convite
  for select to authenticated
  using ((select public.eh_admin_ativo()));

revoke all on public.convite from anon;
revoke insert, update, delete, truncate on public.convite from authenticated;

-- Em aberto = não aceito, não cancelado, não expirado (RF-14)
create function public.convite_em_aberto(c public.convite)
returns boolean
language sql
stable
set search_path = ''
as $$
  select c.aceito_em is null and c.cancelado_em is null and c.expira_em > now();
$$;

-- RF-13: situação derivada das datas, sem job de expiração
create view public.convite_situacao
with (security_invoker = true)
as
select
  c.*,
  case
    when c.aceito_em is not null then 'aceito'
    when c.cancelado_em is not null then 'cancelado'
    when c.expira_em <= now() then 'expirado'
    else 'enviado'
  end as situacao
from public.convite c;

revoke all on public.convite_situacao from anon;
revoke insert, update, delete, truncate on public.convite_situacao from authenticated;

-- Locks consultivos (P-04): serializam convites e edições pelo mesmo e-mail ou
-- matrícula. Ordem fixa — e-mail antes de matrícula — para não haver deadlock.
create function public.travar_email_convite(p_email text)
returns void
language sql
set search_path = ''
as $$
  select pg_advisory_xact_lock(1001, hashtext(lower(p_email)));
$$;

create function public.travar_matricula(p_matricula text)
returns void
language sql
set search_path = ''
as $$
  select pg_advisory_xact_lock(1002, hashtext(p_matricula));
$$;

revoke execute on function public.travar_email_convite(text) from public, anon, authenticated;
revoke execute on function public.travar_matricula(text) from public, anon, authenticated;

-- RN-05: matrícula em uso por usuário (exceto p_ignorar) ou por convite em aberto
create function public.matricula_em_uso(p_matricula text, p_ignorar uuid default null)
returns boolean
language sql
stable
set search_path = ''
as $$
  select exists (select 1 from public.profiles p where p.matricula = p_matricula and p.id is distinct from p_ignorar)
      or exists (select 1 from public.convite c where c.matricula = p_matricula and public.convite_em_aberto(c));
$$;

revoke execute on function public.matricula_em_uso(text, uuid) from public, anon, authenticated;

-- RF-10, RF-14, RN-03, RN-05
create function public.convidar_usuario(
  p_email     text,
  p_nome      text,
  p_matricula text,
  p_perfil    public.perfil default 'solicitante'
)
returns public.convite
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email     text := lower(btrim(p_email));
  v_nome      text := btrim(p_nome);
  v_matricula text := nullif(btrim(p_matricula), '');
  v_convite   public.convite;
begin
  if not public.eh_admin_ativo() then
    raise exception using errcode = 'P0001', message = 'Apenas administradores ativos podem gerenciar convites.';
  end if;

  if v_email is null or v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception using errcode = 'P0001', message = 'E-mail inválido.';
  end if;
  if v_nome is null or v_nome = '' then
    raise exception using errcode = 'P0001', message = 'Informe o nome.';
  end if;

  perform public.travar_email_convite(v_email);
  if v_matricula is not null then
    perform public.travar_matricula(v_matricula);
  end if;

  -- citext com search_path vazio: o operador fica em extensions; sem qualificar,
  -- o Postgres cai em text = text e passa a diferenciar maiúsculas (RN-03).
  -- "Já tem conta" é profiles, não auth.users: o convidado entra em auth.users
  -- já no envio do e-mail (plan.md → Achados do spike T-01).
  if exists (select 1 from public.profiles p where p.email operator(extensions.=) v_email::extensions.citext) then
    raise exception using errcode = 'P0001', message = 'Já existe uma conta com este e-mail.';
  end if;
  if exists (select 1 from public.convite c
             where c.email operator(extensions.=) v_email::extensions.citext and public.convite_em_aberto(c)) then
    raise exception using errcode = 'P0001', message = 'Já existe um convite em aberto para este e-mail.';
  end if;
  if v_matricula is not null and public.matricula_em_uso(v_matricula) then
    raise exception using errcode = 'P0001', message = 'Matrícula já cadastrada.';
  end if;

  insert into public.convite (email, nome, matricula, perfil, convidado_por)
  values (v_email, v_nome, v_matricula, coalesce(p_perfil, 'solicitante'), (select auth.uid()))
  returning * into v_convite;

  return v_convite;
end;
$$;

-- RF-13
create function public.cancelar_convite(p_id uuid)
returns public.convite
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_convite public.convite;
begin
  if not public.eh_admin_ativo() then
    raise exception using errcode = 'P0001', message = 'Apenas administradores ativos podem gerenciar convites.';
  end if;

  select * into v_convite from public.convite c where c.id = p_id for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'Convite não encontrado.';
  end if;
  if v_convite.aceito_em is not null then
    raise exception using errcode = 'P0001', message = 'Este convite já foi aceito e não pode ser cancelado.';
  end if;
  if v_convite.cancelado_em is not null then
    raise exception using errcode = 'P0001', message = 'Este convite já foi cancelado.';
  end if;

  update public.convite set cancelado_em = now() where id = p_id
  returning * into v_convite;

  return v_convite;
end;
$$;

revoke execute on function public.convidar_usuario(text, text, text, public.perfil) from public, anon;
revoke execute on function public.cancelar_convite(uuid) from public, anon;
grant execute on function public.convidar_usuario(text, text, text, public.perfil) to authenticated;
grant execute on function public.cancelar_convite(uuid) to authenticated;

-- RN-05 na edição de perfil (achado da T-12): a matrícula também não pode ser
-- a de um convite em aberto. Mesmo lock por matrícula de convidar_usuario.
create or replace function public.aplicar_edicao_perfil(p_id uuid, p_nome text, p_matricula text)
returns public.profiles
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_nome      text := btrim(p_nome);
  v_matricula text := nullif(btrim(p_matricula), '');
  v_perfil    public.profiles;
begin
  if v_nome is null or v_nome = '' then
    raise exception using errcode = 'P0001', message = 'Informe o nome.';
  end if;

  if v_matricula is not null then
    perform public.travar_matricula(v_matricula);
    if public.matricula_em_uso(v_matricula, p_id) then
      raise exception using errcode = 'P0001', message = 'Matrícula já cadastrada.';
    end if;
  end if;

  update public.profiles
     set nome = v_nome, matricula = v_matricula
   where id = p_id
  returning * into v_perfil;

  if not found then
    raise exception using errcode = 'P0001', message = 'Usuário não encontrado.';
  end if;

  return v_perfil;
exception
  when unique_violation then
    -- CA-17 / RN-05 (índice profiles_matricula_key), como última barreira
    raise exception using errcode = 'P0001', message = 'Matrícula já cadastrada.';
end;
$$;
