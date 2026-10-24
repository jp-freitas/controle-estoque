-- spec-004 T-03: aprovar_solicitacao (RF-01 a RF-07, RF-09, RF-14; CA-01, CA-02, CA-04,
-- CA-05, CA-07, CA-09, CA-10, CA-13; spec-006/CA-04). A concorrência (CA-03) fica em
-- supabase/tests/concorrencia/004_aprovacao.test.ts.
begin;
create extension if not exists pgtap with schema extensions;
select plan(41);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0402-0000000000a1', 't-admin-a@teste.test'),
  ('00000000-0000-0000-0402-0000000000a2', 't-admin-b@teste.test'),
  ('00000000-0000-0000-0402-0000000000a3', 't-admin-pendente@teste.test'),
  ('00000000-0000-0000-0402-0000000000a4', 't-admin-inativo@teste.test'),
  ('00000000-0000-0000-0402-0000000000b1', 't-prof@teste.test'),
  ('00000000-0000-0000-0402-0000000000b2', 't-prof-saiu@teste.test'),
  ('00000000-0000-0000-0402-0000000000b3', 't-prof-voltou@teste.test');
insert into public.profiles (id, nome, email, perfil, status) values
  ('00000000-0000-0000-0402-0000000000a1', 'Admin A', 't-admin-a@teste.test', 'admin', 'ativo'),
  ('00000000-0000-0000-0402-0000000000a2', 'Admin B', 't-admin-b@teste.test', 'admin', 'ativo'),
  ('00000000-0000-0000-0402-0000000000a3', 'Admin pendente', 't-admin-pendente@teste.test', 'admin', 'pendente'),
  ('00000000-0000-0000-0402-0000000000a4', 'Admin inativo', 't-admin-inativo@teste.test', 'admin', 'inativo'),
  ('00000000-0000-0000-0402-0000000000b1', 'Prof', 't-prof@teste.test', 'solicitante', 'ativo'),
  ('00000000-0000-0000-0402-0000000000b2', 'Prof que saiu', 't-prof-saiu@teste.test', 'solicitante', 'ativo'),
  ('00000000-0000-0000-0402-0000000000b3', 'Prof que voltou', 't-prof-voltou@teste.test', 'solicitante', 'ativo');

insert into public.local (id, nome) values ('00000000-0000-0000-0402-00000000f001', 'T-Depósito');
insert into public.item (id, nome, tipo_id, local_id, quantidade_total) values
  ('00000000-0000-0000-0402-00000000e001', 'T-Furadeira', (select id from public.tipo_item where nome = 'Ferramenta'),
   '00000000-0000-0000-0402-00000000f001', 10),
  ('00000000-0000-0000-0402-00000000e002', 'T-Cola', (select id from public.tipo_item where nome = 'Insumo'),
   '00000000-0000-0000-0402-00000000f001', 10),
  ('00000000-0000-0000-0402-00000000e003', 'T-Tesoura', (select id from public.tipo_item where nome = 'Ferramenta'),
   '00000000-0000-0000-0402-00000000f001', 4),
  ('00000000-0000-0000-0402-00000000e004', 'T-Esquadro', (select id from public.tipo_item where nome = 'Ferramenta'),
   '00000000-0000-0000-0402-00000000f001', 2),
  ('00000000-0000-0000-0402-00000000e005', 'T-Serra', (select id from public.tipo_item where nome = 'Máquina'),
   '00000000-0000-0000-0402-00000000f001', 1),
  ('00000000-0000-0000-0402-00000000e006', 'T-Velho', (select id from public.tipo_item where nome = 'Ferramenta'),
   '00000000-0000-0000-0402-00000000f001', 3);

create function pg_temp.como(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;
create function pg_temp.reservada(p_id uuid) returns integer language sql as $$
  select quantidade_reservada from public.item where id = p_id;
$$;
create function pg_temp.status(p_id uuid) returns text language sql as $$
  select status::text from public.solicitacao where id = p_id;
$$;
-- payload com a quantidade aprovada de cada linha, na ordem dada
create function pg_temp.itens(p_sol uuid, variadic p_qtds integer[]) returns jsonb language sql as $$
  select jsonb_agg(jsonb_build_object('solicitacao_item_id', l.id, 'quantidade_aprovada', p_qtds[l.n]) order by l.n)
    from (select id, row_number() over (order by item_nome) as n
            from public.solicitacao_item where solicitacao_id = p_sol) l;
$$;
create function pg_temp.detalhe(p_sql text) returns jsonb language plpgsql as $$
declare v_detalhe text;
begin
  execute p_sql;
  return null;
exception when others then
  get stacked diagnostics v_detalhe = pg_exception_detail;
  return nullif(v_detalhe, '')::jsonb;
end;
$$;

-- Solicitações enviadas pelos próprios usuários (spec 003)
set local role authenticated;
select pg_temp.como('00000000-0000-0000-0402-0000000000b1');
create temp table sol (nome text primary key, id uuid);
grant all on sol to authenticated;
insert into sol values
  ('ca01', public.enviar_solicitacao('[{"item_id": "00000000-0000-0000-0402-00000000e001", "quantidade": 5}]', 'Aula 1')),
  ('ca02', public.enviar_solicitacao('[{"item_id": "00000000-0000-0000-0402-00000000e002", "quantidade": 3},
     {"item_id": "00000000-0000-0000-0402-00000000e003", "quantidade": 4},
     {"item_id": "00000000-0000-0000-0402-00000000e004", "quantidade": 2}]', 'Aula 2')),
  ('ca09', public.enviar_solicitacao('[{"item_id": "00000000-0000-0000-0402-00000000e005", "quantidade": 1},
     {"item_id": "00000000-0000-0000-0402-00000000e002", "quantidade": 1}]', 'Aula 3')),
  ('desat', public.enviar_solicitacao('[{"item_id": "00000000-0000-0000-0402-00000000e006", "quantidade": 1}]', 'Aula 4'));
select pg_temp.como('00000000-0000-0000-0402-0000000000a1');
insert into sol values
  ('propria', public.enviar_solicitacao('[{"item_id": "00000000-0000-0000-0402-00000000e002", "quantidade": 1}]', 'Do admin A'));
select pg_temp.como('00000000-0000-0000-0402-0000000000b2');
insert into sol values
  ('saiu', public.enviar_solicitacao('[{"item_id": "00000000-0000-0000-0402-00000000e002", "quantidade": 1}]', 'Antes de sair'));
select pg_temp.como('00000000-0000-0000-0402-0000000000b3');
insert into sol values
  ('voltou', public.enviar_solicitacao('[{"item_id": "00000000-0000-0000-0402-00000000e002", "quantidade": 1}]', 'Antes de voltar'));
reset role;

-- Mudanças depois do envio: reservas de outras aprovações, item quebrado/desativado, solicitantes fora
select set_config('app.origem', 'movimentacao', true);
update public.item set quantidade_reservada = 8 where id = '00000000-0000-0000-0402-00000000e001';
update public.item set quantidade_reservada = 2 where id = '00000000-0000-0000-0402-00000000e004';
select set_config('app.origem', '', true);
update public.item set operante = false where id = '00000000-0000-0000-0402-00000000e005';
update public.item set ativo = false where id = '00000000-0000-0000-0402-00000000e006';
update public.profiles set status = 'inativo' where id = '00000000-0000-0000-0402-0000000000b2';
update public.profiles set status = 'pendente' where id = '00000000-0000-0000-0402-0000000000b3';
create temp table aud_antes as select count(*) as n from public.auditoria;
grant select on aud_antes to authenticated;

set local role authenticated;
select pg_temp.como('00000000-0000-0000-0402-0000000000a1');

-- CA-01: total 10, reservada 8, aprovar 5 -------------------------------------------
select throws_ok(format('select public.aprovar_solicitacao(%L, %L)',
  (select id from sol where nome = 'ca01'), pg_temp.itens((select id from sol where nome = 'ca01'), 5)),
  'P0001', 'Não foi possível aprovar. Confira os itens indicados.', 'CA-01: aprovar 5 com disponível 2 é rejeitado');
select is(
  pg_temp.detalhe(format('select public.aprovar_solicitacao(%L, %L)',
    (select id from sol where nome = 'ca01'), pg_temp.itens((select id from sol where nome = 'ca01'), 5))) -> 0 ->> 'motivo',
  'Estoque insuficiente: disponível 2.', 'CA-01: "estoque insuficiente" com o disponível, no item');
select is(pg_temp.reservada('00000000-0000-0000-0402-00000000e001'), 8, 'CA-01: reservada não muda');
select is(pg_temp.status((select id from sol where nome = 'ca01')), 'pendente', 'CA-01: continua pendente');
select is((select count(*)::int from public.movimentacao), 0, 'CA-01: nenhuma movimentação');

-- CA-02: aprovação parcial com 0 em uma linha ----------------------------------------
-- itens em ordem de nome: T-Cola (3), T-Esquadro (2, disponível 0), T-Tesoura (4)
select lives_ok(format('select public.aprovar_solicitacao(%L, %L, %L)',
  (select id from sol where nome = 'ca02'), pg_temp.itens((select id from sol where nome = 'ca02'), 3, 0, 2),
  '  Só há 2 tesouras livres. '), 'CA-02: aprova 2 linhas e 0 na sem estoque');
select is(pg_temp.status((select id from sol where nome = 'ca02')), 'aprovada', 'CA-02: fica aprovada');
select results_eq(
  format($$ select item_nome, quantidade_aprovada from public.solicitacao_item
            where solicitacao_id = %L order by item_nome $$, (select id from sol where nome = 'ca02')),
  $$ values ('T-Cola', 3), ('T-Esquadro', 0), ('T-Tesoura', 2) $$, 'CA-02: quantidade aprovada por linha, inclusive 0');
select is(pg_temp.reservada('00000000-0000-0000-0402-00000000e002'), 3, 'CA-02: reserva da cola');
select is(pg_temp.reservada('00000000-0000-0000-0402-00000000e003'), 2, 'CA-02: reserva da tesoura');
select is(pg_temp.reservada('00000000-0000-0000-0402-00000000e004'), 2, 'CA-02: esquadro sem reserva nova');
select results_eq(
  $$ select i.nome, m.tipo::text, m.quantidade, m.usuario_id from public.movimentacao m
       join public.item i on i.id = m.item_id order by i.nome $$,
  $$ values ('T-Cola', 'reserva', 3, '00000000-0000-0000-0402-0000000000a1'::uuid),
            ('T-Tesoura', 'reserva', 2, '00000000-0000-0000-0402-0000000000a1'::uuid) $$,
  'RF-04: movimentação reserva só nas linhas com aprovada > 0');
select is((select count(*)::int from public.movimentacao where solicitacao_id = (select id from sol where nome = 'ca02')),
  2, 'RF-04: movimentações ligadas à solicitação');
select results_eq(
  format($$ select aprovador_id, data_decisao is not null, observacao_decisao from public.solicitacao where id = %L $$,
    (select id from sol where nome = 'ca02')),
  $$ values ('00000000-0000-0000-0402-0000000000a1'::uuid, true, 'Só há 2 tesouras livres.') $$,
  'RF-04: aprovador, data da decisão e observação gravados');
select is((select count(*) from public.auditoria), (select n from aud_antes),
  'spec-006/CA-04: reserva não gera auditoria de item');

-- CA-07: aprovar de novo -------------------------------------------------------------
select throws_ok(format('select public.aprovar_solicitacao(%L, %L)',
  (select id from sol where nome = 'ca02'), pg_temp.itens((select id from sol where nome = 'ca02'), 3, 0, 2)),
  'P0001', 'Só solicitações pendentes podem ser aprovadas.', 'CA-07: aprovar de novo é rejeitado');
select is(pg_temp.reservada('00000000-0000-0000-0402-00000000e002'), 3, 'CA-07: sem reserva duplicada');

-- CA-09 / RF-07: item ficou inoperante -------------------------------------------------
-- itens em ordem de nome: T-Cola (1), T-Serra (1, inoperante)
select is(
  pg_temp.detalhe(format('select public.aprovar_solicitacao(%L, %L)',
    (select id from sol where nome = 'ca09'), pg_temp.itens((select id from sol where nome = 'ca09'), 1, 1))) -> 0 ->> 'motivo',
  'Item inoperante.', 'CA-09: aprovar quantidade > 0 de item inoperante é rejeitado');
select is(pg_temp.reservada('00000000-0000-0000-0402-00000000e002'), 3, 'CA-09: nada reservado');
select lives_ok(format('select public.aprovar_solicitacao(%L, %L)',
  (select id from sol where nome = 'ca09'), pg_temp.itens((select id from sol where nome = 'ca09'), 1, 0)),
  'RF-07: com 0 para o inoperante, aprova o resto');

-- Item desativado depois do envio --------------------------------------------------------
select is(
  pg_temp.detalhe(format('select public.aprovar_solicitacao(%L, %L)',
    (select id from sol where nome = 'desat'), pg_temp.itens((select id from sol where nome = 'desat'), 1))) -> 0 ->> 'motivo',
  'Item desativado.', 'item desativado depois do envio não é aprovado');

-- CA-10 ------------------------------------------------------------------------------
select throws_ok(format('select public.aprovar_solicitacao(%L, %L)',
  (select id from sol where nome = 'ca01'), pg_temp.itens((select id from sol where nome = 'ca01'), 0)),
  'P0001', 'Nada foi aprovado. Para não atender a solicitação, use Recusar.', 'CA-10: soma aprovada 0 orienta a recusar');

-- Payload ----------------------------------------------------------------------------
select throws_ok(format('select public.aprovar_solicitacao(%L, %L)',
  (select id from sol where nome = 'ca01'), '[]'),
  'P0001', 'Informe a quantidade aprovada de todos os itens da solicitação.', 'payload sem as linhas');
select throws_ok(format('select public.aprovar_solicitacao(%L, %L)',
  (select id from sol where nome = 'ca01'), pg_temp.itens((select id from sol where nome = 'ca02'), 1, 1, 1)),
  'P0001', 'Informe a quantidade aprovada de todos os itens da solicitação.', 'linhas de outra solicitação');
select throws_ok(format('select public.aprovar_solicitacao(%L, %L)',
  (select id from sol where nome = 'ca01'), pg_temp.itens((select id from sol where nome = 'ca01'), 6)),
  'P0001', 'A quantidade aprovada deve ficar entre 0 e a solicitada.', 'aprovada acima da solicitada');
select throws_ok(format('select public.aprovar_solicitacao(%L, %L)',
  (select id from sol where nome = 'ca01'), '[{"solicitacao_item_id": "x", "quantidade_aprovada": 1}]'),
  'P0001', 'Lista de itens inválida.', 'id de linha inválido');
select throws_ok($$ select public.aprovar_solicitacao('00000000-0000-0000-0402-0000000000ff', '[]') $$,
  'P0001', 'Solicitação não encontrada.', 'solicitação inexistente');

-- CA-05 / RF-02 ----------------------------------------------------------------------------
select throws_ok(format('select public.aprovar_solicitacao(%L, %L)',
  (select id from sol where nome = 'propria'), pg_temp.itens((select id from sol where nome = 'propria'), 1)),
  'P0001', 'Você não pode decidir a própria solicitação. Peça a outro administrador.', 'CA-05: admin não aprova a própria');
select pg_temp.como('00000000-0000-0000-0402-0000000000a2');
select lives_ok(format('select public.aprovar_solicitacao(%L, %L)',
  (select id from sol where nome = 'propria'), pg_temp.itens((select id from sol where nome = 'propria'), 1)),
  'RN-01 / CA-05: outro admin aprova');

-- CA-13 / RF-14 ------------------------------------------------------------------------------
select throws_ok(format('select public.aprovar_solicitacao(%L, %L)',
  (select id from sol where nome = 'saiu'), pg_temp.itens((select id from sol where nome = 'saiu'), 1)),
  'P0001', 'O solicitante não está ativo; recuse a solicitação.', 'CA-13: solicitante inativado depois do envio');
select throws_ok(format('select public.aprovar_solicitacao(%L, %L)',
  (select id from sol where nome = 'voltou'), pg_temp.itens((select id from sol where nome = 'voltou'), 1)),
  'P0001', 'O solicitante não está ativo; recuse a solicitação.', 'CA-13: solicitante que voltou a pendente');
select is(pg_temp.status((select id from sol where nome = 'saiu')), 'pendente', 'CA-13: nada muda');

-- CA-04 / RF-01: caminho negado -------------------------------------------------------------
select pg_temp.como('00000000-0000-0000-0402-0000000000b1');
select throws_ok(format('select public.aprovar_solicitacao(%L, %L)',
  (select id from sol where nome = 'ca01'), pg_temp.itens((select id from sol where nome = 'ca01'), 1)),
  'P0001', 'Apenas administradores ativos podem aprovar solicitações.', 'CA-04: solicitante não aprova');
select pg_temp.como('00000000-0000-0000-0402-0000000000a3');
select throws_ok(format('select public.aprovar_solicitacao(%L, %L)',
  (select id from sol where nome = 'ca01'), pg_temp.itens((select id from sol where nome = 'ca01'), 1)),
  'P0001', 'Apenas administradores ativos podem aprovar solicitações.', 'CA-04: admin pendente não aprova');
select pg_temp.como('00000000-0000-0000-0402-0000000000a4');
select throws_ok(format('select public.aprovar_solicitacao(%L, %L)',
  (select id from sol where nome = 'ca01'), pg_temp.itens((select id from sol where nome = 'ca01'), 1)),
  'P0001', 'Apenas administradores ativos podem aprovar solicitações.', 'CA-04: admin inativo não aprova');
reset role;
set local role anon;
select throws_ok($$ select public.aprovar_solicitacao('00000000-0000-0000-0402-0000000000ff', '[]') $$,
  '42501', null, 'CA-04: anon não executa');
reset role;
select is(pg_temp.status((select id from sol where nome = 'ca01')), 'pendente', 'CA-04: tentativas negadas não aprovaram');

-- Aprovação válida do CA-01 com o que há --------------------------------------------------
set local role authenticated;
select pg_temp.como('00000000-0000-0000-0402-0000000000a1');
select lives_ok(format('select public.aprovar_solicitacao(%L, %L)',
  (select id from sol where nome = 'ca01'), pg_temp.itens((select id from sol where nome = 'ca01'), 2)),
  'CA-01: aprovar o disponível (2) funciona');
select is(pg_temp.reservada('00000000-0000-0000-0402-00000000e001'), 10, 'P-03: reservada chega ao total, sem passar');
select is((select quantidade_aprovada from public.solicitacao_item where solicitacao_id = (select id from sol where nome = 'ca01')),
  2, 'aprovação parcial registrada');
select is((select observacao_decisao from public.solicitacao where id = (select id from sol where nome = 'ca01')),
  null, 'observação é opcional');

select * from finish();
rollback;
