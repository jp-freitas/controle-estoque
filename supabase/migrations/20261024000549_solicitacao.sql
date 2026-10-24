-- spec-003 T-03: solicitação de retirada (RF-01, RF-03, RF-06, RF-10, RF-11; CA-04, CA-07, CA-08; P-02)
--
-- Escrita só pelas RPCs (enviar_solicitacao, cancelar_solicitacao e as das specs
-- 004 e 005). As colunas de decisão e de retirada entram por migrations dessas specs.

create type public.status_solicitacao as enum
  ('pendente', 'aprovada', 'retirada', 'concluida', 'cancelada', 'recusada');

create table public.solicitacao (
  id             uuid primary key default gen_random_uuid(),
  solicitante_id uuid not null references public.profiles (id),
  status         public.status_solicitacao not null default 'pendente',
  justificativa  text not null,
  criado_em      timestamptz not null default now(),
  cancelado_em   timestamptz,
  -- RF-06 / CA-04
  constraint solicitacao_justificativa_check check (char_length(btrim(justificativa)) between 3 and 500)
);

create index solicitacao_solicitante_criado_idx on public.solicitacao (solicitante_id, criado_em desc);
-- fila de aprovação (spec 004)
create index solicitacao_status_criado_idx on public.solicitacao (status, criado_em);

create table public.solicitacao_item (
  id                    uuid primary key default gen_random_uuid(),
  solicitacao_id        uuid not null references public.solicitacao (id) on delete restrict,
  item_id               uuid not null references public.item (id) on delete restrict,
  -- cópia do nome no envio: o professor não lê item desativado (spec-002/CA-10)
  item_nome             text not null,
  quantidade_solicitada integer not null,
  constraint solicitacao_item_quantidade_check check (quantidade_solicitada >= 1),
  -- RF-03
  constraint solicitacao_item_unico unique (solicitacao_id, item_id)
);

create index solicitacao_item_item_id_idx on public.solicitacao_item (item_id);

-- movimentacao.solicitacao_id existe desde a spec 002; a FK entra agora
alter table public.movimentacao
  add constraint movimentacao_solicitacao_id_fkey
  foreign key (solicitacao_id) references public.solicitacao (id) on delete restrict;

-- RLS (RF-10, CA-07, CA-08): dono ativo vê as próprias; admin ativo vê todas.
alter table public.solicitacao enable row level security;
alter table public.solicitacao_item enable row level security;

create policy solicitacao_select on public.solicitacao
  for select to authenticated
  using (
    (solicitante_id = (select auth.uid()) and (select public.usuario_ativo()))
    or (select public.eh_admin_ativo())
  );

-- a subconsulta passa pela RLS de solicitacao
create policy solicitacao_item_select on public.solicitacao_item
  for select to authenticated
  using (exists (select 1 from public.solicitacao s where s.id = solicitacao_id));

-- RF-11: nenhuma escrita direta
revoke all on public.solicitacao, public.solicitacao_item from anon, authenticated;
grant select on public.solicitacao, public.solicitacao_item to authenticated;
