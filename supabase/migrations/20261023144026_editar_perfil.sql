-- spec-001 T-12: edição de nome e matrícula (RF-15, RF-16, RN-05; CA-16, CA-17)
-- Só nome e matrícula: email, perfil e status não passam por aqui (RF-06).
-- Nome não é auditado (spec-006/RF-06), então não há motivo a gravar.

-- Interna: aplica a edição com normalização (trim; matrícula vazia → null).
create function public.aplicar_edicao_perfil(p_id uuid, p_nome text, p_matricula text)
returns public.profiles
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_nome      text := btrim(p_nome);
  v_matricula text := nullif(btrim(p_matricula), '');
  v_perfil    public.profiles;
begin
  if v_nome is null or v_nome = '' then
    raise exception using errcode = 'P0001', message = 'Informe o nome.';
  end if;

  update public.profiles
     set nome = v_nome, matricula = v_matricula
   where id = p_id
  returning * into v_perfil;

  if not found then
    raise exception using errcode = 'P0001', message = 'Usuário não encontrado.';
  end if;

  return v_perfil;
exception
  when unique_violation then
    -- CA-17 / RN-05 (índice profiles_matricula_key)
    raise exception using errcode = 'P0001', message = 'Matrícula já cadastrada.';
end;
$$;

revoke execute on function public.aplicar_edicao_perfil(uuid, text, text) from public, anon, authenticated;

-- RF-15: o próprio usuário ativo
create function public.atualizar_meu_perfil(p_nome text, p_matricula text)
returns public.profiles
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.usuario_ativo() then
    raise exception using errcode = 'P0001', message = 'Apenas usuários ativos podem editar o perfil.';
  end if;

  return public.aplicar_edicao_perfil((select auth.uid()), p_nome, p_matricula);
end;
$$;

-- RF-16: admin ativo, qualquer usuário
create function public.atualizar_usuario(p_id uuid, p_nome text, p_matricula text)
returns public.profiles
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.eh_admin_ativo() then
    raise exception using errcode = 'P0001', message = 'Apenas administradores ativos podem alterar usuários.';
  end if;

  return public.aplicar_edicao_perfil(p_id, p_nome, p_matricula);
end;
$$;

revoke execute on function public.atualizar_meu_perfil(text, text) from public, anon;
revoke execute on function public.atualizar_usuario(uuid, text, text) from public, anon;
grant execute on function public.atualizar_meu_perfil(text, text) to authenticated;
grant execute on function public.atualizar_usuario(uuid, text, text) to authenticated;
