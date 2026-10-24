-- spec-004 T-10: leitura do admin (RF-03, RF-13, RF-14; CA-12)
-- security_invoker: a RLS de solicitacao, profiles e item vale; o filtro eh_admin_ativo()
-- deixa o professor fora mesmo das próprias pendentes. Uma linha por solicitação, com
-- os itens em jsonb, para a tela não precisar juntar.

create view public.fila_aprovacao
with (security_invoker = true) as
select
  s.id,
  s.criado_em,
  s.justificativa,
  s.solicitante_id,
  p.nome   as solicitante_nome,
  -- RF-14: a fila mostra quem deixou de estar ativo
  p.status as solicitante_status,
  (select jsonb_agg(jsonb_build_object(
            'solicitacao_item_id', l.id,
            'item_id', l.item_id,
            'item_nome', l.item_nome,
            'quantidade_solicitada', l.quantidade_solicitada,
            'disponivel', i.quantidade_total - i.quantidade_reservada - i.quantidade_em_uso,
            'operante', i.operante,
            'ativo', i.ativo) order by l.item_nome)
     from public.solicitacao_item l
     join public.item i on i.id = l.item_id
    where l.solicitacao_id = s.id) as itens
from public.solicitacao s
join public.profiles p on p.id = s.solicitante_id
where s.status = 'pendente'
  and (select public.eh_admin_ativo());

-- RF-13 / CA-12: sem expiração; o admin vê há quantos dias e cancela se preciso
create view public.aprovadas_aguardando_retirada
with (security_invoker = true) as
select
  s.id,
  s.criado_em,
  s.data_decisao,
  current_date - s.data_decisao::date as dias_aguardando,
  s.justificativa,
  s.observacao_decisao,
  s.solicitante_id,
  p.nome  as solicitante_nome,
  a.nome  as aprovador_nome,
  (select jsonb_agg(jsonb_build_object(
            'solicitacao_item_id', l.id,
            'item_id', l.item_id,
            'item_nome', l.item_nome,
            'quantidade_aprovada', l.quantidade_aprovada) order by l.item_nome)
     from public.solicitacao_item l
    where l.solicitacao_id = s.id and l.quantidade_aprovada > 0) as itens
from public.solicitacao s
join public.profiles p on p.id = s.solicitante_id
left join public.profiles a on a.id = s.aprovador_id
where s.status = 'aprovada'
  and (select public.eh_admin_ativo());

revoke all on public.fila_aprovacao, public.aprovadas_aguardando_retirada from anon, authenticated;
grant select on public.fila_aprovacao, public.aprovadas_aguardando_retirada to authenticated;
