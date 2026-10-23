-- spec-002 T-02: tipos de item e locais (RF-01 a RF-04, RN-01; CA-06, CA-10; P-02)
--
-- Leitura: admin ativo vê tudo; usuário ativo vê só o que está ativo (CA-10).
-- Escrita: só admin ativo, direto pela API (cadastro não mexe em estoque).
-- Exclusão de tipo/local em uso falha por FK (23503) a partir da tabela item.

create table public.tipo_item (
  id         uuid primary key default gen_random_uuid(),
  nome       extensions.citext not null,
  consumivel boolean not null,
  ativo      boolean not null default true,
  constraint tipo_item_nome_key unique (nome),
  constraint tipo_item_nome_check check (btrim(nome::text) <> '')
);

comment on column public.tipo_item.consumivel is
  'RF-02: consumível baixa o total na retirada; não consumível exige devolução.';

create table public.local (
  id        uuid primary key default gen_random_uuid(),
  nome      extensions.citext not null,
  descricao text,
  ativo     boolean not null default true,
  constraint local_nome_key unique (nome),
  constraint local_nome_check check (btrim(nome::text) <> '')
);

-- RF-01 / RF-02: tipos iniciais na própria migration (produção também precisa deles)
insert into public.tipo_item (nome, consumivel) values
  ('Insumo', true),
  ('Ferramenta', false),
  ('Máquina', false);

alter table public.tipo_item enable row level security;
alter table public.local enable row level security;

create policy tipo_item_select on public.tipo_item
  for select to authenticated
  using ((select public.eh_admin_ativo()) or (ativo and (select public.usuario_ativo())));
create policy tipo_item_insert_admin on public.tipo_item
  for insert to authenticated
  with check ((select public.eh_admin_ativo()));
create policy tipo_item_update_admin on public.tipo_item
  for update to authenticated
  using ((select public.eh_admin_ativo()))
  with check ((select public.eh_admin_ativo()));
create policy tipo_item_delete_admin on public.tipo_item
  for delete to authenticated
  using ((select public.eh_admin_ativo()));

create policy local_select on public.local
  for select to authenticated
  using ((select public.eh_admin_ativo()) or (ativo and (select public.usuario_ativo())));
create policy local_insert_admin on public.local
  for insert to authenticated
  with check ((select public.eh_admin_ativo()));
create policy local_update_admin on public.local
  for update to authenticated
  using ((select public.eh_admin_ativo()))
  with check ((select public.eh_admin_ativo()));
create policy local_delete_admin on public.local
  for delete to authenticated
  using ((select public.eh_admin_ativo()));

revoke all on public.tipo_item, public.local from anon, authenticated;
grant select, insert, update, delete on public.tipo_item, public.local to authenticated;
