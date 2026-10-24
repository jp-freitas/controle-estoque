-- spec-003 T-05: enviar_solicitacao (RF-01, RF-03, RF-05 a RF-07, RN-01, RN-03; CA-01 a CA-04, CA-08)
--
-- Pré-validação (RN-01): não trava itens nem mexe em contadores; a garantia de
-- estoque é a da aprovação (spec 004). SECURITY DEFINER para validar itens que o
-- solicitante não enxerga (desativados) sem revelar o nome deles.

create function public.enviar_solicitacao(p_itens jsonb, p_justificativa text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_justificativa text := btrim(p_justificativa);
  v_ids           uuid[];
  v_qtds          integer[];
  v_falhas        jsonb := '[]'::jsonb;
  v_item          public.item;
  v_linha         record;
  v_disponivel    integer;
  v_id            uuid;
begin
  -- CA-08
  if not public.usuario_ativo() then
    raise exception using errcode = 'P0001', message = 'Seu acesso não permite enviar solicitações.';
  end if;
  -- RF-06 / CA-04
  if v_justificativa is null or char_length(v_justificativa) not between 3 and 500 then
    raise exception using errcode = 'P0001', message = 'Informe a justificativa (de 3 a 500 caracteres).';
  end if;
  if p_itens is null or p_itens = '[]'::jsonb then
    raise exception using errcode = 'P0001', message = 'Adicione ao menos um item.';
  end if;

  begin
    select array_agg(x.item_id order by e.ordem), array_agg(x.quantidade order by e.ordem)
      into v_ids, v_qtds
      from jsonb_array_elements(p_itens) with ordinality as e(valor, ordem)
     cross join lateral jsonb_to_record(e.valor) as x(item_id uuid, quantidade integer);
  -- não é lista, elemento não é objeto, uuid ou inteiro inválidos (classe 22)
  exception when data_exception then
    raise exception using errcode = 'P0001', message = 'Lista de itens inválida.';
  end;

  if array_position(v_ids, null) is not null then
    raise exception using errcode = 'P0001', message = 'Lista de itens inválida.';
  end if;
  -- RF-03
  if exists (select 1 from unnest(v_qtds) q where q is null or q < 1) then
    raise exception using errcode = 'P0001', message = 'Quantidade inválida: use números inteiros a partir de 1.';
  end if;
  if (select count(distinct i) from unnest(v_ids) i) <> cardinality(v_ids) then
    raise exception using errcode = 'P0001', message = 'O mesmo item aparece mais de uma vez.';
  end if;

  -- RF-05 / RF-07: valida todos e acumula as falhas
  for v_linha in select * from unnest(v_ids, v_qtds) as l(item_id, quantidade) loop
    select * into v_item from public.item where id = v_linha.item_id;
    v_disponivel := v_item.quantidade_total - v_item.quantidade_reservada - v_item.quantidade_em_uso;

    if v_item.id is null or not v_item.ativo then
      v_falhas := v_falhas || jsonb_build_object('item_id', v_linha.item_id, 'nome', null,
        'motivo', 'Item não encontrado ou desativado.');
    elsif not v_item.operante then
      -- CA-03
      v_falhas := v_falhas || jsonb_build_object('item_id', v_item.id, 'nome', v_item.nome,
        'motivo', 'Item inoperante.');
    elsif v_disponivel < v_linha.quantidade then
      -- CA-02
      v_falhas := v_falhas || jsonb_build_object('item_id', v_item.id, 'nome', v_item.nome,
        'motivo', format('Disponível: %s.', v_disponivel));
    end if;
  end loop;

  if jsonb_array_length(v_falhas) > 0 then
    raise exception using errcode = 'P0001', message = 'Alguns itens não podem ser solicitados.',
      detail = v_falhas::text;
  end if;

  -- RF-01: sempre em nome de quem chama
  insert into public.solicitacao (solicitante_id, justificativa)
  values (auth.uid(), v_justificativa)
  returning id into v_id;

  insert into public.solicitacao_item (solicitacao_id, item_id, item_nome, quantidade_solicitada)
  select v_id, l.item_id, i.nome, l.quantidade
    from unnest(v_ids, v_qtds) as l(item_id, quantidade)
    join public.item i on i.id = l.item_id;

  return v_id;
end;
$$;

revoke execute on function public.enviar_solicitacao(jsonb, text) from public, anon;
grant execute on function public.enviar_solicitacao(jsonb, text) to authenticated;
