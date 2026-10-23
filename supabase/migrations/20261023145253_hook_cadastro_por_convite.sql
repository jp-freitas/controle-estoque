-- spec-001 T-18: hook before_user_created — cadastro só por convite (RF-03, CA-01)
-- Ligado em supabase/config.toml → [auth.hook.before_user_created]. Nos projetos
-- remotos, configurar o mesmo hook em Authentication → Hooks.
--
-- Achados do spike T-01 (plan.md):
-- - roda como supabase_auth_admin, sujeito a RLS → SECURITY DEFINER;
-- - qualquer exceção vira "500 Error running hook URI" no front → nunca lança,
--   devolve sempre um JSON (recusa em caso de erro inesperado);
-- - só roda na primeira criação do usuário; cancelado/expirado depois disso é
--   barrado em aceitar_convite().

create function public.validar_cadastro_por_convite(event jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_email  text;
  v_recusa constant jsonb := jsonb_build_object('error', jsonb_build_object(
    'http_code', 403,
    'message', 'Cadastro só por convite. Procure a administração da escola.'));
begin
  v_email := lower(btrim(event -> 'user' ->> 'email'));
  if v_email is null or v_email = '' then
    return v_recusa;
  end if;

  if exists (
    select 1 from public.convite c
     where c.email operator(extensions.=) v_email::extensions.citext
       and public.convite_em_aberto(c)
  ) then
    return '{}'::jsonb;
  end if;

  return v_recusa;
exception
  when others then
    return v_recusa;
end;
$$;

grant usage on schema public to supabase_auth_admin;
revoke execute on function public.validar_cadastro_por_convite(jsonb) from public, anon, authenticated;
grant execute on function public.validar_cadastro_por_convite(jsonb) to supabase_auth_admin;
