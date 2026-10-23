-- spec-001 T-08: RLS de profiles (RF-04, RF-05, RF-06, RF-09; CA-02, CA-04, CA-07; P-02, P-07)
--
-- Leitura: cada usuário autenticado lê a própria linha (inclusive pendente e
-- inativo, para o front mostrar a tela certa); admin ativo lê todas.
-- Escrita: nenhuma pela aplicação. Toda mudança passa pelas RPCs SECURITY DEFINER
-- (T-10, T-12, T-16), que checam perfil/status, auditam e travam o último admin.

create policy profiles_select_proprio_ou_admin on public.profiles
  for select to authenticated
  using (id = (select auth.uid()) or (select public.eh_admin_ativo()));

revoke all on public.profiles from anon;
revoke insert, update, delete, truncate on public.profiles from authenticated;
