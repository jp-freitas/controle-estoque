-- spec-002 T-08: marcar inoperante e reativar (RF-14; CA-11; spec-006/RF-17, CA-17)
-- Também usada pela spec 005 (marcar inoperante na devolução).

create function public.alterar_operancia_item(p_item_id uuid, p_operante boolean, p_motivo text default null)
returns public.item
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item   public.item;
  v_motivo text := nullif(btrim(p_motivo), '');
begin
  if not public.eh_admin_ativo() then
    raise exception using errcode = 'P0001',
      message = 'Apenas administradores ativos podem marcar item como inoperante ou reativá-lo.';
  end if;
  if p_operante is null then
    raise exception using errcode = 'P0001', message = 'Informe se o item está operante.';
  end if;

  select * into v_item from public.item where id = p_item_id for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'Item não encontrado.';
  end if;
  if v_item.operante = p_operante then
    raise exception using errcode = 'P0001',
      message = case when p_operante then 'O item já está operante.' else 'O item já está inoperante.' end;
  end if;
  -- CA-11
  if p_operante and v_motivo is null then
    raise exception using errcode = 'P0001', message = 'Informe o motivo da reativação.';
  end if;

  perform set_config('app.motivo', coalesce(v_motivo, ''), true);
  update public.item set operante = p_operante where id = p_item_id
  returning * into v_item;
  perform set_config('app.motivo', '', true);

  return v_item;
end;
$$;

revoke execute on function public.alterar_operancia_item(uuid, boolean, text) from public, anon;
grant execute on function public.alterar_operancia_item(uuid, boolean, text) to authenticated;
