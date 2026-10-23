-- spec-002 T-12: view catalogo (RF-10, RF-11; CA-05, CA-10)
-- security_invoker: a RLS de item decide o que cada um vê (não-admin, só ativos).
-- Ponto único de leitura do catálogo para as specs 003 (carrinho) e 007.

create view public.catalogo
with (security_invoker = true) as
select
  i.id,
  i.nome,
  i.descricao,
  i.tipo_id,
  t.nome::text as tipo_nome,
  t.consumivel,
  i.local_id,
  l.nome::text as local_nome,
  i.quantidade_total,
  i.quantidade_reservada,
  i.quantidade_em_uso,
  i.quantidade_total - i.quantidade_reservada - i.quantidade_em_uso as disponivel,
  i.operante,
  i.estado,
  i.numero_patrimonio,
  i.estoque_minimo,
  i.ativo,
  i.atualizado_em
from public.item i
join public.tipo_item t on t.id = i.tipo_id
join public.local l on l.id = i.local_id;

revoke all on public.catalogo from anon, authenticated;
grant select on public.catalogo to authenticated;
