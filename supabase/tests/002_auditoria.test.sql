-- spec-002 T-09: auditoria de item, tipo_item e local (RN-02; CA-07; spec-006/RF-02,
-- RF-03, RF-05, CA-01, CA-06; P-06)
begin;
create extension if not exists pgtap with schema extensions;
select plan(16);

insert into auth.users (id, email) values ('00000000-0000-0000-0205-0000000000a1', 't-admin@teste.test');
insert into public.profiles (id, nome, email, perfil, status) values
  ('00000000-0000-0000-0205-0000000000a1', 'Admin', 't-admin@teste.test', 'admin', 'ativo');

create function pg_temp.como(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;
create function pg_temp.aud(p_tabela text) returns setof public.auditoria language sql as $$
  select * from public.auditoria where tabela = p_tabela order by id;
$$;

set local role authenticated;
select pg_temp.como('00000000-0000-0000-0205-0000000000a1');

insert into public.local (id, nome) values
  ('00000000-0000-0000-0205-00000000f001', 'T-Sala A'), ('00000000-0000-0000-0205-00000000f002', 'T-Sala B');
insert into public.tipo_item (id, nome, consumivel) values ('00000000-0000-0000-0205-00000000d001', 'T-Tipo', false);
insert into public.item (id, nome, tipo_id, local_id, quantidade_total) values
  ('00000000-0000-0000-0205-00000000e001', 'Projetor', '00000000-0000-0000-0205-00000000d001',
   '00000000-0000-0000-0205-00000000f001', 4);

-- Inserts ---------------------------------------------------------------------
select is((select count(*)::int from pg_temp.aud('local') where acao = 'INSERT'), 2, 'spec-006/RF-02: insert de local auditado');
select is((select count(*)::int from pg_temp.aud('tipo_item') where acao = 'INSERT'), 1, 'insert de tipo auditado');
select is((select usuario_id from pg_temp.aud('item') where acao = 'INSERT'), '00000000-0000-0000-0205-0000000000a1'::uuid,
  'spec-006/RF-03: insert de item auditado com o autor');

-- CA-07: mudou de local --------------------------------------------------------
update public.item set local_id = '00000000-0000-0000-0205-00000000f002' where id = '00000000-0000-0000-0205-00000000e001';
select is((select campos_alterados from pg_temp.aud('item') where acao = 'UPDATE' order by id desc limit 1),
  array['local_id'], 'CA-07: campos alterados = local_id');
select is((select dados_antes ->> 'local_id' from pg_temp.aud('item') where acao = 'UPDATE' order by id desc limit 1),
  '00000000-0000-0000-0205-00000000f001', 'CA-07: valor antes');
select is((select dados_depois ->> 'local_id' from pg_temp.aud('item') where acao = 'UPDATE' order by id desc limit 1),
  '00000000-0000-0000-0205-00000000f002', 'CA-07: valor depois');
select is((select usuario_id from pg_temp.aud('item') where acao = 'UPDATE' order by id desc limit 1),
  '00000000-0000-0000-0205-0000000000a1'::uuid, 'CA-07: usuário');
select ok((select criado_em from pg_temp.aud('item') where acao = 'UPDATE' order by id desc limit 1) is not null, 'CA-07: data');

-- Desativações -------------------------------------------------------------------
update public.item set ativo = false where id = '00000000-0000-0000-0205-00000000e001';
select is((select campos_alterados from pg_temp.aud('item') order by id desc limit 1), array['ativo'],
  'RF-08: desativação de item auditada');
update public.local set ativo = false where id = '00000000-0000-0000-0205-00000000f001';
select is((select campos_alterados from pg_temp.aud('local') order by id desc limit 1), array['ativo'],
  'desativação de local auditada');
update public.tipo_item set nome = 'T-Tipo 2' where id = '00000000-0000-0000-0205-00000000d001';
select is((select campos_alterados from pg_temp.aud('tipo_item') order by id desc limit 1), array['nome'],
  'edição de tipo auditada');

-- spec-006/CA-06: ajuste manual auditado com motivo -----------------------------------
select public.ajustar_quantidade_item('00000000-0000-0000-0205-00000000e001', 6, 'Doação');
select is((select campos_alterados from pg_temp.aud('item') order by id desc limit 1), array['quantidade_total'],
  'spec-006/CA-06: ajuste manual gera auditoria');
select is((select motivo from pg_temp.aud('item') order by id desc limit 1), 'Doação',
  'spec-006/CA-06: com o motivo do ajuste');

-- RN-02 / spec-006/RF-05: contadores mexidos por movimento de estoque não são auditados --
reset role;
select set_config('app.origem', 'movimentacao', true);
update public.item set quantidade_reservada = 2 where id = '00000000-0000-0000-0205-00000000e001';
update public.item set quantidade_reservada = 0, quantidade_total = 5 where id = '00000000-0000-0000-0205-00000000e001';
select is((select count(*)::int from pg_temp.aud('item') where campos_alterados && array['quantidade_reservada', 'quantidade_total']
  and motivo is null), 0, 'RN-02: contadores com app.origem = movimentacao não geram auditoria');
update public.item set quantidade_em_uso = 1, descricao = 'Com cabo' where id = '00000000-0000-0000-0205-00000000e001';
select is((select campos_alterados from pg_temp.aud('item') order by id desc limit 1), array['descricao', 'quantidade_em_uso'],
  'RN-02: mudança em outro campo junto com contador é auditada');
select set_config('app.origem', '', true);
update public.item set quantidade_em_uso = 0 where id = '00000000-0000-0000-0205-00000000e001';
select is((select campos_alterados from pg_temp.aud('item') order by id desc limit 1), array['quantidade_em_uso'],
  'RN-02: contador mudado fora de movimento de estoque é auditado');

select * from finish();
rollback;
