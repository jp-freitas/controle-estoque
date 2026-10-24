-- spec-004 T-01: colunas de decisão (RF-04, RF-08, RF-10, RF-11)
begin;
create extension if not exists pgtap with schema extensions;
select plan(13);

select has_column('public', 'solicitacao', 'aprovador_id', 'RF-04: quem decidiu');
select has_column('public', 'solicitacao', 'data_decisao', 'RF-04: quando decidiu');
select has_column('public', 'solicitacao', 'observacao_decisao', 'RF-11: observação geral da aprovação');
select has_column('public', 'solicitacao', 'motivo_recusa', 'RF-08: motivo da recusa');
select has_column('public', 'solicitacao', 'cancelado_por_id', 'RF-10: quem cancelou a aprovada');
select has_column('public', 'solicitacao', 'motivo_cancelamento', 'RF-10: motivo do cancelamento');
select has_column('public', 'solicitacao_item', 'quantidade_aprovada', 'RF-04: quantidade aprovada por linha');
select fk_ok('public', 'solicitacao', 'aprovador_id', 'public', 'profiles', 'id', 'aprovador → profiles');
select fk_ok('public', 'solicitacao', 'cancelado_por_id', 'public', 'profiles', 'id', 'cancelado_por → profiles');

insert into auth.users (id, email) values ('00000000-0000-0000-0401-0000000000b1', 't-prof@teste.test');
insert into public.profiles (id, nome, email, perfil, status) values
  ('00000000-0000-0000-0401-0000000000b1', 'Prof', 't-prof@teste.test', 'solicitante', 'ativo');
insert into public.local (id, nome) values ('00000000-0000-0000-0401-00000000f001', 'T-Sala');
insert into public.item (id, nome, tipo_id, local_id, quantidade_total) values
  ('00000000-0000-0000-0401-00000000e001', 'T-Régua', (select id from public.tipo_item where nome = 'Ferramenta'),
   '00000000-0000-0000-0401-00000000f001', 5);
insert into public.solicitacao (id, solicitante_id, justificativa) values
  ('00000000-0000-0000-0401-00000000d001', '00000000-0000-0000-0401-0000000000b1', 'Aula');
insert into public.solicitacao_item (id, solicitacao_id, item_id, item_nome, quantidade_solicitada) values
  ('00000000-0000-0000-0401-00000000c001', '00000000-0000-0000-0401-00000000d001',
   '00000000-0000-0000-0401-00000000e001', 'T-Régua', 3);

select throws_ok($$ update public.solicitacao_item set quantidade_aprovada = 4
  where id = '00000000-0000-0000-0401-00000000c001' $$, '23514', null, 'RF-04: aprovada não passa da solicitada');
select throws_ok($$ update public.solicitacao_item set quantidade_aprovada = -1
  where id = '00000000-0000-0000-0401-00000000c001' $$, '23514', null, 'RF-04: aprovada não é negativa');
select lives_ok($$ update public.solicitacao_item set quantidade_aprovada = 0
  where id = '00000000-0000-0000-0401-00000000c001' $$, 'CA-02: aprovada 0 é aceita');
select throws_ok($$ update public.solicitacao set status = 'recusada', motivo_recusa = '  '
  where id = '00000000-0000-0000-0401-00000000d001' $$, '23514', null, 'RF-08 / CA-06: recusa exige motivo');

select * from finish();
rollback;
