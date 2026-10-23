-- spec-001 T-05: trigger genérico auditar() e auditoria de profiles
-- RN-02; spec-006/RF-02 a RF-09, RF-11, RF-17; constituição P-06.
--
-- Uso: create trigger ... after insert or update or delete on <tabela>
--        for each row execute function public.auditar('<coluna>', ...);
-- Os argumentos são as colunas auditáveis em UPDATE. Sem argumentos, todas as
-- colunas contam, exceto atualizado_em. INSERT e DELETE são sempre auditados.
-- A tabela auditada precisa de PK uuid chamada id.
-- A regra de contadores de item (spec-006/RF-05, app.origem) entra na spec 002.

create function public.auditar()
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

revoke execute on function public.auditar() from public, anon, authenticated;

-- spec-006/RF-06: em profiles, UPDATE só é auditado quando muda perfil ou status
create trigger profiles_auditar
  after insert or update or delete on public.profiles
  for each row execute function public.auditar('perfil', 'status');
