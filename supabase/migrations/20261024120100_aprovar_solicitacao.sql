-- spec-004 T-04: aprovar_solicitacao (RF-01 a RF-07, RF-09, RF-14, RN-01 a RN-03;
-- CA-01 a CA-05, CA-07, CA-09, CA-10, CA-13; P-03, P-04, P-05)
--
-- Bloqueio (P-04): primeiro a solicitação, depois os itens em ordem de id. Duas
-- aprovações do mesmo item se serializam; a segunda revalida o disponível já com a
-- reserva da primeira (CA-03). O CHECK de estoque do item é a última barreira.

create function public.aprovar_solicitacao(p_id uuid, p_itens jsonb, p_observacao text default null)
returns public.solicitacao
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sol        public.solicitacao;
  v_ids        uuid[];
  v_qtds       integer[];
  v_falhas     jsonb := '[]'::jsonb;
  v_linha      record;
  v_disponivel integer;
begin
  -- RF-01 / CA-04
  if not public.eh_admin_ativo() then
    raise exception using errcode = 'P0001', message = 'Apenas administradores ativos podem aprovar solicitações.';
  end if;

  select * into v_sol from public.solicitacao where id = p_id for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'Solicitação não encontrada.';
  end if;
  -- RF-09 / CA-07
  if v_sol.status <> 'pendente' then
    raise exception using errcode = 'P0001', message = 'Só solicitações pendentes podem ser aprovadas.';
  end if;
  -- RF-02 / CA-05
  if v_sol.solicitante_id = auth.uid() then
    raise exception using errcode = 'P0001',
      message = 'Você não pode decidir a própria solicitação. Peça a outro administrador.';
  end if;
  -- RF-14 / CA-13
  if not exists (select 1 from public.profiles where id = v_sol.solicitante_id and status = 'ativo') then
    raise exception using errcode = 'P0001', message = 'O solicitante não está ativo; recuse a solicitação.';
  end if;

  begin
    select array_agg(x.solicitacao_item_id), array_agg(x.quantidade_aprovada)
      into v_ids, v_qtds
      from jsonb_array_elements(coalesce(p_itens, '[]'::jsonb)) as e(valor)
     cross join lateral jsonb_to_record(e.valor) as x(solicitacao_item_id uuid, quantidade_aprovada integer);
  exception when data_exception then
    raise exception using errcode = 'P0001', message = 'Lista de itens inválida.';
  end;

  -- todas as linhas da solicitação, cada uma uma vez
  if coalesce(cardinality(v_ids), 0) <> (select count(*) from public.solicitacao_item where solicitacao_id = p_id)
     or (select count(distinct i) from unnest(v_ids) i) <> cardinality(v_ids)
     or exists (select 1 from unnest(v_ids) i
                 where not exists (select 1 from public.solicitacao_item l
                                    where l.id = i and l.solicitacao_id = p_id)) then
    raise exception using errcode = 'P0001',
      message = 'Informe a quantidade aprovada de todos os itens da solicitação.';
  end if;

  if exists (select 1
               from unnest(v_ids, v_qtds) as a(linha_id, aprovada)
               join public.solicitacao_item l on l.id = a.linha_id
              where a.aprovada is null or a.aprovada < 0 or a.aprovada > l.quantidade_solicitada) then
    raise exception using errcode = 'P0001', message = 'A quantidade aprovada deve ficar entre 0 e a solicitada.';
  end if;
  -- RF-05 / CA-10
  if (select sum(q) from unnest(v_qtds) q) = 0 then
    raise exception using errcode = 'P0001',
      message = 'Nada foi aprovado. Para não atender a solicitação, use Recusar.';
  end if;

  -- P-04 / RN-02: itens em ordem de id
  perform 1 from public.item
    where id in (select item_id from public.solicitacao_item where solicitacao_id = p_id)
    order by id
    for update;

  -- RF-06 / RF-07: revalida com os itens travados; acumula as falhas
  for v_linha in
    select l.id as linha_id, a.aprovada, i.*
      from unnest(v_ids, v_qtds) as a(linha_id, aprovada)
      join public.solicitacao_item l on l.id = a.linha_id
      join public.item i on i.id = l.item_id
     where a.aprovada > 0
     order by i.nome
  loop
    v_disponivel := v_linha.quantidade_total - v_linha.quantidade_reservada - v_linha.quantidade_em_uso;
    if not v_linha.ativo then
      v_falhas := v_falhas || jsonb_build_object('item_id', v_linha.id, 'nome', v_linha.nome, 'motivo', 'Item desativado.');
    elsif not v_linha.operante then
      -- CA-09
      v_falhas := v_falhas || jsonb_build_object('item_id', v_linha.id, 'nome', v_linha.nome, 'motivo', 'Item inoperante.');
    elsif v_disponivel < v_linha.aprovada then
      -- CA-01
      v_falhas := v_falhas || jsonb_build_object('item_id', v_linha.id, 'nome', v_linha.nome,
        'motivo', format('Estoque insuficiente: disponível %s.', v_disponivel));
    end if;
  end loop;

  if jsonb_array_length(v_falhas) > 0 then
    raise exception using errcode = 'P0001', message = 'Não foi possível aprovar. Confira os itens indicados.',
      detail = v_falhas::text;
  end if;

  -- RF-04: reserva e movimentação; contadores mexidos por movimento não são auditados (spec-006/RF-05)
  perform set_config('app.origem', 'movimentacao', true);
  update public.item i
     set quantidade_reservada = i.quantidade_reservada + a.aprovada
    from unnest(v_ids, v_qtds) as a(linha_id, aprovada)
    join public.solicitacao_item l on l.id = a.linha_id
   where i.id = l.item_id and a.aprovada > 0;
  perform set_config('app.origem', '', true);

  insert into public.movimentacao (item_id, solicitacao_id, tipo, quantidade, usuario_id)
  select l.item_id, p_id, 'reserva', a.aprovada, auth.uid()
    from unnest(v_ids, v_qtds) as a(linha_id, aprovada)
    join public.solicitacao_item l on l.id = a.linha_id
   where a.aprovada > 0;

  -- CA-02: grava também os zeros
  update public.solicitacao_item l
     set quantidade_aprovada = a.aprovada
    from unnest(v_ids, v_qtds) as a(linha_id, aprovada)
   where l.id = a.linha_id;

  update public.solicitacao
     set status = 'aprovada',
         aprovador_id = auth.uid(),
         data_decisao = now(),
         observacao_decisao = nullif(btrim(p_observacao), '')
   where id = p_id
  returning * into v_sol;

  return v_sol;
end;
$$;

revoke execute on function public.aprovar_solicitacao(uuid, jsonb, text) from public, anon;
grant execute on function public.aprovar_solicitacao(uuid, jsonb, text) to authenticated;
