-- spec-002 T-07: marcar inoperante e reativar (RF-14; CA-11; spec-006/RF-17, CA-17)
begin;
create extension if not exists pgtap with schema extensions;
select plan(20);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0204-0000000000a1', 't-admin@teste.test'),
  ('00000000-0000-0000-0204-0000000000b1', 't-ativo@teste.test'),
  ('00000000-0000-0000-0204-0000000000c1', 't-pendente@teste.test'),
  ('00000000-0000-0000-0204-0000000000d1', 't-inativo@teste.test');
insert into public.profiles (id, nome, email, perfil, status) values
  ('00000000-0000-0000-0204-0000000000a1', 'Admin', 't-admin@teste.test', 'admin', 'ativo'),
  ('00000000-0000-0000-0204-0000000000b1', 'Ativo', 't-ativo@teste.test', 'solicitante', 'ativo'),
  ('00000000-0000-0000-0204-0000000000c1', 'Pendente', 't-pendente@teste.test', 'solicitante', 'pendente'),
  ('00000000-0000-0000-0204-0000000000d1', 'Inativo', 't-inativo@teste.test', 'solicitante', 'inativo');
insert into public.local (id, nome) values ('00000000-0000-0000-0204-00000000f001', 'T-Oficina');
insert into public.item (id, nome, tipo_id, local_id, quantidade_total) values
  ('00000000-0000-0000-0204-00000000e001', 'Serra', (select id from public.tipo_item where nome = 'Máquina'),
   '00000000-0000-0000-0204-00000000f001', 1),
  ('00000000-0000-0000-0204-00000000e002', 'Lixadeira', (select id from public.tipo_item where nome = 'Máquina'),
   '00000000-0000-0000-0204-00000000f001', 1);

create function pg_temp.como(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;
create function pg_temp.operante(p_id uuid) returns boolean language sql as $$
  select operante from public.item where id = p_id;
$$;
create function pg_temp.ultima_auditoria(p_id uuid) returns public.auditoria language sql as $$
  select * from public.auditoria where registro_id = p_id order by id desc limit 1;
$$;

set local role authenticated;
select pg_temp.como('00000000-0000-0000-0204-0000000000a1');

-- Marcar inoperante (motivo opcional) -----------------------------------------------
select is((public.alterar_operancia_item('00000000-0000-0000-0204-00000000e001', false, ' Motor queimado ')).operante,
  false, 'RF-14: admin marca inoperante com motivo');
select is((pg_temp.ultima_auditoria('00000000-0000-0000-0204-00000000e001')).campos_alterados, array['operante'],
  'RF-14: marcação auditada');
select is((pg_temp.ultima_auditoria('00000000-0000-0000-0204-00000000e001')).motivo, 'Motor queimado',
  'spec-006/RF-17: auditoria guarda o motivo');
select is((public.alterar_operancia_item('00000000-0000-0000-0204-00000000e002', false)).operante,
  false, 'RF-14: motivo é opcional para marcar inoperante');
select is((pg_temp.ultima_auditoria('00000000-0000-0000-0204-00000000e002')).motivo, null,
  'RF-14: sem motivo, auditoria sem motivo');
select throws_ok($$ select public.alterar_operancia_item('00000000-0000-0000-0204-00000000e001', false) $$,
  'P0001', 'O item já está inoperante.', 'marcar de novo é rejeitado');

-- CA-11: reativar exige motivo --------------------------------------------------------
select throws_ok($$ select public.alterar_operancia_item('00000000-0000-0000-0204-00000000e001', true) $$,
  'P0001', 'Informe o motivo da reativação.', 'CA-11: reativar sem motivo é rejeitado');
select throws_ok($$ select public.alterar_operancia_item('00000000-0000-0000-0204-00000000e001', true, '  ') $$,
  'P0001', 'Informe o motivo da reativação.', 'CA-11: motivo em branco também');
select is(pg_temp.operante('00000000-0000-0000-0204-00000000e001'), false, 'CA-11: item continua inoperante');
select is((public.alterar_operancia_item('00000000-0000-0000-0204-00000000e001', true, 'Consertado')).operante,
  true, 'CA-11: com motivo, o item volta a operante');
select is((pg_temp.ultima_auditoria('00000000-0000-0000-0204-00000000e001')).motivo, 'Consertado',
  'CA-11 / spec-006/CA-17: auditoria registra o motivo da reativação');
select throws_ok($$ select public.alterar_operancia_item('00000000-0000-0000-0204-00000000e001', true, 'x') $$,
  'P0001', 'O item já está operante.', 'reativar item operante é rejeitado');
select throws_ok($$ select public.alterar_operancia_item('00000000-0000-0000-0204-00000000e001', null, 'x') $$,
  'P0001', 'Informe se o item está operante.', 'operante nulo é rejeitado');

-- O motivo não vaza para alterações seguintes na mesma transação --------------------
update public.item set descricao = 'Revisada' where id = '00000000-0000-0000-0204-00000000e001';
select is((pg_temp.ultima_auditoria('00000000-0000-0000-0204-00000000e001')).motivo, null,
  'spec-006/RF-17: edição comum depois da RPC fica sem motivo');

-- Caminho negado --------------------------------------------------------------------
select pg_temp.como('00000000-0000-0000-0204-0000000000b1');
select throws_ok($$ select public.alterar_operancia_item('00000000-0000-0000-0204-00000000e002', true, 'x') $$,
  'P0001', 'Apenas administradores ativos podem marcar item como inoperante ou reativá-lo.', 'solicitante não reativa');
select throws_ok($$ select public.alterar_operancia_item('00000000-0000-0000-0204-00000000e001', false) $$,
  'P0001', 'Apenas administradores ativos podem marcar item como inoperante ou reativá-lo.',
  'solicitante não marca inoperante');
select pg_temp.como('00000000-0000-0000-0204-0000000000c1');
select throws_ok($$ select public.alterar_operancia_item('00000000-0000-0000-0204-00000000e002', true, 'x') $$,
  'P0001', 'Apenas administradores ativos podem marcar item como inoperante ou reativá-lo.', 'pendente não reativa');
select pg_temp.como('00000000-0000-0000-0204-0000000000d1');
select throws_ok($$ select public.alterar_operancia_item('00000000-0000-0000-0204-00000000e002', true, 'x') $$,
  'P0001', 'Apenas administradores ativos podem marcar item como inoperante ou reativá-lo.', 'inativo não reativa');
reset role;
set local role anon;
select throws_ok($$ select public.alterar_operancia_item('00000000-0000-0000-0204-00000000e002', true, 'x') $$,
  '42501', null, 'anon não executa');
reset role;
select is(pg_temp.operante('00000000-0000-0000-0204-00000000e002'), false, 'tentativas negadas não mudaram o item');

select * from finish();
rollback;
