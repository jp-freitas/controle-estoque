-- spec-004 T-09: leitura para o admin e para o professor (RF-03, RF-11 a RF-14; CA-11, CA-12)
begin;
create extension if not exists pgtap with schema extensions;
select plan(19);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0405-0000000000a1', 't-admin@teste.test'),
  ('00000000-0000-0000-0405-0000000000b1', 't-ana@teste.test'),
  ('00000000-0000-0000-0405-0000000000b2', 't-beto@teste.test');
insert into public.profiles (id, nome, email, perfil, status) values
  ('00000000-0000-0000-0405-0000000000a1', 'Admin', 't-admin@teste.test', 'admin', 'ativo'),
  ('00000000-0000-0000-0405-0000000000b1', 'T-Ana', 't-ana@teste.test', 'solicitante', 'ativo'),
  ('00000000-0000-0000-0405-0000000000b2', 'T-Beto', 't-beto@teste.test', 'solicitante', 'ativo');
insert into public.local (id, nome) values ('00000000-0000-0000-0405-00000000f001', 'T-Depósito');
insert into public.item (id, nome, tipo_id, local_id, quantidade_total) values
  ('00000000-0000-0000-0405-00000000e001', 'T-Tesoura', (select id from public.tipo_item where nome = 'Ferramenta'),
   '00000000-0000-0000-0405-00000000f001', 4),
  ('00000000-0000-0000-0405-00000000e002', 'T-Cola', (select id from public.tipo_item where nome = 'Insumo'),
   '00000000-0000-0000-0405-00000000f001', 10);

create function pg_temp.como(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;

set local role authenticated;
create temp table sol (nome text primary key, id uuid);
grant all on sol to authenticated;
select pg_temp.como('00000000-0000-0000-0405-0000000000b1');
insert into sol values ('ana-antiga', public.enviar_solicitacao(
  '[{"item_id": "00000000-0000-0000-0405-00000000e001", "quantidade": 3},
    {"item_id": "00000000-0000-0000-0405-00000000e002", "quantidade": 5}]', 'Aula de artes'));
select pg_temp.como('00000000-0000-0000-0405-0000000000b2');
insert into sol values ('beto', public.enviar_solicitacao(
  '[{"item_id": "00000000-0000-0000-0405-00000000e001", "quantidade": 1}]', 'Feira'));
select pg_temp.como('00000000-0000-0000-0405-0000000000b1');
insert into sol values ('ana-nova', public.enviar_solicitacao(
  '[{"item_id": "00000000-0000-0000-0405-00000000e002", "quantidade": 1}]', 'Reposição'));
reset role;
-- datas de envio distintas para a ordem da fila
update public.solicitacao set criado_em = now() - interval '3 days' where id = (select id from sol where nome = 'ana-antiga');
update public.solicitacao set criado_em = now() - interval '2 days' where id = (select id from sol where nome = 'beto');
update public.solicitacao set criado_em = now() - interval '1 day' where id = (select id from sol where nome = 'ana-nova');
select set_config('app.origem', 'movimentacao', true);
update public.item set quantidade_reservada = 1 where id = '00000000-0000-0000-0405-00000000e001';
select set_config('app.origem', '', true);

select has_view('public', 'fila_aprovacao', 'RF-03: view da fila');
select has_view('public', 'aprovadas_aguardando_retirada', 'RF-13: view das aprovadas aguardando retirada');

-- RF-03: fila ---------------------------------------------------------------------------
set local role authenticated;
select pg_temp.como('00000000-0000-0000-0405-0000000000a1');
select results_eq(
  $$ select justificativa from public.fila_aprovacao where solicitante_nome like 'T-%' order by criado_em $$,
  $$ values ('Aula de artes'), ('Feira'), ('Reposição') $$, 'RF-03: pendentes, mais antigas primeiro');
select results_eq(
  format($$ select solicitante_nome, solicitante_status::text from public.fila_aprovacao where id = %L $$,
    (select id from sol where nome = 'ana-antiga')),
  $$ values ('T-Ana', 'ativo') $$, 'RF-03 / RF-14: solicitante com nome e status');
select results_eq(
  format($$ select i->>'item_nome', (i->>'quantidade_solicitada')::int, (i->>'disponivel')::int, (i->>'operante')::boolean
              from public.fila_aprovacao f, jsonb_array_elements(f.itens) i where f.id = %L order by 1 $$,
    (select id from sol where nome = 'ana-antiga')),
  $$ values ('T-Cola', 5, 10, true), ('T-Tesoura', 3, 3, true) $$,
  'RF-03: itens com quantidade e disponibilidade atual');
select ok(
  (select bool_and(i ? 'solicitacao_item_id') from public.fila_aprovacao f, jsonb_array_elements(f.itens) i
    where f.id = (select id from sol where nome = 'ana-antiga')),
  'cada item traz o id da linha (para aprovar)');

-- Solicitante não lê a fila, nem com a própria pendente ------------------------------------
select pg_temp.como('00000000-0000-0000-0405-0000000000b1');
select is_empty($$ select 1 from public.fila_aprovacao $$, 'RF-03: solicitante não lê a fila (nem as próprias)');
select is_empty($$ select 1 from public.aprovadas_aguardando_retirada $$, 'solicitante não lê as aprovadas aguardando');

-- Decisões ----------------------------------------------------------------------------------
select pg_temp.como('00000000-0000-0000-0405-0000000000a1');
select public.aprovar_solicitacao((select id from sol where nome = 'ana-antiga'), (
  select jsonb_agg(jsonb_build_object('solicitacao_item_id', id,
    'quantidade_aprovada', case item_nome when 'T-Tesoura' then 2 else 5 end))
    from public.solicitacao_item where solicitacao_id = (select id from sol where nome = 'ana-antiga')),
  'Só há 2 em estoque');
select public.recusar_solicitacao((select id from sol where nome = 'beto'), 'Tesoura reservada para a feira');
select is((select count(*)::int from public.fila_aprovacao where solicitante_nome like 'T-%'), 1,
  'decididas saem da fila');

-- CA-11: professor vê o detalhe da aprovação parcial ------------------------------------------
select pg_temp.como('00000000-0000-0000-0405-0000000000b1');
select results_eq(
  format($$ select item_nome, quantidade_solicitada, quantidade_aprovada from public.solicitacao_item
            where solicitacao_id = %L order by item_nome $$, (select id from sol where nome = 'ana-antiga')),
  $$ values ('T-Cola', 5, 5), ('T-Tesoura', 3, 2) $$, 'CA-11: quantidade aprovada por item');
select is((select observacao_decisao from public.solicitacao where id = (select id from sol where nome = 'ana-antiga')),
  'Só há 2 em estoque', 'CA-11: observação da aprovação');
select is((select status::text from public.solicitacao where id = (select id from sol where nome = 'ana-antiga')),
  'aprovada', 'RF-12: novo status em "Minhas solicitações"');
select pg_temp.como('00000000-0000-0000-0405-0000000000b2');
select results_eq(
  format($$ select status::text, motivo_recusa from public.solicitacao where id = %L $$, (select id from sol where nome = 'beto')),
  $$ values ('recusada', 'Tesoura reservada para a feira') $$, 'RF-12: professor vê a recusa e o motivo');

-- CA-12: aprovada há 10 dias ---------------------------------------------------------------
reset role;
update public.solicitacao set data_decisao = now() - interval '10 days' where id = (select id from sol where nome = 'ana-antiga');
set local role authenticated;
select pg_temp.como('00000000-0000-0000-0405-0000000000a1');
select results_eq(
  format($$ select solicitante_nome, dias_aguardando from public.aprovadas_aguardando_retirada where id = %L $$,
    (select id from sol where nome = 'ana-antiga')),
  $$ values ('T-Ana', 10) $$, 'CA-12: aparece com 10 dias');
select is((select status::text from public.solicitacao where id = (select id from sol where nome = 'ana-antiga')),
  'aprovada', 'CA-12: continua aprovada (sem expiração)');
select is((select quantidade_reservada from public.item where id = '00000000-0000-0000-0405-00000000e001'), 3,
  'CA-12: reserva mantida (1 de antes + 2 aprovadas)');
select results_eq(
  format($$ select i->>'item_nome', (i->>'quantidade_aprovada')::int
              from public.aprovadas_aguardando_retirada a, jsonb_array_elements(a.itens) i where a.id = %L order by 1 $$,
    (select id from sol where nome = 'ana-antiga')),
  $$ values ('T-Cola', 5), ('T-Tesoura', 2) $$, 'RF-13: itens com a quantidade aprovada');
select is((select aprovador_nome from public.aprovadas_aguardando_retirada where id = (select id from sol where nome = 'ana-antiga')),
  'Admin', 'RF-13: quem aprovou');
reset role;
select ok((select bool_and('security_invoker=true' = any(reloptions)) from pg_class
  where oid in ('public.fila_aprovacao'::regclass, 'public.aprovadas_aguardando_retirada'::regclass)),
  'views respeitam a RLS (security_invoker)');

select * from finish();
rollback;
