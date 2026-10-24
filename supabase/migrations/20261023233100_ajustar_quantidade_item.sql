-- spec-002 T-06: ajuste manual de quantidade (RF-07, RF-09; CA-04; P-01, P-04, P-05)
-- Único caminho para mudar quantidade_total fora dos movimentos de estoque.
-- Não marca app.origem: o ajuste é auditado com o motivo (spec-006/CA-06).

create function public.ajustar_quantidade_item(p_item_id uuid, p_nova_quantidade integer, p_motivo text)
returns public.item
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item     public.item;
  v_anterior integer;
  v_motivo   text := nullif(btrim(p_motivo), '');
begin
  if not public.eh_admin_ativo() then
    raise exception using errcode = 'P0001', message = 'Apenas administradores ativos podem ajustar o estoque.';
  end if;
  if v_motivo is null then
    raise exception using errcode = 'P0001', message = 'Informe o motivo do ajuste.';
  end if;
  if p_nova_quantidade is null or p_nova_quantidade < 0 then
    raise exception using errcode = 'P0001', message = 'A quantidade não pode ser negativa.';
  end if;

  -- P-04
  select * into v_item from public.item where id = p_item_id for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'Item não encontrado.';
  end if;

  if p_nova_quantidade = v_item.quantidade_total then
    raise exception using errcode = 'P0001', message = 'A quantidade informada é igual à atual.';
  end if;
  -- CA-04
  if p_nova_quantidade < v_item.quantidade_reservada + v_item.quantidade_em_uso then
    raise exception using errcode = 'P0001',
      message = format('A quantidade não pode ficar menor que o reservado mais o em uso (%s).',
                       v_item.quantidade_reservada + v_item.quantidade_em_uso);
  end if;
  -- RF-07
  if v_item.numero_patrimonio is not null and p_nova_quantidade > 1 then
    raise exception using errcode = 'P0001', message = 'Item com número de patrimônio deve ter quantidade 1.';
  end if;

  v_anterior := v_item.quantidade_total;
  perform set_config('app.motivo', v_motivo, true);
  update public.item set quantidade_total = p_nova_quantidade where id = p_item_id
  returning * into v_item;
  perform set_config('app.motivo', '', true);

  -- RF-09 / P-05: diferença com sinal
  insert into public.movimentacao (item_id, tipo, quantidade, motivo, usuario_id)
  values (p_item_id, 'ajuste', p_nova_quantidade - v_anterior, v_motivo, auth.uid());

  return v_item;
end;
$$;

revoke execute on function public.ajustar_quantidade_item(uuid, integer, text) from public, anon;
grant execute on function public.ajustar_quantidade_item(uuid, integer, text) to authenticated;
