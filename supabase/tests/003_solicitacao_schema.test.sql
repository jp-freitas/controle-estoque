-- spec-003 T-01: estrutura de solicitacao e solicitacao_item (RF-01, RF-03, RF-06; CA-04; P-02)
begin;
create extension if not exists pgtap with schema extensions;
select plan(20);

select has_table('public', 'solicitacao', 'tabela solicitacao existe');
select has_table('public', 'solicitacao_item', 'tabela solicitacao_item existe');
select enum_has_labels('public', 'status_solicitacao',
  array['pendente', 'aprovada', 'retirada', 'concluida', 'cancelada', 'recusada'],
  'constituição §5: status da solicitação');
select col_default_is('public', 'solicitacao', 'status', 'pendente'::public.status_solicitacao, 'nasce pendente');
select col_not_null('public', 'solicitacao', 'justificativa', 'RF-06: justificativa obrigatória');
select col_not_null('public', 'solicitacao', 'solicitante_id', 'RF-01: sempre tem solicitante');
select col_is_null('public', 'solicitacao', 'cancelado_em', 'cancelado_em só depois do cancelamento');
select fk_ok('public', 'solicitacao', 'solicitante_id', 'public', 'profiles', 'id', 'solicitante → profiles');
select fk_ok('public', 'solicitacao_item', 'solicitacao_id', 'public', 'solicitacao', 'id', 'linha → solicitação');
select fk_ok('public', 'solicitacao_item', 'item_id', 'public', 'item', 'id', 'linha → item');
select fk_ok('public', 'movimentacao', 'solicitacao_id', 'public', 'solicitacao', 'id', 'movimentacao.solicitacao_id ganha FK');
select col_not_null('public', 'solicitacao_item', 'item_nome', 'linha guarda o nome do item no envio');
select ok((select relrowsecurity from pg_class where oid = 'public.solicitacao'::regclass), 'P-02: RLS em solicitacao');
select ok((select relrowsecurity from pg_class where oid = 'public.solicitacao_item'::regclass), 'P-02: RLS em solicitacao_item');

-- Constraints (direto como dono do banco)
insert into auth.users (id, email) values ('00000000-0000-0000-0301-0000000000b1', 't-prof@teste.test');
insert into public.profiles (id, nome, email, perfil, status) values
  ('00000000-0000-0000-0301-0000000000b1', 'Prof', 't-prof@teste.test', 'solicitante', 'ativo');
insert into public.local (id, nome) values ('00000000-0000-0000-0301-00000000f001', 'T-Sala');
insert into public.item (id, nome, tipo_id, local_id, quantidade_total) values
  ('00000000-0000-0000-0301-00000000e001', 'T-Régua', (select id from public.tipo_item where nome = 'Ferramenta'),
   '00000000-0000-0000-0301-00000000f001', 5);

select throws_ok($$ insert into public.solicitacao (solicitante_id, justificativa)
  values ('00000000-0000-0000-0301-0000000000b1', '  a ') $$,
  '23514', null, 'CA-04: justificativa com menos de 3 caracteres (sem espaços) é rejeitada');
select throws_ok(format($$ insert into public.solicitacao (solicitante_id, justificativa) values (%L, %L) $$,
  '00000000-0000-0000-0301-0000000000b1', repeat('x', 501)),
  '23514', null, 'justificativa com mais de 500 caracteres é rejeitada');
insert into public.solicitacao (id, solicitante_id, justificativa) values
  ('00000000-0000-0000-0301-00000000d001', '00000000-0000-0000-0301-0000000000b1', 'Aula de física');
select throws_ok($$ insert into public.solicitacao_item (solicitacao_id, item_id, item_nome, quantidade_solicitada)
  values ('00000000-0000-0000-0301-00000000d001', '00000000-0000-0000-0301-00000000e001', 'T-Régua', 0) $$,
  '23514', null, 'RF-03: quantidade solicitada ≥ 1');
insert into public.solicitacao_item (solicitacao_id, item_id, item_nome, quantidade_solicitada)
values ('00000000-0000-0000-0301-00000000d001', '00000000-0000-0000-0301-00000000e001', 'T-Régua', 2);
select throws_ok($$ insert into public.solicitacao_item (solicitacao_id, item_id, item_nome, quantidade_solicitada)
  values ('00000000-0000-0000-0301-00000000d001', '00000000-0000-0000-0301-00000000e001', 'T-Régua', 1) $$,
  '23505', null, 'RF-03: o mesmo item não aparece duas vezes');
select throws_ok($$ delete from public.solicitacao where id = '00000000-0000-0000-0301-00000000d001' $$,
  '23503', null, 'solicitação com linhas não é apagada (on delete restrict)');
select throws_ok($$ delete from public.item where id = '00000000-0000-0000-0301-00000000e001' $$,
  '23503', null, 'item pedido em solicitação não é apagado (desativa-se)');

select * from finish();
rollback;
