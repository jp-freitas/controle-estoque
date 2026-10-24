-- spec-003 T-07: cancelar_solicitacao pelo solicitante (RF-09; CA-05, CA-06, CA-08)
-- Só o dono, só pendente. Depois da aprovação, quem cancela é o admin (spec-004/RF-10).

create function public.cancelar_solicitacao(p_id uuid)
returns public.solicitacao
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sol public.solicitacao;
begin
  if not public.usuario_ativo() then
    raise exception using errcode = 'P0001', message = 'Seu acesso não permite cancelar solicitações.';
  end if;

  -- trava contra a aprovação simultânea (spec 004)
  select * into v_sol from public.solicitacao
   where id = p_id and solicitante_id = auth.uid()
   for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'Solicitação não encontrada.';
  end if;

  if v_sol.status <> 'pendente' then
    raise exception using errcode = 'P0001',
      message = case v_sol.status
        when 'aprovada' then 'Solicitação já aprovada; peça ao administrador para cancelar.'
        when 'cancelada' then 'Solicitação já cancelada.'
        when 'recusada' then 'Solicitação recusada; não pode ser cancelada.'
        else 'Solicitação já retirada; não pode mais ser cancelada.'
      end;
  end if;

  update public.solicitacao
     set status = 'cancelada', cancelado_em = now()
   where id = p_id
  returning * into v_sol;

  return v_sol;
end;
$$;

revoke execute on function public.cancelar_solicitacao(uuid) from public, anon;
grant execute on function public.cancelar_solicitacao(uuid) to authenticated;
