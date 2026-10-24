-- spec-003 T-04: enviar_solicitacao (RF-01, RF-03, RF-05 a RF-07, RN-03; CA-01 a CA-04, CA-08)
begin;
create extension if not exists pgtap with schema extensions;
select plan(30);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0303-0000000000a1', 't-admin@teste.test'),
  ('00000000-0000-0000-0303-0000000000b1', 't-prof@teste.test'),
  ('00000000-0000-0000-0303-0000000000c1', 't-pendente@teste.test'),
  ('00000000-0000-0000-0303-0000000000d1', 't-inativo@teste.test');
insert into public.profiles (id, nome, email, perfil, status) values
  ('00000000-0000-0000-0303-0000000000a1', 'Admin', 't-admin@teste.test', 'admin', 'ativo'),
  ('00000000-0000-0000-0303-0000000000b1', 'Prof', 't-prof@teste.test', 'solicitante', 'ativo'),
  ('00000000-0000-0000-0303-0000000000c1', 'Pendente', 't-pendente@teste.test', 'solicitante', 'pendente'),
  ('00000000-0000-0000-0303-0000000000d1', 'Inativo', 't-inativo@teste.test', 'solicitante', 'inativo');
insert into public.local (id, nome) values ('00000000-0000-0000-0303-00000000f001', 'T-Sala');
insert into public.item (id, nome, tipo_id, local_id, quantidade_total) values
  ('00000000-0000-0000-0303-00000000e001', 'T-Projetor', (select id from public.tipo_item where nome = 'Máquina'),
   '00000000-0000-0000-0303-00000000f001', 1),
  ('00000000-0000-0000-0303-00000000e002', 'T-Papel', (select id from public.tipo_item where nome = 'Insumo'),
   '00000000-0000-0000-0303-00000000f001', 10),
  ('00000000-0000-0000-0303-00000000e003', 'T-Pincel', (select id from public.tipo_item where nome = 'Ferramenta'),
   '00000000-0000-0000-0303-00000000f001', 5),
  ('00000000-0000-0000-0303-00000000e004', 'T-Serra', (select id from public.tipo_item where nome = 'Máquina'),
   '00000000-0000-0000-0303-00000000f001', 1),
  ('00000000-0000-0000-0303-00000000e005', 'T-Antigo', (select id from public.tipo_item where nome = 'Ferramenta'),
   '00000000-0000-0000-0303-00000000f001', 3);
-- T-Pincel: disponível 2 (total 5, reservada 2, em uso 1)
update public.item set quantidade_reservada = 2, quantidade_em_uso = 1 where id = '00000000-0000-0000-0303-00000000e003';
update public.item set operante = false where id = '00000000-0000-0000-0303-00000000e004';
update public.item set ativo = false where id = '00000000-0000-0000-0303-00000000e005';

create function pg_temp.como(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;
-- detail (jsonb) do erro levantado pelo comando
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
create function pg_temp.envio_devolve_id() returns boolean language plpgsql as $$
declare v_id uuid;
begin
  v_id := public.enviar_solicitacao('[{"item_id": "00000000-0000-0000-0303-00000000e002", "quantidade": 1}]', 'Outra aula');
  return exists (select 1 from public.solicitacao where id = v_id and justificativa = 'Outra aula');
end;
$$;
create temp table contadores as
  select id, quantidade_total, quantidade_reservada, quantidade_em_uso from public.item;
grant select on contadores to authenticated;
create function pg_temp.contadores_iguais() returns boolean language sql as $$
  select not exists (
    select 1 from public.item i join contadores c using (id)
     where (i.quantidade_total, i.quantidade_reservada, i.quantidade_em_uso)
           is distinct from (c.quantidade_total, c.quantidade_reservada, c.quantidade_em_uso));
$$;

set local role authenticated;
select pg_temp.como('00000000-0000-0000-0303-0000000000b1');

-- CA-01 -------------------------------------------------------------------------
select lives_ok($$ select public.enviar_solicitacao(
  '[{"item_id": "00000000-0000-0000-0303-00000000e001", "quantidade": 1},
    {"item_id": "00000000-0000-0000-0303-00000000e002", "quantidade": 4}]', '  Aula de ciências 7º A ') $$,
  'CA-01: professor ativo envia 2 itens disponíveis');
select results_eq($$ select status::text, justificativa, solicitante_id from public.solicitacao $$,
  $$ values ('pendente', 'Aula de ciências 7º A', '00000000-0000-0000-0303-0000000000b1'::uuid) $$,
  'CA-01 / RF-01: pendente, em nome de quem enviou, justificativa sem espaços nas pontas');
select results_eq($$ select item_nome, quantidade_solicitada from public.solicitacao_item order by item_nome $$,
  $$ values ('T-Papel', 4), ('T-Projetor', 1) $$, 'CA-01: 2 linhas com nome e quantidade');
select ok(pg_temp.contadores_iguais(), 'CA-01 / RF-05: nenhum contador de estoque mudou');
select is((select count(*)::int from public.movimentacao), 0, 'RF-05: nenhuma movimentação no envio');
select ok(pg_temp.envio_devolve_id(), 'retorna o id da solicitação criada');

-- CA-02 -------------------------------------------------------------------------
select throws_ok($$ select public.enviar_solicitacao(
  '[{"item_id": "00000000-0000-0000-0303-00000000e003", "quantidade": 3}]', 'Aula') $$,
  'P0001', 'Alguns itens não podem ser solicitados.', 'CA-02: disponível 2, pede 3 → rejeitado');
select is(
  pg_temp.detalhe($$ select public.enviar_solicitacao(
    '[{"item_id": "00000000-0000-0000-0303-00000000e003", "quantidade": 3}]', 'Aula') $$),
  '[{"item_id": "00000000-0000-0000-0303-00000000e003", "nome": "T-Pincel", "motivo": "Disponível: 2."}]'::jsonb,
  'CA-02 / RF-07: detail identifica o item e o disponível');
select lives_ok($$ select public.enviar_solicitacao(
  '[{"item_id": "00000000-0000-0000-0303-00000000e003", "quantidade": 2}]', 'Aula') $$,
  'pedir exatamente o disponível é aceito');

-- CA-03 -------------------------------------------------------------------------
select is(
  pg_temp.detalhe($$ select public.enviar_solicitacao(
    '[{"item_id": "00000000-0000-0000-0303-00000000e004", "quantidade": 1}]', 'Aula') $$),
  '[{"item_id": "00000000-0000-0000-0303-00000000e004", "nome": "T-Serra", "motivo": "Item inoperante."}]'::jsonb,
  'CA-03: item inoperante é identificado');

-- RF-07: várias falhas de uma vez e nada é criado -------------------------------------
select is(
  (select array_agg(d->>'motivo' order by d->>'motivo') from jsonb_array_elements(pg_temp.detalhe($$
    select public.enviar_solicitacao(
      '[{"item_id": "00000000-0000-0000-0303-00000000e001", "quantidade": 1},
        {"item_id": "00000000-0000-0000-0303-00000000e004", "quantidade": 1},
        {"item_id": "00000000-0000-0000-0303-00000000e005", "quantidade": 1},
        {"item_id": "00000000-0000-0000-0303-0000000000ff", "quantidade": 1},
        {"item_id": "00000000-0000-0000-0303-00000000e003", "quantidade": 9}]', 'Aula') $$)) d),
  array['Disponível: 2.', 'Item inoperante.', 'Item não encontrado ou desativado.', 'Item não encontrado ou desativado.'],
  'RF-07: lista todas as falhas (inexistente, desativado, inoperante, sem disponível) e omite o item válido');
select is((select count(*)::int from public.solicitacao), 3, 'RF-07: nenhuma solicitação criada nas tentativas rejeitadas');
select is((select count(*)::int from public.solicitacao_item), 4, 'RF-07: nenhuma linha criada nas tentativas rejeitadas');
select is(
  pg_temp.detalhe($$ select public.enviar_solicitacao(
    '[{"item_id": "00000000-0000-0000-0303-00000000e005", "quantidade": 1}]', 'Aula') $$) -> 0 ->> 'nome',
  null, 'item desativado não revela o nome a quem não o vê');

-- Validação de entrada ------------------------------------------------------------
select throws_ok($$ select public.enviar_solicitacao(
  '[{"item_id": "00000000-0000-0000-0303-00000000e002", "quantidade": 1}]', null) $$,
  'P0001', 'Informe a justificativa (de 3 a 500 caracteres).', 'CA-04: sem justificativa');
select throws_ok($$ select public.enviar_solicitacao(
  '[{"item_id": "00000000-0000-0000-0303-00000000e002", "quantidade": 1}]', '  ') $$,
  'P0001', 'Informe a justificativa (de 3 a 500 caracteres).', 'CA-04: justificativa em branco');
select throws_ok($$ select public.enviar_solicitacao('[]', 'Aula') $$,
  'P0001', 'Adicione ao menos um item.', 'lista vazia');
select throws_ok($$ select public.enviar_solicitacao(null, 'Aula') $$,
  'P0001', 'Adicione ao menos um item.', 'lista nula');
select throws_ok($$ select public.enviar_solicitacao(
  '[{"item_id": "00000000-0000-0000-0303-00000000e002", "quantidade": 1},
    {"item_id": "00000000-0000-0000-0303-00000000e002", "quantidade": 2}]', 'Aula') $$,
  'P0001', 'O mesmo item aparece mais de uma vez.', 'RF-03: item repetido');
select throws_ok($$ select public.enviar_solicitacao(
  '[{"item_id": "00000000-0000-0000-0303-00000000e002", "quantidade": 0}]', 'Aula') $$,
  'P0001', 'Quantidade inválida: use números inteiros a partir de 1.', 'RF-03: quantidade 0');
select throws_ok($$ select public.enviar_solicitacao(
  '[{"item_id": "00000000-0000-0000-0303-00000000e002", "quantidade": 1.5}]', 'Aula') $$,
  'P0001', 'Lista de itens inválida.', 'quantidade fracionária');
select throws_ok($$ select public.enviar_solicitacao('[{"item_id": "nao-e-uuid", "quantidade": 1}]', 'Aula') $$,
  'P0001', 'Lista de itens inválida.', 'item_id inválido');
select throws_ok($$ select public.enviar_solicitacao('{"item_id": 1}', 'Aula') $$,
  'P0001', 'Lista de itens inválida.', 'payload que não é lista');

-- RN-03: admin também solicita ------------------------------------------------------
select pg_temp.como('00000000-0000-0000-0303-0000000000a1');
select lives_ok($$ select public.enviar_solicitacao(
  '[{"item_id": "00000000-0000-0000-0303-00000000e002", "quantidade": 1}]', 'Uso da secretaria') $$,
  'RN-03: admin ativo também solicita');

-- CA-08 ---------------------------------------------------------------------------
select pg_temp.como('00000000-0000-0000-0303-0000000000c1');
select throws_ok($$ select public.enviar_solicitacao(
  '[{"item_id": "00000000-0000-0000-0303-00000000e002", "quantidade": 1}]', 'Aula') $$,
  'P0001', 'Seu acesso não permite enviar solicitações.', 'CA-08: pendente não envia');
select pg_temp.como('00000000-0000-0000-0303-0000000000d1');
select throws_ok($$ select public.enviar_solicitacao(
  '[{"item_id": "00000000-0000-0000-0303-00000000e002", "quantidade": 1}]', 'Aula') $$,
  'P0001', 'Seu acesso não permite enviar solicitações.', 'CA-08: inativo não envia');
reset role;
set local role anon;
select throws_ok($$ select public.enviar_solicitacao(
  '[{"item_id": "00000000-0000-0000-0303-00000000e002", "quantidade": 1}]', 'Aula') $$,
  '42501', null, 'anon não executa');
reset role;
select is((select count(*)::int from public.solicitacao), 4, 'CA-08: nada criado pelos negados');
select ok(pg_temp.contadores_iguais(), 'RF-05: no fim, nenhum contador mudou');
select is((select prosecdef from pg_proc where oid = 'public.enviar_solicitacao(jsonb, text)'::regprocedure),
  true, 'SECURITY DEFINER (valida item mesmo que o solicitante não o veja)');

select * from finish();
rollback;
