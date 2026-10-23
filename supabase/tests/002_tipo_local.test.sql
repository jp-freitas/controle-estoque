-- spec-002 T-01: tipos de item e locais (RF-01 a RF-04, RN-01; CA-06, CA-10)
-- Regras que dependem de item (tipo em uso, CA-13, CA-14) ficam em 002_item.test.sql.
begin;
create extension if not exists pgtap with schema extensions;
select plan(37);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0201-0000000000a1', 't-admin@teste.test'),
  ('00000000-0000-0000-0201-0000000000b1', 't-ativo@teste.test'),
  ('00000000-0000-0000-0201-0000000000c1', 't-pendente@teste.test'),
  ('00000000-0000-0000-0201-0000000000d1', 't-inativo@teste.test');
insert into public.profiles (id, nome, email, perfil, status) values
  ('00000000-0000-0000-0201-0000000000a1', 'Admin', 't-admin@teste.test', 'admin', 'ativo'),
  ('00000000-0000-0000-0201-0000000000b1', 'Ativo', 't-ativo@teste.test', 'solicitante', 'ativo'),
  ('00000000-0000-0000-0201-0000000000c1', 'Pendente', 't-pendente@teste.test', 'solicitante', 'pendente'),
  ('00000000-0000-0000-0201-0000000000d1', 'Inativo', 't-inativo@teste.test', 'solicitante', 'inativo');

create function pg_temp.como(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;

-- Estrutura -------------------------------------------------------------------
select has_table('public', 'tipo_item', 'RF-01: tabela tipo_item existe');
select has_table('public', 'local', 'RF-04: tabela local existe');
select col_type_is('public', 'tipo_item', 'nome', 'extensions.citext', 'nome do tipo é citext');
select col_type_is('public', 'local', 'nome', 'extensions.citext', 'RF-04: nome do local é citext');
select col_not_null('public', 'tipo_item', 'consumivel', 'RF-02: consumivel é obrigatório');
select col_is_null('public', 'local', 'descricao', 'RF-04: descrição do local é opcional');
select col_default_is('public', 'tipo_item', 'ativo', 'true', 'RF-03: tipo nasce ativo');
select col_default_is('public', 'local', 'ativo', 'true', 'RF-04: local nasce ativo');
select ok((select relrowsecurity from pg_class where oid = 'public.tipo_item'::regclass), 'P-02: RLS em tipo_item');
select ok((select relrowsecurity from pg_class where oid = 'public.local'::regclass), 'P-02: RLS em local');

-- RF-01 / RF-02: tipos iniciais vêm da migration --------------------------------
select results_eq(
  $$ select nome::text, consumivel from public.tipo_item
     where nome in ('Insumo', 'Ferramenta', 'Máquina') order by nome $$,
  $$ values ('Ferramenta', false), ('Insumo', true), ('Máquina', false) $$,
  'RF-01 / RF-02: Insumo (consumível), Ferramenta e Máquina existem');

-- Admin mantém tipos e locais -------------------------------------------------
set local role authenticated;
select pg_temp.como('00000000-0000-0000-0201-0000000000a1');

select lives_ok($$ insert into public.tipo_item (nome, consumivel) values ('Kit didático', false) $$,
  'RF-03: admin cria tipo definindo consumivel');
select throws_ok($$ insert into public.tipo_item (nome, consumivel) values ('KIT DIDÁTICO', true) $$,
  '23505', null, 'nome de tipo único sem diferenciar maiúsculas');
select throws_ok($$ insert into public.tipo_item (nome, consumivel) values ('  ', true) $$,
  '23514', null, 'nome de tipo em branco é rejeitado');
select lives_ok($$ insert into public.local (nome, descricao) values ('Laboratório 1', 'Bloco B') $$,
  'RF-04: admin cadastra local');
select throws_ok($$ insert into public.local (nome) values ('laboratório 1') $$,
  '23505', null, 'RF-04: nome de local único sem diferenciar maiúsculas');
select lives_ok($$ insert into public.local (nome) values ('Almoxarifado') $$, 'RF-04: local sem descrição');
select lives_ok($$ update public.local set descricao = 'Bloco C' where nome = 'Laboratório 1' $$,
  'RF-04: admin edita local');
select is((select descricao from public.local where nome = 'Laboratório 1'), 'Bloco C', 'RF-04: edição gravada');
select lives_ok($$ update public.local set ativo = false where nome = 'Almoxarifado' $$,
  'RF-04: admin desativa local sem itens');
select lives_ok($$ update public.tipo_item set ativo = false where nome = 'Kit didático' $$,
  'RF-03: admin desativa tipo sem itens');
select is((select count(*)::int from public.local where nome = 'Almoxarifado'), 1,
  'CA-10: admin continua vendo local desativado');

-- CA-06 / RN-01: solicitante ativo só lê, e só o que está ativo -----------------
select pg_temp.como('00000000-0000-0000-0201-0000000000b1');
select ok((select count(*) from public.tipo_item where nome = 'Ferramenta') = 1, 'RN-01: solicitante ativo lê tipos');
select is_empty($$ select 1 from public.tipo_item where nome = 'Kit didático' $$,
  'CA-10: tipo desativado invisível para solicitante');
select is_empty($$ select 1 from public.local where nome = 'Almoxarifado' $$,
  'CA-10: local desativado invisível para solicitante');
select throws_ok($$ insert into public.tipo_item (nome, consumivel) values ('Pirata', true) $$,
  '42501', null, 'CA-06: solicitante não cria tipo');
select throws_ok($$ insert into public.local (nome) values ('Pirata') $$,
  '42501', null, 'CA-06: solicitante não cria local');
update public.local set nome = 'Hackeado' where nome = 'Laboratório 1';
update public.tipo_item set consumivel = true where nome = 'Ferramenta';
delete from public.local where nome = 'Laboratório 1';

-- Pendente e inativo não leem nada ---------------------------------------------
select pg_temp.como('00000000-0000-0000-0201-0000000000c1');
select is_empty($$ select 1 from public.tipo_item $$, 'pendente não lê tipos');
select is_empty($$ select 1 from public.local $$, 'pendente não lê locais');
select throws_ok($$ insert into public.local (nome) values ('Pendente') $$,
  '42501', null, 'CA-06: pendente não cria local');
select pg_temp.como('00000000-0000-0000-0201-0000000000d1');
select is_empty($$ select 1 from public.tipo_item $$, 'inativo não lê tipos');
select throws_ok($$ insert into public.tipo_item (nome, consumivel) values ('Inativo', true) $$,
  '42501', null, 'CA-06: inativo não cria tipo');

-- Anônimo não tem acesso nenhum --------------------------------------------------
reset role;
set local role anon;
select throws_ok($$ select 1 from public.tipo_item $$, '42501', null, 'anon não lê tipos');
select throws_ok($$ select 1 from public.local $$, '42501', null, 'anon não lê locais');

-- Nada mudou pelas tentativas negadas -------------------------------------------
reset role;
select is((select count(*)::int from public.local where nome = 'Laboratório 1'), 1,
  'CA-06: update/delete do solicitante não afetaram o local');
select is((select consumivel from public.tipo_item where nome = 'Ferramenta'), false,
  'CA-06: update do solicitante não afetou o tipo');
select is_empty($$ select 1 from public.local where nome in ('Pirata', 'Pendente') $$,
  'CA-06: nenhum local criado por não-admin');

select * from finish();
rollback;
