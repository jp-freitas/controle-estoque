-- spec-002 T-10: auditoria de item, tipo_item e local (RN-02; CA-07; spec-006/RF-02, RF-05; P-06)
--
-- auditar() (spec 001) ganha a regra de origem: com app.origem = 'movimentacao',
-- um UPDATE que só muda contadores de estoque não é auditado. O ajuste manual
-- (ajustar_quantidade_item) não marca a origem e continua auditado (spec-006/CA-06).

create or replace function public.auditar()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_antes  jsonb := case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end;
  v_depois jsonb := case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end;
  v_campos text[];
begin
  if tg_op = 'UPDATE' then
    select array_agg(d.key order by d.key)
      into v_campos
      from jsonb_each(v_depois) d
     where d.value is distinct from v_antes -> d.key
       and case when tg_nargs = 0 then d.key <> 'atualizado_em'
                else d.key = any (tg_argv) end;

    -- spec-006/RF-06, RF-07: nada auditável mudou
    if v_campos is null then
      return null;
    end if;

    -- spec-006/RF-05: contadores mexidos por movimento de estoque já estão em movimentacao
    if current_setting('app.origem', true) = 'movimentacao'
       and v_campos <@ array['quantidade_total', 'quantidade_reservada', 'quantidade_em_uso'] then
      return null;
    end if;
  end if;

  insert into public.auditoria
    (tabela, registro_id, acao, usuario_id, dados_antes, dados_depois, campos_alterados, motivo)
  values (
    tg_table_name,
    (coalesce(v_depois, v_antes) ->> 'id')::uuid,
    tg_op,
    (select auth.uid()),
    v_antes,
    v_depois,
    v_campos,
    nullif(current_setting('app.motivo', true), '')
  );

  return null;
end;
$$;


-- Sem argumentos: todas as colunas contam, menos atualizado_em.
create trigger item_auditar
  after insert or update or delete on public.item
  for each row execute function public.auditar();
create trigger tipo_item_auditar
  after insert or update or delete on public.tipo_item
  for each row execute function public.auditar();
create trigger local_auditar
  after insert or update or delete on public.local
  for each row execute function public.auditar();
