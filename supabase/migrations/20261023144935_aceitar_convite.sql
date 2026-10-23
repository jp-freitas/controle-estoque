-- spec-001 T-16: aceitar_convite() (RF-11, RN-03, RN-04; CA-09 a CA-11, CA-14, CA-15, CA-18)
-- Chamada pela tela /primeiro-acesso, depois que o convidado abriu o link
-- (sessão do signInWithOtp) e definiu a senha. O e-mail vem da conta
-- autenticada, nunca de parâmetro: o convidado não escolhe o e-mail (RN-03).

create function public.aceitar_convite()
returns public.profiles
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid     uuid := (select auth.uid());
  v_email   text;
  v_perfil  public.profiles;
  v_convite public.convite;
begin
  if v_uid is null then
    raise exception using errcode = 'P0001', message = 'Abra o link do convite enviado para o seu e-mail.';
  end if;

  select u.email into v_email from auth.users u where u.id = v_uid;
  if v_email is null then
    raise exception using errcode = 'P0001', message = 'Abra o link do convite enviado para o seu e-mail.';
  end if;

  -- Mesmo lock de convidar_usuario: aceite e novo convite do mesmo e-mail não se cruzam.
  perform public.travar_email_convite(v_email);

  -- Já aceito: devolve o perfil existente (clique duplo, recarregar a página).
  select * into v_perfil from public.profiles p where p.id = v_uid;
  if found then
    return v_perfil;
  end if;

  -- O convite mais recente do e-mail decide; um em aberto tem prioridade.
  select * into v_convite
    from public.convite c
   where c.email operator(extensions.=) v_email::extensions.citext
   order by public.convite_em_aberto(c) desc, c.criado_em desc
   limit 1
     for update;

  if not found then
    raise exception using errcode = 'P0001',
      message = 'Não há convite para este e-mail. Procure a administração da escola.';
  end if;
  if v_convite.cancelado_em is not null then
    raise exception using errcode = 'P0001', message = 'Convite cancelado. Procure a administração da escola.';
  end if;
  if v_convite.aceito_em is not null then
    -- aceito por outra conta com o mesmo e-mail (não deve acontecer)
    raise exception using errcode = 'P0001', message = 'Este convite já foi aceito.';
  end if;
  if v_convite.expira_em <= now() then
    raise exception using errcode = 'P0001',
      message = 'Convite expirado. Peça um novo convite à administração da escola.';
  end if;

  -- RN-04: entra pendente, com o perfil do convite valendo após a aprovação
  insert into public.profiles (id, nome, email, matricula, perfil, status)
  values (v_uid, v_convite.nome, v_email, v_convite.matricula, v_convite.perfil, 'pendente')
  returning * into v_perfil;

  update public.convite set aceito_em = now() where id = v_convite.id;

  return v_perfil;
exception
  when unique_violation then
    -- matrícula tomada entre o convite e o aceite (barrado nas RPCs; última barreira)
    raise exception using errcode = 'P0001',
      message = 'Matrícula já cadastrada. Procure a administração da escola.';
end;
$$;

revoke execute on function public.aceitar_convite() from public, anon;
grant execute on function public.aceitar_convite() to authenticated;
