-- spec-002 T-05: ajuste manual de quantidade (RF-07, RF-09; CA-04; P-01, P-04, P-05)
begin;
create extension if not exists pgtap with schema extensions;
select plan(24);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0203-0000000000a1', 't-admin@teste.test'),
  ('00000000-0000-0000-0203-0000000000a2', 't-admin-inativo@teste.test'),
  ('00000000-0000-0000-0203-0000000000b1', 't-ativo@teste.test'),
  ('00000000-0000-0000-0203-0000000000c1', 't-pendente@teste.test'),
  ('00000000-0000-0000-0203-0000000000d1', 't-inativo@teste.test');
insert into public.profiles (id, nome, email, perfil, status) values
  ('00000000-0000-0000-0203-0000000000a1', 'Admin', 't-admin@teste.test', 'admin', 'ativo'),
  ('00000000-0000-0000-0203-0000000000a2', 'Admin inativo', 't-admin-inativo@teste.test', 'admin', 'inativo'),
  ('00000000-0000-0000-0203-0000000000b1', 'Ativo', 't-ativo@teste.test', 'solicitante', 'ativo'),
  ('00000000-0000-0000-0203-0000000000c1', 'Pendente', 't-pendente@teste.test', 'solicitante', 'pendente'),
  ('00000000-0000-0000-0203-0000000000d1', 'Inativo', 't-inativo@teste.test', 'solicitante', 'inativo');

insert into public.local (id, nome) values ('00000000-0000-0000-0203-00000000f001', 'T-Depósito');
insert into public.item (id, nome, tipo_id, local_id, quantidade_total, numero_patrimonio) values
  ('00000000-0000-0000-0203-00000000e001', 'Alicate', (select id from public.tipo_item where nome = 'Ferramenta'),
   '00000000-0000-0000-0203-00000000f001', 10, null),
  ('00000000-0000-0000-0203-00000000e002', 'Torno', (select id from public.tipo_item where nome = 'Máquina'),
   '00000000-0000-0000-0203-00000000f001', 1, 'PAT-1');
-- CA-04: reservada 3 e em_uso 2 (como fariam as RPCs das specs 004 e 005)
update public.item set quantidade_reservada = 3, quantidade_em_uso = 2
 where id = '00000000-0000-0000-0203-00000000e001';

create function pg_temp.como(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;
create function pg_temp.total(p_id uuid) returns integer language sql as $$
  select quantidade_total from public.item where id = p_id;
$$;

set local role authenticated;
select pg_temp.como('00000000-0000-0000-0203-0000000000a1');

-- CA-04 -------------------------------------------------------------------------
select throws_ok($$ select public.ajustar_quantidade_item('00000000-0000-0000-0203-00000000e001', 4, 'Contagem') $$,
  'P0001', 'A quantidade não pode ficar menor que o reservado mais o em uso (5).',
  'CA-04: ajuste para 4 com reservada 3 + em_uso 2 é rejeitado');
select is(pg_temp.total('00000000-0000-0000-0203-00000000e001'), 10, 'CA-04: total não mudou');
select is_empty($$ select 1 from public.movimentacao $$, 'CA-04: nenhuma movimentação gravada');

-- RF-09: ajuste válido grava movimentação com a diferença e o motivo ----------------
select is((public.ajustar_quantidade_item('00000000-0000-0000-0203-00000000e001', 5, '  Perda na contagem ')).quantidade_total,
  5, 'RF-09: ajuste até reservada + em_uso é aceito');
select is((public.ajustar_quantidade_item('00000000-0000-0000-0203-00000000e001', 12, 'Compra')).quantidade_total,
  12, 'RF-09: ajuste para cima');
select results_eq(
  $$ select tipo::text, quantidade, motivo, usuario_id from public.movimentacao order by id $$,
  $$ values ('ajuste', -5, 'Perda na contagem', '00000000-0000-0000-0203-0000000000a1'::uuid),
            ('ajuste', 7, 'Compra', '00000000-0000-0000-0203-0000000000a1'::uuid) $$,
  'RF-09 / P-05: movimentação ajuste com diferença com sinal, motivo e autor');

-- Validações --------------------------------------------------------------------
select throws_ok($$ select public.ajustar_quantidade_item('00000000-0000-0000-0203-00000000e001', 8, null) $$,
  'P0001', 'Informe o motivo do ajuste.', 'RF-09: motivo nulo é rejeitado');
select throws_ok($$ select public.ajustar_quantidade_item('00000000-0000-0000-0203-00000000e001', 8, '   ') $$,
  'P0001', 'Informe o motivo do ajuste.', 'RF-09: motivo em branco é rejeitado');
select throws_ok($$ select public.ajustar_quantidade_item('00000000-0000-0000-0203-00000000e001', -1, 'x') $$,
  'P0001', 'A quantidade não pode ser negativa.', 'quantidade negativa é rejeitada');
select throws_ok($$ select public.ajustar_quantidade_item('00000000-0000-0000-0203-00000000e001', 12, 'x') $$,
  'P0001', 'A quantidade informada é igual à atual.', 'ajuste sem mudança é rejeitado');
select throws_ok($$ select public.ajustar_quantidade_item('00000000-0000-0000-0203-0000000000ff', 1, 'x') $$,
  'P0001', 'Item não encontrado.', 'item inexistente');

-- RF-07: patrimônio só 0 ou 1 ---------------------------------------------------
select throws_ok($$ select public.ajustar_quantidade_item('00000000-0000-0000-0203-00000000e002', 2, 'x') $$,
  'P0001', 'Item com número de patrimônio deve ter quantidade 1.', 'RF-07: patrimônio não passa de 1');
select is((public.ajustar_quantidade_item('00000000-0000-0000-0203-00000000e002', 0, 'Extraviado')).quantidade_total,
  0, 'RF-07: patrimônio pode ir a 0');
select is((public.ajustar_quantidade_item('00000000-0000-0000-0203-00000000e002', 1, 'Encontrado')).quantidade_total,
  1, 'RF-07: e voltar a 1');

-- Caminho negado ---------------------------------------------------------------
select pg_temp.como('00000000-0000-0000-0203-0000000000b1');
select throws_ok($$ select public.ajustar_quantidade_item('00000000-0000-0000-0203-00000000e001', 20, 'x') $$,
  'P0001', 'Apenas administradores ativos podem ajustar o estoque.', 'solicitante não ajusta');
select pg_temp.como('00000000-0000-0000-0203-0000000000c1');
select throws_ok($$ select public.ajustar_quantidade_item('00000000-0000-0000-0203-00000000e001', 20, 'x') $$,
  'P0001', 'Apenas administradores ativos podem ajustar o estoque.', 'pendente não ajusta');
select pg_temp.como('00000000-0000-0000-0203-0000000000d1');
select throws_ok($$ select public.ajustar_quantidade_item('00000000-0000-0000-0203-00000000e001', 20, 'x') $$,
  'P0001', 'Apenas administradores ativos podem ajustar o estoque.', 'inativo não ajusta');
select pg_temp.como('00000000-0000-0000-0203-0000000000a2');
select throws_ok($$ select public.ajustar_quantidade_item('00000000-0000-0000-0203-00000000e001', 20, 'x') $$,
  'P0001', 'Apenas administradores ativos podem ajustar o estoque.', 'admin inativo não ajusta');
select throws_ok($$ select public.ajustar_quantidade_item('00000000-0000-0000-0203-0000000000ff', 20, 'x') $$,
  'P0001', 'Apenas administradores ativos podem ajustar o estoque.', 'não-admin não descobre se o item existe');
reset role;
set local role anon;
select throws_ok($$ select public.ajustar_quantidade_item('00000000-0000-0000-0203-00000000e001', 20, 'x') $$,
  '42501', null, 'anon não executa');
reset role;
select is(pg_temp.total('00000000-0000-0000-0203-00000000e001'), 12, 'tentativas negadas não mudaram o total');
select is((select count(*)::int from public.movimentacao), 4, 'tentativas negadas não gravaram movimentação');
select ok(has_function_privilege('authenticated', 'public.ajustar_quantidade_item(uuid, integer, text)', 'execute'),
  'authenticated executa (a função checa o perfil)');
select is((select prosecdef from pg_proc where oid = 'public.ajustar_quantidade_item(uuid, integer, text)'::regprocedure),
  true, 'P-01: SECURITY DEFINER (único caminho para mudar quantidade_total)');

select * from finish();
rollback;
