-- spec-004 T-02: colunas de decisão em solicitacao e solicitacao_item (RF-04, RF-08, RF-10, RF-11; CA-06)
-- Escritas só pelas RPCs desta spec (as tabelas não têm escrita direta desde a 003).

alter table public.solicitacao
  add column aprovador_id        uuid references public.profiles (id),
  add column data_decisao        timestamptz,
  -- OPEN-01: observação geral da aprovação, visível ao professor
  add column observacao_decisao  text,
  add column motivo_recusa       text,
  add column cancelado_por_id    uuid references public.profiles (id),
  add column motivo_cancelamento text,
  add constraint solicitacao_motivo_recusa_check
    check (status <> 'recusada' or btrim(coalesce(motivo_recusa, '')) <> '');

alter table public.solicitacao_item
  add column quantidade_aprovada integer,
  add constraint solicitacao_item_quantidade_aprovada_check
    check (quantidade_aprovada between 0 and quantidade_solicitada);
