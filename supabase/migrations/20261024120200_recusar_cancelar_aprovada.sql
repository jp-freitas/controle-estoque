-- spec-004 T-07: recusar e cancelar solicitação aprovada (RF-01, RF-02, RF-08 a RF-10, RN-03;
-- CA-06, CA-08, CA-13; P-04, P-05)

-- RF-08: recusa não mexe no estoque. Vale também para solicitante inativado (CA-13).
create function public.recusar_solicitacao(p_id uuid, p_motivo text)
returns public.solicitacao
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sol    public.solicitacao;
  v_motivo text := nullif(btrim(p_motivo), '');
begin
  if not public.eh_admin_ativo() then
    raise exception using errcode = 'P0001', message = 'Apenas administradores ativos podem recusar solicitações.';
  end if;
  -- CA-06
  if v_motivo is null then
    raise exception using errcode = 'P0001', message = 'Informe o motivo da recusa.';
  end if;

  select * into v_sol from public.solicitacao where id = p_id for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'Solicitação não encontrada.';
  end if;
  -- RF-09
  if v_sol.status <> 'pendente' then
    raise exception using errcode = 'P0001', message = 'Só solicitações pendentes podem ser recusadas.';
  end if;
  -- RF-02
  if v_sol.solicitante_id = auth.uid() then
    raise exception using errcode = 'P0001',
      message = 'Você não pode decidir a própria solicitação. Peça a outro administrador.';
  end if;

  update public.solicitacao
     set status = 'recusada', aprovador_id = auth.uid(), data_decisao = now(), motivo_recusa = v_motivo
   where id = p_id
  returning * into v_sol;

  return v_sol;
end;
$$;

-- RF-10 / RN-03: devolve a reserva ao estoque. Trava a solicitação e depois os itens
-- em ordem de id (P-04), como a aprovação.
create function public.cancelar_solicitacao_aprovada(p_id uuid, p_motivo text)
returns public.solicitacao
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sol    public.solicitacao;
  v_motivo text := nullif(btrim(p_motivo), '');
begin
  if not public.eh_admin_ativo() then
    raise exception using errcode = 'P0001',
      message = 'Apenas administradores ativos podem cancelar solicitações aprovadas.';
  end if;
  if v_motivo is null then
    raise exception using errcode = 'P0001', message = 'Informe o motivo do cancelamento.';
  end if;

  select * into v_sol from public.solicitacao where id = p_id for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'Solicitação não encontrada.';
  end if;
  if v_sol.status <> 'aprovada' then
    raise exception using errcode = 'P0001',
      message = 'Só solicitações aprovadas e ainda não retiradas podem ser canceladas aqui.';
  end if;

  perform 1 from public.item
    where id in (select item_id from public.solicitacao_item where solicitacao_id = p_id)
    order by id
    for update;

  perform set_config('app.origem', 'movimentacao', true);
  update public.item i
     set quantidade_reservada = i.quantidade_reservada - l.quantidade_aprovada
    from public.solicitacao_item l
   where l.solicitacao_id = p_id and l.item_id = i.id and l.quantidade_aprovada > 0;
  perform set_config('app.origem', '', true);

  insert into public.movimentacao (item_id, solicitacao_id, tipo, quantidade, usuario_id, motivo)
  select l.item_id, p_id, 'liberacao_reserva', l.quantidade_aprovada, auth.uid(), v_motivo
    from public.solicitacao_item l
   where l.solicitacao_id = p_id and l.quantidade_aprovada > 0;

  update public.solicitacao
     set status = 'cancelada', cancelado_em = now(), cancelado_por_id = auth.uid(), motivo_cancelamento = v_motivo
   where id = p_id
  returning * into v_sol;

  return v_sol;
end;
$$;

revoke execute on function public.recusar_solicitacao(uuid, text) from public, anon;
revoke execute on function public.cancelar_solicitacao_aprovada(uuid, text) from public, anon;
grant execute on function public.recusar_solicitacao(uuid, text) to authenticated;
grant execute on function public.cancelar_solicitacao_aprovada(uuid, text) to authenticated;
