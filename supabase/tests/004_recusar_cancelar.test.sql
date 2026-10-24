-- spec-004 T-06: recusar_solicitacao e cancelar_solicitacao_aprovada
-- (RF-01, RF-02, RF-08 a RF-10, RN-03; CA-05, CA-06, CA-08, CA-13)
begin;
create extension if not exists pgtap with schema extensions;
select plan(28);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0403-0000000000a1', 't-admin-a@teste.test'),
  ('00000000-0000-0000-0403-0000000000a2', 't-admin-b@teste.test'),
  ('00000000-0000-0000-0403-0000000000a4', 't-admin-inativo@teste.test'),
  ('00000000-0000-0000-0403-0000000000b1', 't-prof@teste.test'),
  ('00000000-0000-0000-0403-0000000000b2', 't-prof-saiu@teste.test');
insert into public.profiles (id, nome, email, perfil, status) values
  ('00000000-0000-0000-0403-0000000000a1', 'Admin A', 't-admin-a@teste.test', 'admin', 'ativo'),
  ('00000000-0000-0000-0403-0000000000a2', 'Admin B', 't-admin-b@teste.test', 'admin', 'ativo'),
  ('00000000-0000-0000-0403-0000000000a4', 'Admin inativo', 't-admin-inativo@teste.test', 'admin', 'inativo'),
  ('00000000-0000-0000-0403-0000000000b1', 'Prof', 't-prof@teste.test', 'solicitante', 'ativo'),
  ('00000000-0000-0000-0403-0000000000b2', 'Prof que saiu', 't-prof-saiu@teste.test', 'solicitante', 'ativo');
insert into public.local (id, nome) values ('00000000-0000-0000-0403-00000000f001', 'T-Depósito');
insert into public.item (id, nome, tipo_id, local_id, quantidade_total) values
  ('00000000-0000-0000-0403-00000000e001', 'T-Microscópio', (select id from public.tipo_item where nome = 'Máquina'),
   '00000000-0000-0000-0403-00000000f001', 5),
  ('00000000-0000-0000-0403-00000000e002', 'T-Lâmina', (select id from public.tipo_item where nome = 'Insumo'),
   '00000000-0000-0000-0403-00000000f001', 20);

create function pg_temp.como(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;
create function pg_temp.reservada(p_id uuid) returns integer language sql as $$
  select quantidade_reservada from public.item where id = p_id;
$$;
create function pg_temp.status(p_id uuid) returns text language sql as $$
  select status::text from public.solicitacao where id = p_id;
$$;
create function pg_temp.aprovar_tudo(p_sol uuid) returns void language sql as $$
  select public.aprovar_solicitacao(p_sol, (
    select jsonb_agg(jsonb_build_object('solicitacao_item_id', id, 'quantidade_aprovada', quantidade_solicitada))
      from public.solicitacao_item where solicitacao_id = p_sol));
$$;

set local role authenticated;
create temp table sol (nome text primary key, id uuid);
grant all on sol to authenticated;
select pg_temp.como('00000000-0000-0000-0403-0000000000b1');
insert into sol values
  ('recusar', public.enviar_solicitacao('[{"item_id": "00000000-0000-0000-0403-00000000e001", "quantidade": 2}]', 'Aula 1')),
  ('cancelar', public.enviar_solicitacao('[{"item_id": "00000000-0000-0000-0403-00000000e001", "quantidade": 3},
     {"item_id": "00000000-0000-0000-0403-00000000e002", "quantidade": 4}]', 'Aula 2')),
  ('pendente', public.enviar_solicitacao('[{"item_id": "00000000-0000-0000-0403-00000000e002", "quantidade": 1}]', 'Aula 3'));
select pg_temp.como('00000000-0000-0000-0403-0000000000a1');
insert into sol values
  ('propria', public.enviar_solicitacao('[{"item_id": "00000000-0000-0000-0403-00000000e002", "quantidade": 1}]', 'Do admin A'));
select pg_temp.como('00000000-0000-0000-0403-0000000000b2');
insert into sol values
  ('saiu', public.enviar_solicitacao('[{"item_id": "00000000-0000-0000-0403-00000000e002", "quantidade": 1}]', 'Antes de sair'));
reset role;
update public.profiles set status = 'inativo' where id = '00000000-0000-0000-0403-0000000000b2';

set local role authenticated;
select pg_temp.como('00000000-0000-0000-0403-0000000000a1');

-- CA-06 / RF-08: recusa ---------------------------------------------------------------
select throws_ok(format('select public.recusar_solicitacao(%L, null)', (select id from sol where nome = 'recusar')),
  'P0001', 'Informe o motivo da recusa.', 'CA-06: recusa sem motivo');
select throws_ok(format('select public.recusar_solicitacao(%L, %L)', (select id from sol where nome = 'recusar'), '   '),
  'P0001', 'Informe o motivo da recusa.', 'CA-06: recusa com motivo em branco');
select is((public.recusar_solicitacao((select id from sol where nome = 'recusar'), ' Item reservado para a feira ')).status,
  'recusada'::public.status_solicitacao, 'RF-08: com motivo, fica recusada');
select results_eq(
  format($$ select motivo_recusa, aprovador_id, data_decisao is not null from public.solicitacao where id = %L $$,
    (select id from sol where nome = 'recusar')),
  $$ values ('Item reservado para a feira', '00000000-0000-0000-0403-0000000000a1'::uuid, true) $$,
  'RF-08: motivo, quem decidiu e quando');
select is(pg_temp.reservada('00000000-0000-0000-0403-00000000e001'), 0, 'RF-08: recusa não mexe no estoque');
select throws_ok(format('select public.recusar_solicitacao(%L, %L)', (select id from sol where nome = 'recusar'), 'x'),
  'P0001', 'Só solicitações pendentes podem ser recusadas.', 'RF-09: recusar de novo');
select throws_ok(format('select public.recusar_solicitacao(%L, %L)', (select id from sol where nome = 'propria'), 'x'),
  'P0001', 'Você não pode decidir a própria solicitação. Peça a outro administrador.', 'RF-02: não recusa a própria');
select lives_ok(format('select public.recusar_solicitacao(%L, %L)', (select id from sol where nome = 'saiu'), 'Saiu da escola'),
  'CA-13: solicitação de quem foi inativado pode ser recusada');

-- CA-08 / RF-10: cancelar aprovada --------------------------------------------------------
select pg_temp.aprovar_tudo((select id from sol where nome = 'cancelar'));
select is(pg_temp.reservada('00000000-0000-0000-0403-00000000e001'), 3, 'preparação: reserva de 3 microscópios');
select throws_ok(format('select public.cancelar_solicitacao_aprovada(%L, %L)', (select id from sol where nome = 'cancelar'), ' '),
  'P0001', 'Informe o motivo do cancelamento.', 'RF-10: cancelar exige motivo');
select is((public.cancelar_solicitacao_aprovada((select id from sol where nome = 'cancelar'), 'Professor não veio buscar')).status,
  'cancelada'::public.status_solicitacao, 'CA-08: aprovada vira cancelada');
select is(pg_temp.reservada('00000000-0000-0000-0403-00000000e001'), 0, 'CA-08: reservada volta ao valor anterior');
select is(pg_temp.reservada('00000000-0000-0000-0403-00000000e002'), 0, 'CA-08: todas as linhas liberadas');
select results_eq(
  format($$ select i.nome, m.tipo::text, m.quantidade from public.movimentacao m join public.item i on i.id = m.item_id
            where m.solicitacao_id = %L and m.tipo = 'liberacao_reserva' order by i.nome $$, (select id from sol where nome = 'cancelar')),
  $$ values ('T-Lâmina', 'liberacao_reserva', 4), ('T-Microscópio', 'liberacao_reserva', 3) $$,
  'CA-08: movimentação liberacao_reserva por linha');
select results_eq(
  format($$ select cancelado_por_id, motivo_cancelamento, cancelado_em is not null from public.solicitacao where id = %L $$,
    (select id from sol where nome = 'cancelar')),
  $$ values ('00000000-0000-0000-0403-0000000000a1'::uuid, 'Professor não veio buscar', true) $$,
  'RF-10: quem cancelou, motivo e quando');
select throws_ok(format('select public.cancelar_solicitacao_aprovada(%L, %L)', (select id from sol where nome = 'cancelar'), 'x'),
  'P0001', 'Só solicitações aprovadas e ainda não retiradas podem ser canceladas aqui.', 'cancelar de novo é rejeitado');
select is(pg_temp.reservada('00000000-0000-0000-0403-00000000e001'), 0, 'RN-03: sem liberação dupla');
select throws_ok(format('select public.cancelar_solicitacao_aprovada(%L, %L)', (select id from sol where nome = 'pendente'), 'x'),
  'P0001', 'Só solicitações aprovadas e ainda não retiradas podem ser canceladas aqui.', 'pendente não se cancela por aqui');
select throws_ok(format('select public.cancelar_solicitacao_aprovada(%L, %L)', (select id from sol where nome = 'recusar'), 'x'),
  'P0001', 'Só solicitações aprovadas e ainda não retiradas podem ser canceladas aqui.', 'recusada não se cancela');
reset role;
update public.solicitacao set status = 'retirada' where id = (select id from sol where nome = 'pendente');
set local role authenticated;
select pg_temp.como('00000000-0000-0000-0403-0000000000a1');
select throws_ok(format('select public.cancelar_solicitacao_aprovada(%L, %L)', (select id from sol where nome = 'pendente'), 'x'),
  'P0001', 'Só solicitações aprovadas e ainda não retiradas podem ser canceladas aqui.', 'RF-10: retirada não se cancela');
select throws_ok($$ select public.cancelar_solicitacao_aprovada('00000000-0000-0000-0403-0000000000ff', 'x') $$,
  'P0001', 'Solicitação não encontrada.', 'solicitação inexistente');

-- Admin cancela a própria aprovada (aprovada por outro admin) ------------------------------
select pg_temp.como('00000000-0000-0000-0403-0000000000a2');
select pg_temp.aprovar_tudo((select id from sol where nome = 'propria'));
select pg_temp.como('00000000-0000-0000-0403-0000000000a1');
select lives_ok(format('select public.cancelar_solicitacao_aprovada(%L, %L)', (select id from sol where nome = 'propria'), 'Desisti'),
  'admin pode desistir da própria solicitação aprovada (libera reserva)');
select is(pg_temp.reservada('00000000-0000-0000-0403-00000000e002'), 0, 'reserva liberada');

-- Caminho negado -----------------------------------------------------------------------------
select pg_temp.como('00000000-0000-0000-0403-0000000000b1');
select throws_ok(format('select public.recusar_solicitacao(%L, %L)', (select id from sol where nome = 'recusar'), 'x'),
  'P0001', 'Apenas administradores ativos podem recusar solicitações.', 'solicitante não recusa');
select throws_ok(format('select public.cancelar_solicitacao_aprovada(%L, %L)', (select id from sol where nome = 'cancelar'), 'x'),
  'P0001', 'Apenas administradores ativos podem cancelar solicitações aprovadas.', 'solicitante não cancela aprovada');
select pg_temp.como('00000000-0000-0000-0403-0000000000a4');
select throws_ok(format('select public.recusar_solicitacao(%L, %L)', (select id from sol where nome = 'recusar'), 'x'),
  'P0001', 'Apenas administradores ativos podem recusar solicitações.', 'admin inativo não recusa');
reset role;
set local role anon;
select throws_ok($$ select public.recusar_solicitacao('00000000-0000-0000-0403-0000000000ff', 'x') $$,
  '42501', null, 'anon não executa recusar');
select throws_ok($$ select public.cancelar_solicitacao_aprovada('00000000-0000-0000-0403-0000000000ff', 'x') $$,
  '42501', null, 'anon não executa cancelar aprovada');

select * from finish();
rollback;
