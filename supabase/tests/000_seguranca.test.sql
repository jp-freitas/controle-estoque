-- Regras transversais de segurança do schema public (constituição P-02; CLAUDE.md →
-- Regras de arquitetura). Vale para todas as specs: tabela ou função nova que
-- quebre a regra faz este teste falhar. Origem: spec-001 T-19.
begin;
create extension if not exists pgtap with schema extensions;
select plan(4);

select is_empty(
  $$ select c.relname from pg_class c
     where c.relnamespace = 'public'::regnamespace and c.relkind in ('r', 'p') and not c.relrowsecurity $$,
  'P-02: toda tabela do schema public tem RLS habilitado');

select is_empty(
  $$ select p.proname from pg_proc p
     where p.pronamespace = 'public'::regnamespace and p.prosecdef
       and not exists (select 1 from unnest(p.proconfig) c where c like 'search_path=%') $$,
  'toda função SECURITY DEFINER fixa search_path');

select is_empty(
  $$ select p.oid::regprocedure::text from pg_proc p
     where p.pronamespace = 'public'::regnamespace and p.prosecdef
       and has_function_privilege('anon', p.oid, 'execute') $$,
  'anon não executa nenhuma função SECURITY DEFINER');

select is_empty(
  $$ select c.relname from pg_class c
     where c.relnamespace = 'public'::regnamespace and c.relkind = 'v'
       and not coalesce('security_invoker=true' = any(c.reloptions), false) $$,
  'toda view do schema public usa security_invoker (respeita a RLS)');

select * from finish();
rollback;
