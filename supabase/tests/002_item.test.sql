-- spec-002 T-03: item e movimentação (RF-05 a RF-08, RF-14, RN-01, RN-03, RN-04;
-- CA-01, CA-02, CA-03, CA-06, CA-08, CA-10, CA-12, CA-13, CA-14; P-01, P-03, P-05)
-- A concorrência de RN-03/RN-04 (RN-05) fica em supabase/tests/concorrencia/002_catalogo.test.ts.
begin;
create extension if not exists pgtap with schema extensions;
select plan(72);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0202-0000000000a1', 't-admin@teste.test'),
  ('00000000-0000-0000-0202-0000000000b1', 't-ativo@teste.test'),
  ('00000000-0000-0000-0202-0000000000c1', 't-pendente@teste.test');
insert into public.profiles (id, nome, email, perfil, status) values
  ('00000000-0000-0000-0202-0000000000a1', 'Admin', 't-admin@teste.test', 'admin', 'ativo'),
  ('00000000-0000-0000-0202-0000000000b1', 'Ativo', 't-ativo@teste.test', 'solicitante', 'ativo'),
  ('00000000-0000-0000-0202-0000000000c1', 'Pendente', 't-pendente@teste.test', 'solicitante', 'pendente');

insert into public.local (nome) values ('T-Sala 1'), ('T-Sala 2'), ('T-Sala 3'), ('T-Sala 4'), ('T-Fechada');
update public.local set ativo = false where nome = 'T-Fechada';
insert into public.tipo_item (nome, consumivel) values ('T-Kit', false), ('T-Vazio', false), ('T-Antigo', false);
update public.tipo_item set ativo = false where nome = 'T-Antigo';

create function pg_temp.como(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;
create function pg_temp.tipo(p_nome text) returns uuid language sql as $$
  select id from public.tipo_item where nome = p_nome::extensions.citext;
$$;
create function pg_temp.local(p_nome text) returns uuid language sql as $$
  select id from public.local where nome = p_nome::extensions.citext;
$$;
-- detail (jsonb) do erro levantado pelo comando
create function pg_temp.detalhe(p_sql text) returns jsonb language plpgsql as $$
declare v_detalhe text;
begin
  execute p_sql;
  return null;
exception when others then
  get stacked diagnostics v_detalhe = pg_exception_detail;
  return v_detalhe::jsonb;
end;
$$;
create function pg_temp.item(p_nome text) returns public.item language sql as $$
  select * from public.item where nome = p_nome;
$$;

-- Estrutura -------------------------------------------------------------------
select has_table('public', 'item', 'RF-05: tabela item existe');
select has_table('public', 'movimentacao', 'P-05: tabela movimentacao existe');
select ok((select relrowsecurity from pg_class where oid = 'public.item'::regclass), 'P-02: RLS em item');
select ok((select relrowsecurity from pg_class where oid = 'public.movimentacao'::regclass), 'P-02: RLS em movimentacao');
select col_default_is('public', 'item', 'quantidade_reservada', '0', 'reservada começa em 0');
select col_default_is('public', 'item', 'quantidade_em_uso', '0', 'em_uso começa em 0');
select col_default_is('public', 'item', 'operante', 'true', 'RF-05: operante por padrão');
select col_default_is('public', 'item', 'ativo', 'true', 'RF-08: item nasce ativo');
select enum_has_labels('public', 'estado_item', array['novo', 'bom', 'regular', 'ruim'], 'RF-05: estado é lista fechada');
select enum_has_labels('public', 'tipo_movimentacao',
  array['ajuste', 'reserva', 'liberacao_reserva', 'retirada', 'devolucao'], 'P-05: tipos de movimentação');

-- Admin cadastra ----------------------------------------------------------------
set local role authenticated;
select pg_temp.como('00000000-0000-0000-0202-0000000000a1');

select lives_ok(format($$ insert into public.item (nome, tipo_id, local_id, quantidade_total)
  values ('Chave de fenda', %L, %L, 10) $$, pg_temp.tipo('Ferramenta'), pg_temp.local('T-Sala 1')),
  'CA-03: 10 chaves de fenda sem patrimônio como um item');
select is((pg_temp.item('Chave de fenda')).quantidade_total, 10, 'CA-03: quantidade_total = 10');
select is((pg_temp.item('Chave de fenda')).quantidade_total - (pg_temp.item('Chave de fenda')).quantidade_reservada
  - (pg_temp.item('Chave de fenda')).quantidade_em_uso, 10, 'CA-03: 10 disponíveis');

select throws_ok(format($$ insert into public.item (nome, tipo_id, local_id, quantidade_total, numero_patrimonio)
  values ('Furadeira X', %L, %L, 5, '1234') $$, pg_temp.tipo('Máquina'), pg_temp.local('T-Sala 1')),
  'P0001', 'Item com número de patrimônio deve ter quantidade 1.', 'CA-01: patrimônio com quantidade 5 é rejeitado');
select lives_ok(format($$ insert into public.item (nome, tipo_id, local_id, quantidade_total, numero_patrimonio, estado)
  values ('Furadeira', %L, %L, 1, '1234', 'bom') $$, pg_temp.tipo('Máquina'), pg_temp.local('T-Sala 1')),
  'RF-07: patrimônio com quantidade 1');
select throws_ok(format($$ insert into public.item (nome, tipo_id, local_id, quantidade_total, numero_patrimonio)
  values ('Outra furadeira', %L, %L, 1, '1234') $$, pg_temp.tipo('Máquina'), pg_temp.local('T-Sala 1')),
  '23505', null, 'CA-02: patrimônio duplicado é rejeitado');
select throws_ok(format($$ insert into public.item (nome, tipo_id, local_id, quantidade_total, numero_patrimonio)
  values ('Outra furadeira', %L, %L, 1, ' 1234 ') $$, pg_temp.tipo('Máquina'), pg_temp.local('T-Sala 1')),
  '23505', null, 'CA-02: patrimônio com espaços nas pontas também é duplicado');
select lives_ok(format($$ insert into public.item (nome, tipo_id, local_id, quantidade_total, numero_patrimonio)
  values ('Martelo', %L, %L, 3, '  ') $$, pg_temp.tipo('Ferramenta'), pg_temp.local('T-Sala 1')),
  'patrimônio em branco é aceito');
select is((pg_temp.item('Martelo')).numero_patrimonio, null, 'patrimônio em branco vira nulo');
select throws_ok($$ update public.item set numero_patrimonio = '999' where nome = 'Chave de fenda' $$,
  'P0001', 'Item com número de patrimônio deve ter quantidade 1.',
  'RF-07: não se põe patrimônio em item com mais de 1 unidade');

select throws_ok(format($$ insert into public.item (nome, tipo_id, local_id, quantidade_total)
  values ('Negativo', %L, %L, -1) $$, pg_temp.tipo('Insumo'), pg_temp.local('T-Sala 1')),
  '23514', null, 'RF-05: quantidade_total não pode ser negativa');
select throws_ok(format($$ insert into public.item (nome, tipo_id, local_id, quantidade_total, estado)
  values ('Estado X', %L, %L, 1, 'otimo') $$, pg_temp.tipo('Insumo'), pg_temp.local('T-Sala 1')),
  '22P02', null, 'RF-05: estado fora da lista é rejeitado');
select throws_ok(format($$ insert into public.item (nome, tipo_id, local_id, quantidade_total, estoque_minimo)
  values ('Serrote', %L, %L, 2, 1) $$, pg_temp.tipo('Ferramenta'), pg_temp.local('T-Sala 1')),
  'P0001', 'Estoque mínimo só vale para tipos consumíveis.', 'estoque mínimo em ferramenta é rejeitado');
select lives_ok(format($$ insert into public.item (nome, tipo_id, local_id, quantidade_total, estoque_minimo)
  values ('Papel A4', %L, %L, 50, 5) $$, pg_temp.tipo('Insumo'), pg_temp.local('T-Sala 1')),
  'estoque mínimo em insumo é aceito');
select throws_ok(format($$ insert into public.item (nome, tipo_id, local_id, quantidade_total)
  values ('  ', %L, %L, 1) $$, pg_temp.tipo('Insumo'), pg_temp.local('T-Sala 1')),
  '23514', null, 'nome do item em branco é rejeitado');

-- RF-06 / RF-14 / P-01: contadores e operante nunca pelo cadastro, nem para admin --
select throws_ok($$ update public.item set quantidade_total = 99 where nome = 'Chave de fenda' $$,
  '42501', null, 'RF-09: quantidade_total não muda por update direto');
select throws_ok($$ update public.item set quantidade_reservada = 1 where nome = 'Chave de fenda' $$,
  '42501', null, 'RF-06: quantidade_reservada não muda por update direto');
select throws_ok($$ update public.item set quantidade_em_uso = 1 where nome = 'Chave de fenda' $$,
  '42501', null, 'RF-06: quantidade_em_uso não muda por update direto');
select throws_ok($$ update public.item set operante = false where nome = 'Chave de fenda' $$,
  '42501', null, 'RF-14: operante não muda por update direto');
select throws_ok(format($$ insert into public.item (nome, tipo_id, local_id, quantidade_total, quantidade_reservada)
  values ('Reservado', %L, %L, 5, 2) $$, pg_temp.tipo('Insumo'), pg_temp.local('T-Sala 1')),
  '42501', null, 'RF-06: reservada não entra no cadastro');
select throws_ok(format($$ insert into public.item (nome, tipo_id, local_id, quantidade_total, operante)
  values ('Quebrado', %L, %L, 1, false) $$, pg_temp.tipo('Máquina'), pg_temp.local('T-Sala 1')),
  '42501', null, 'RF-14: operante não entra no cadastro');

select lives_ok(format($$ update public.item set nome = 'Chave de fenda', descricao = 'Phillips', estado = 'regular',
  local_id = %L where nome = 'Chave de fenda' $$, pg_temp.local('T-Sala 2')), 'RF-08: admin edita o item');
select is((pg_temp.item('Chave de fenda')).local_id, pg_temp.local('T-Sala 2'), 'RF-08: edição gravada');

-- CA-12 / RN-03: tipo ou local desativado ---------------------------------------
select throws_ok(format($$ insert into public.item (nome, tipo_id, local_id, quantidade_total)
  values ('No fechado', %L, %L, 1) $$, pg_temp.tipo('Insumo'), pg_temp.local('T-Fechada')),
  'P0001', 'Local desativado.', 'CA-12: não cadastra item em local desativado');
select throws_ok(format($$ insert into public.item (nome, tipo_id, local_id, quantidade_total)
  values ('Tipo velho', %L, %L, 1) $$, pg_temp.tipo('T-Antigo'), pg_temp.local('T-Sala 1')),
  'P0001', 'Tipo desativado.', 'CA-12: não cadastra item de tipo desativado');
select throws_ok(format($$ update public.item set local_id = %L where nome = 'Martelo' $$, pg_temp.local('T-Fechada')),
  'P0001', 'Local desativado.', 'CA-12: não move item para local desativado');
select throws_ok(format($$ update public.item set tipo_id = %L where nome = 'Martelo' $$, pg_temp.tipo('T-Antigo')),
  'P0001', 'Tipo desativado.', 'CA-12: não muda item para tipo desativado');

-- CA-13 / RN-03: desativar local/tipo com itens ativos ----------------------------
select lives_ok(format($$ insert into public.item (nome, tipo_id, local_id, quantidade_total)
  values ('Trena', %L, %L, 2) $$, pg_temp.tipo('T-Kit'), pg_temp.local('T-Sala 3')), 'item na Sala 3, tipo T-Kit');
select throws_ok($$ update public.local set ativo = false where nome = 'T-Sala 1' $$,
  'P0001', 'Há 3 itens ativos neste local. Mova ou desative esses itens antes.',
  'CA-13: local com 3 itens ativos não é desativado');
select is(
  (select array_agg(i->>'nome' order by i->>'nome')
     from jsonb_array_elements(pg_temp.detalhe($$ update public.local set ativo = false where nome = 'T-Sala 1' $$)) i),
  array['Furadeira', 'Martelo', 'Papel A4'], 'CA-13: o detalhe do erro lista os itens ativos');
select throws_ok($$ update public.local set ativo = false where nome = 'T-Sala 3' $$,
  'P0001', 'Há 1 item ativo neste local. Mova ou desative esse item antes.', 'CA-13: mensagem no singular');
select throws_ok($$ update public.tipo_item set ativo = false where nome = 'T-Kit' $$,
  'P0001', 'Há 1 item ativo deste tipo. Mova ou desative esse item antes.', 'CA-13: vale para tipo de item');
select lives_ok($$ update public.item set ativo = false where nome = 'Trena' $$, 'RF-08: admin desativa o item');
select lives_ok($$ update public.local set ativo = false where nome = 'T-Sala 3' $$,
  'CA-13: sem itens ativos, o local é desativado');
select lives_ok($$ update public.tipo_item set ativo = false where nome = 'T-Kit' $$,
  'CA-13: sem itens ativos, o tipo é desativado');
select throws_ok($$ update public.item set ativo = true where nome = 'Trena' $$,
  'P0001', 'Tipo desativado.', 'CA-12: não reativa item com tipo e local desativados');
select lives_ok($$ update public.tipo_item set ativo = true where nome = 'T-Kit' $$, 'reativa o tipo');
select throws_ok($$ update public.item set ativo = true where nome = 'Trena' $$,
  'P0001', 'Local desativado.', 'CA-12: não reativa item em local desativado');
select lives_ok($$ update public.item set descricao = 'Guardada' where nome = 'Trena' $$,
  'item desativado em local desativado ainda pode ser editado');

-- CA-14 / RN-04: consumível só muda sem itens -------------------------------------
select throws_ok($$ update public.tipo_item set consumivel = true where nome = 'Ferramenta' $$,
  'P0001', 'Este tipo já tem itens; não é possível mudar se é consumível.', 'CA-14: Ferramenta com itens');
select throws_ok($$ update public.tipo_item set consumivel = true where nome = 'T-Kit' $$,
  'P0001', 'Este tipo já tem itens; não é possível mudar se é consumível.', 'CA-14: conta itens desativados também');
select lives_ok($$ update public.tipo_item set consumivel = true where nome = 'T-Vazio' $$, 'CA-14: tipo sem itens muda');
select lives_ok($$ update public.tipo_item set nome = 'Ferramentas' where nome = 'Ferramenta' $$,
  'tipo com itens pode ser renomeado');

-- RF-03 / RF-08 / CA-08: exclusão ---------------------------------------------------
select throws_ok(format($$ delete from public.tipo_item where id = %L $$, pg_temp.tipo('Máquina')),
  '23503', null, 'RF-03: tipo em uso não é excluído');
select throws_ok(format($$ delete from public.local where id = %L $$, pg_temp.local('T-Sala 2')),
  '23503', null, 'local em uso não é excluído');
reset role;
insert into public.movimentacao (item_id, tipo, quantidade, motivo, usuario_id)
values ((pg_temp.item('Furadeira')).id, 'ajuste', 1, 'Carga inicial', '00000000-0000-0000-0202-0000000000a1');
set local role authenticated;
select throws_ok($$ delete from public.item where nome = 'Furadeira' $$,
  '23503', null, 'CA-08: item com movimentação não é excluído');
select lives_ok($$ delete from public.item where nome = 'Martelo' $$, 'RF-08: item sem histórico pode ser excluído');
select is_empty($$ select 1 from public.item where nome = 'Martelo' $$, 'RF-08: exclusão efetivada');

-- P-05: movimentação é imutável e só RPC grava ---------------------------------------
select throws_ok(format($$ insert into public.movimentacao (item_id, tipo, quantidade, motivo, usuario_id)
  values (%L, 'ajuste', 1, 'x', %L) $$, (pg_temp.item('Furadeira')).id, '00000000-0000-0000-0202-0000000000a1'),
  '42501', null, 'P-01: nem admin grava movimentação direto');
select is((select count(*)::int from public.movimentacao), 1, 'admin lê movimentações');
reset role;
select throws_ok($$ update public.movimentacao set quantidade = 2 $$,
  'P0001', 'A movimentação não pode ser alterada nem apagada.', 'P-05: movimentação não é alterada');
select throws_ok($$ delete from public.movimentacao $$,
  'P0001', 'A movimentação não pode ser alterada nem apagada.', 'P-05: movimentação não é apagada');
select throws_ok(format($$ insert into public.movimentacao (item_id, tipo, quantidade, usuario_id)
  values (%L, 'ajuste', 1, %L) $$, (pg_temp.item('Furadeira')).id, '00000000-0000-0000-0202-0000000000a1'),
  '23514', null, 'RF-09: ajuste exige motivo');
select throws_ok(format($$ update public.item set quantidade_reservada = 8, quantidade_em_uso = 3 where id = %L $$,
  (pg_temp.item('Chave de fenda')).id), '23514', null, 'P-03: reservada + em_uso não passa do total');

-- CA-06 / CA-10: solicitante só lê itens ativos -------------------------------------
set local role authenticated;
select pg_temp.como('00000000-0000-0000-0202-0000000000b1');
select isnt_empty($$ select 1 from public.item where nome = 'Chave de fenda' $$, 'RN-01: solicitante lê item ativo');
select is_empty($$ select 1 from public.item where nome = 'Trena' $$, 'CA-10: item desativado invisível para solicitante');
select is_empty($$ select 1 from public.movimentacao $$, 'solicitante não lê movimentações');
select throws_ok(format($$ insert into public.item (nome, tipo_id, local_id, quantidade_total)
  values ('Pirata', %L, %L, 1) $$, pg_temp.tipo('Insumo'), pg_temp.local('T-Sala 2')),
  '42501', null, 'CA-06: solicitante não cria item');
update public.item set nome = 'Hackeado' where nome = 'Chave de fenda';
delete from public.item where nome = 'Papel A4';
select pg_temp.como('00000000-0000-0000-0202-0000000000c1');
select is_empty($$ select 1 from public.item $$, 'pendente não lê itens');
reset role;
set local role anon;
select throws_ok($$ select 1 from public.item $$, '42501', null, 'anon não lê itens');
reset role;
select isnt_empty($$ select 1 from public.item where nome = 'Chave de fenda' $$, 'CA-06: edição do solicitante não teve efeito');
select isnt_empty($$ select 1 from public.item where nome = 'Papel A4' $$, 'CA-06: exclusão do solicitante não teve efeito');

select * from finish();
rollback;
