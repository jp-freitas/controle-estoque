-- spec-001 T-10: gestão de usuários (RF-05, RF-06, RF-07; CA-03 a CA-06; P-04, P-07, P-08)
--
-- Concorrência (RF-07): toda alteração de perfil/status trava primeiro as linhas
-- dos admins ativos (FOR UPDATE, em ordem de id) e só depois confere se quem
-- chama ainda é admin ativo. Assim, dois admins rebaixando um ao outro ao mesmo
-- tempo são serializados: o segundo já não é admin quando a trava é liberada.

-- Interna: trava, valida o autor e devolve o alvo travado. Não exposta à aplicação.
create function public.preparar_alteracao_usuario(p_id uuid)
returns public.profiles
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_alvo public.profiles;
begin
  perform 1
    from public.profiles p
   where p.perfil = 'admin' and p.status = 'ativo'
   order by p.id
     for update;

  if not public.eh_admin_ativo() then
    raise exception using errcode = 'P0001',
      message = 'Apenas administradores ativos podem alterar usuários.';
  end if;

  -- RF-06 / P-07; CA-05 explica o motivo quando é o único admin
  if p_id = (select auth.uid()) then
    if (select count(*) from public.profiles p where p.perfil = 'admin' and p.status = 'ativo') = 1 then
      raise exception using errcode = 'P0001',
        message = 'Você é o único administrador ativo. Promova outro usuário antes, pois o sistema não pode ficar sem administrador.';
    end if;
    raise exception using errcode = 'P0001',
      message = 'Você não pode alterar o próprio perfil nem o próprio status. Peça a outro administrador.';
  end if;

  select * into v_alvo from public.profiles p where p.id = p_id for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'Usuário não encontrado.';
  end if;

  return v_alvo;
end;
$$;

revoke execute on function public.preparar_alteracao_usuario(uuid) from public, anon, authenticated;

-- Interna: P-08, nunca ficar sem admin ativo depois da alteração.
create function public.garantir_admin_ativo()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from public.profiles p where p.perfil = 'admin' and p.status = 'ativo') then
    raise exception using errcode = 'P0001',
      message = 'O sistema precisa de pelo menos um administrador ativo.';
  end if;
end;
$$;

revoke execute on function public.garantir_admin_ativo() from public, anon, authenticated;

-- RF-05: aprovar (pendente → ativo), inativar e reativar
create function public.alterar_status_usuario(p_id uuid, p_status public.status_usuario)
returns public.profiles
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_alvo public.profiles;
begin
  v_alvo := public.preparar_alteracao_usuario(p_id);

  if p_status not in ('ativo', 'inativo') then
    raise exception using errcode = 'P0001', message = 'Status inválido: use ativo ou inativo.';
  end if;

  update public.profiles set status = p_status where id = p_id
  returning * into v_alvo;

  perform public.garantir_admin_ativo();
  return v_alvo;
end;
$$;

-- RF-05: promover e rebaixar
create function public.alterar_perfil_usuario(p_id uuid, p_perfil public.perfil)
returns public.profiles
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_alvo public.profiles;
begin
  v_alvo := public.preparar_alteracao_usuario(p_id);

  update public.profiles set perfil = p_perfil where id = p_id
  returning * into v_alvo;

  perform public.garantir_admin_ativo();
  return v_alvo;
end;
$$;

revoke execute on function public.alterar_status_usuario(uuid, public.status_usuario) from public, anon;
revoke execute on function public.alterar_perfil_usuario(uuid, public.perfil) from public, anon;
grant execute on function public.alterar_status_usuario(uuid, public.status_usuario) to authenticated;
grant execute on function public.alterar_perfil_usuario(uuid, public.perfil) to authenticated;
