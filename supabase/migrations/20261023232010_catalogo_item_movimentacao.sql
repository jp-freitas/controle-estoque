-- spec-002 T-04: item e movimentação (RF-05 a RF-08, RF-14, RN-01, RN-03 a RN-05;
-- CA-01 a CA-03, CA-06, CA-08, CA-10, CA-12 a CA-14; P-01, P-03, P-05)

create type public.estado_item as enum ('novo', 'bom', 'regular', 'ruim');

create table public.item (
  id                   uuid primary key default gen_random_uuid(),
  nome                 text not null,
  tipo_id              uuid not null references public.tipo_item (id) on delete restrict,
  local_id             uuid not null references public.local (id) on delete restrict,
  quantidade_total     integer not null,
  quantidade_reservada integer not null default 0,
  quantidade_em_uso    integer not null default 0,
  operante             boolean not null default true,
  estado               public.estado_item,
  numero_patrimonio    text,
  descricao            text,
  estoque_minimo       integer,
  ativo                boolean not null default true,
  criado_em            timestamptz not null default now(),
  atualizado_em        timestamptz not null default now(),
  constraint item_nome_check check (btrim(nome) <> ''),
  constraint item_quantidade_total_check check (quantidade_total >= 0),
  constraint item_quantidade_reservada_check check (quantidade_reservada >= 0),
  constraint item_quantidade_em_uso_check check (quantidade_em_uso >= 0),
  constraint item_estoque_minimo_check check (estoque_minimo >= 0),
  -- P-03
  constraint item_estoque_check check (quantidade_reservada + quantidade_em_uso <= quantidade_total),
  -- RF-07: patrimônio = uma unidade física (0 só depois de baixa, spec 005)
  constraint item_patrimonio_unidade_check check (numero_patrimonio is null or quantidade_total <= 1)
);

-- CA-02
create unique index item_numero_patrimonio_key on public.item (numero_patrimonio)
  where numero_patrimonio is not null;
create index item_tipo_id_idx on public.item (tipo_id);
create index item_local_id_idx on public.item (local_id);

create trigger item_definir_atualizado_em
  before update on public.item
  for each row execute function public.definir_atualizado_em();

-- Regras de cadastro que dependem de outras linhas ou do momento (insert x update).
-- RN-05: tipo e local são lidos com FOR SHARE, que espera o lock do update que os
-- desativa (ou muda consumivel) e vice-versa; assim as regras valem sob concorrência.
create function public.validar_item()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tipo  public.tipo_item;
  v_local public.local;
  v_novo  boolean := tg_op = 'INSERT';
begin
  new.numero_patrimonio := nullif(btrim(new.numero_patrimonio), '');

  -- CA-01 / RF-07
  if new.numero_patrimonio is not null and new.quantidade_total > 1
     or v_novo and new.numero_patrimonio is not null and new.quantidade_total <> 1 then
    raise exception using errcode = 'P0001',
      message = 'Item com número de patrimônio deve ter quantidade 1.';
  end if;

  if v_novo or new.tipo_id is distinct from old.tipo_id
     or new.ativo and not old.ativo
     or new.estoque_minimo is distinct from old.estoque_minimo then
    select * into v_tipo from public.tipo_item where id = new.tipo_id for share;
  end if;
  if new.ativo and (v_novo or new.local_id is distinct from old.local_id or not old.ativo) then
    select * into v_local from public.local where id = new.local_id for share;
  end if;

  -- CA-12 / RN-03: item ativo sempre em tipo e local ativos
  if new.ativo and v_tipo.id is not null and not v_tipo.ativo then
    raise exception using errcode = 'P0001', message = 'Tipo desativado.';
  end if;
  if v_local.id is not null and not v_local.ativo then
    raise exception using errcode = 'P0001', message = 'Local desativado.';
  end if;

  -- spec-007/RF-08: estoque mínimo só para consumível
  if new.estoque_minimo is not null and v_tipo.id is not null and not v_tipo.consumivel then
    raise exception using errcode = 'P0001',
      message = 'Estoque mínimo só vale para tipos consumíveis.';
  end if;

  return new;
end;
$$;

revoke execute on function public.validar_item() from public, anon, authenticated;

create trigger item_validar
  before insert or update on public.item
  for each row execute function public.validar_item();

-- CA-13 / RN-03 e CA-14 / RN-04: o lado de tipo e local
create function public.validar_tipo_local()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_itens jsonb;
  v_n     integer;
  v_onde  text := case tg_table_name when 'local' then 'neste local' else 'deste tipo' end;
begin
  if old.ativo and not new.ativo then
    select jsonb_agg(jsonb_build_object('item_id', i.id, 'nome', i.nome) order by i.nome), count(*)
      into v_itens, v_n
      from public.item i
     where i.ativo
       and case tg_table_name when 'local' then i.local_id else i.tipo_id end = old.id;

    if v_n > 0 then
      raise exception using errcode = 'P0001',
        message = case when v_n = 1
          then format('Há 1 item ativo %s. Mova ou desative esse item antes.', v_onde)
          else format('Há %s itens ativos %s. Mova ou desative esses itens antes.', v_n, v_onde) end,
        detail = v_itens::text;
    end if;
  end if;

  if tg_table_name = 'tipo_item'
     and (to_jsonb(new) -> 'consumivel') is distinct from (to_jsonb(old) -> 'consumivel')
     and exists (select 1 from public.item where tipo_id = old.id) then
    raise exception using errcode = 'P0001',
      message = 'Este tipo já tem itens; não é possível mudar se é consumível.';
  end if;

  return new;
end;
$$;

revoke execute on function public.validar_tipo_local() from public, anon, authenticated;

create trigger tipo_item_validar
  before update on public.tipo_item
  for each row execute function public.validar_tipo_local();
create trigger local_validar
  before update on public.local
  for each row execute function public.validar_tipo_local();

-- RLS e privilégios (RN-01, CA-06, CA-10; P-01, RF-06, RF-14)
alter table public.item enable row level security;

create policy item_select on public.item
  for select to authenticated
  using ((select public.eh_admin_ativo()) or (ativo and (select public.usuario_ativo())));
create policy item_insert_admin on public.item
  for insert to authenticated
  with check ((select public.eh_admin_ativo()));
create policy item_update_admin on public.item
  for update to authenticated
  using ((select public.eh_admin_ativo()))
  with check ((select public.eh_admin_ativo()));
create policy item_delete_admin on public.item
  for delete to authenticated
  using ((select public.eh_admin_ativo()));

revoke all on public.item from anon, authenticated;
grant select, delete on public.item to authenticated;
-- quantidade_total só no cadastro (CA-03); depois, só por ajustar_quantidade_item
grant insert (id, nome, tipo_id, local_id, quantidade_total, estado, numero_patrimonio, descricao, estoque_minimo, ativo)
  on public.item to authenticated;
grant update (nome, tipo_id, local_id, estado, numero_patrimonio, descricao, estoque_minimo, ativo)
  on public.item to authenticated;

-- P-05: movimentação --------------------------------------------------------------
create type public.tipo_movimentacao as enum ('ajuste', 'reserva', 'liberacao_reserva', 'retirada', 'devolucao');

create table public.movimentacao (
  id             bigint generated always as identity primary key,
  -- RF-08 / CA-08: item com histórico não é excluído
  item_id        uuid not null references public.item (id) on delete restrict,
  -- FK para solicitacao entra na spec 003
  solicitacao_id uuid,
  tipo           public.tipo_movimentacao not null,
  -- com sinal no ajuste (efeito em quantidade_total); positiva nos demais tipos
  quantidade     integer not null,
  motivo         text,
  usuario_id     uuid not null references public.profiles (id),
  criado_em      timestamptz not null default now(),
  constraint movimentacao_quantidade_check check (quantidade <> 0 and (tipo = 'ajuste' or quantidade > 0)),
  -- RF-09
  constraint movimentacao_ajuste_motivo_check check (tipo <> 'ajuste' or btrim(coalesce(motivo, '')) <> '')
);

create index movimentacao_item_id_idx on public.movimentacao (item_id);
create index movimentacao_solicitacao_id_idx on public.movimentacao (solicitacao_id);
create index movimentacao_criado_em_idx on public.movimentacao (criado_em);
create index movimentacao_usuario_id_idx on public.movimentacao (usuario_id);

create function public.bloquear_alteracao_movimentacao()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception using
    errcode = 'P0001',
    message = 'A movimentação não pode ser alterada nem apagada.';
end;
$$;

create trigger movimentacao_imutavel
  before update or delete on public.movimentacao
  for each row execute function public.bloquear_alteracao_movimentacao();
create trigger movimentacao_imutavel_truncate
  before truncate on public.movimentacao
  for each statement execute function public.bloquear_alteracao_movimentacao();

alter table public.movimentacao enable row level security;

create policy movimentacao_select_admin on public.movimentacao
  for select to authenticated
  using ((select public.eh_admin_ativo()));

revoke all on public.movimentacao from anon, authenticated;
grant select on public.movimentacao to authenticated;
