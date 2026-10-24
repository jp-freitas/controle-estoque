-- spec-004 T-08: RN-03 — a reserva sempre bate com as solicitações aprovadas e não retiradas.
-- Depois de uma sequência de aprovações (totais e parciais), recusas e cancelamentos,
-- para cada item: quantidade_reservada = soma de quantidade_aprovada das solicitações 'aprovada'.
begin;
create extension if not exists pgtap with schema extensions;
select plan(4);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0404-0000000000a1', 't-admin@teste.test'),
  ('00000000-0000-0000-0404-0000000000b1', 't-prof@teste.test');
insert into public.profiles (id, nome, email, perfil, status) values
  ('00000000-0000-0000-0404-0000000000a1', 'Admin', 't-admin@teste.test', 'admin', 'ativo'),
  ('00000000-0000-0000-0404-0000000000b1', 'Prof', 't-prof@teste.test', 'solicitante', 'ativo');
insert into public.local (id, nome) values ('00000000-0000-0000-0404-00000000f001', 'T-Depósito');
insert into public.item (id, nome, tipo_id, local_id, quantidade_total)
select ('00000000-0000-0000-0404-00000000e00' || n)::uuid, 'T-Item ' || n,
       (select id from public.tipo_item where nome = 'Ferramenta'), '00000000-0000-0000-0404-00000000f001', 10
  from generate_series(1, 3) n;

create function pg_temp.como(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;
-- aprova cada linha com min(solicitada, p_max)
create function pg_temp.aprovar(p_sol uuid, p_max integer) returns void language sql as $$
  select public.aprovar_solicitacao(p_sol, (
    select jsonb_agg(jsonb_build_object('solicitacao_item_id', id, 'quantidade_aprovada', least(quantidade_solicitada, p_max)))
      from public.solicitacao_item where solicitacao_id = p_sol));
$$;
create function pg_temp.invariante_ok() returns boolean language sql as $$
  select not exists (
    select 1 from public.item i
     where i.id::text like '00000000-0000-0000-0404-%'
       and i.quantidade_reservada <> coalesce((
         select sum(l.quantidade_aprovada) from public.solicitacao_item l
           join public.solicitacao s on s.id = l.solicitacao_id
          where l.item_id = i.id and s.status = 'aprovada'), 0));
$$;

set local role authenticated;
create temp table sol (n integer primary key, id uuid);
grant all on sol to authenticated;
select pg_temp.como('00000000-0000-0000-0404-0000000000b1');
insert into sol
select n, public.enviar_solicitacao(
  jsonb_build_array(
    jsonb_build_object('item_id', '00000000-0000-0000-0404-00000000e001', 'quantidade', 1 + n % 3),
    jsonb_build_object('item_id', ('00000000-0000-0000-0404-00000000e00' || (2 + n % 2))::uuid, 'quantidade', 2)),
  'Aula ' || n)
  from generate_series(1, 8) n;

select pg_temp.como('00000000-0000-0000-0404-0000000000a1');
select pg_temp.aprovar((select id from sol where n = 1), 9);
select pg_temp.aprovar((select id from sol where n = 2), 1);
select pg_temp.aprovar((select id from sol where n = 3), 9);
select pg_temp.aprovar((select id from sol where n = 4), 9);
select public.recusar_solicitacao((select id from sol where n = 5), 'Sem uso');
select ok(pg_temp.invariante_ok(), 'RN-03: depois de aprovações totais, parciais e uma recusa');

select public.cancelar_solicitacao_aprovada((select id from sol where n = 2), 'Desistiu');
select public.cancelar_solicitacao_aprovada((select id from sol where n = 4), 'Desistiu');
select pg_temp.aprovar((select id from sol where n = 6), 9);
select ok(pg_temp.invariante_ok(), 'RN-03: depois de cancelar aprovadas e aprovar outra');

select pg_temp.como('00000000-0000-0000-0404-0000000000b1');
select public.cancelar_solicitacao((select id from sol where n = 7));
select pg_temp.como('00000000-0000-0000-0404-0000000000a1');
select public.cancelar_solicitacao_aprovada((select id from sol where n = 1), 'Fim do semestre');
select public.cancelar_solicitacao_aprovada((select id from sol where n = 3), 'Fim do semestre');
select public.cancelar_solicitacao_aprovada((select id from sol where n = 6), 'Fim do semestre');
select ok(pg_temp.invariante_ok(), 'RN-03: depois de cancelar tudo o que estava aprovado');
select is((select sum(quantidade_reservada)::int from public.item where id::text like '00000000-0000-0000-0404-%'), 0,
  'RN-03: nenhuma reserva órfã no fim');

select * from finish();
rollback;
