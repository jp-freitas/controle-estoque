-- spec-001 T-04: auditoria de profiles (RN-02, CA-03, CA-06)
-- Cobre também spec-006 CA-07 a CA-13 no que toca profiles.
begin;
create extension if not exists pgtap with schema extensions;
select plan(27);

-- Fixtures ------------------------------------------------------------------
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a1', 't-admin@teste.test'),
  ('00000000-0000-0000-0000-0000000000b1', 't-prof@teste.test'),
  ('00000000-0000-0000-0000-0000000000c1', 't-outro@teste.test');

-- Simula o JWT de um usuário (auth.uid()) sem trocar de role
create function pg_temp.como(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;
create function pg_temp.sem_usuario() returns void language sql as $$
  select set_config('request.jwt.claims', '', true);
$$;
create function pg_temp.ultima(rid uuid) returns public.auditoria language sql as $$
  select * from public.auditoria where registro_id = rid order by id desc limit 1;
$$;
create function pg_temp.qtd(rid uuid) returns bigint language sql as $$
  select count(*) from public.auditoria where registro_id = rid;
$$;

-- INSERT (spec-006/RF-06, RF-03, CA-09) -------------------------------------
select pg_temp.sem_usuario();
insert into public.profiles (id, nome, email, perfil, status) values
  ('00000000-0000-0000-0000-0000000000a1', 'Admin', 't-admin@teste.test', 'admin', 'ativo');

select is((pg_temp.ultima('00000000-0000-0000-0000-0000000000a1')).acao, 'INSERT',
  'spec-006/RF-06: INSERT em profiles é auditado');
select ok((pg_temp.ultima('00000000-0000-0000-0000-0000000000a1')).dados_antes is null
  and (pg_temp.ultima('00000000-0000-0000-0000-0000000000a1')).dados_depois->>'email' = 't-admin@teste.test',
  'spec-006/RF-03: INSERT grava dados_antes nulo e dados_depois completo');
select is((pg_temp.ultima('00000000-0000-0000-0000-0000000000a1')).usuario_id, null,
  'spec-006/CA-09: sem usuário autenticado, usuario_id fica nulo ("Sistema")');
select is((pg_temp.ultima('00000000-0000-0000-0000-0000000000a1')).tabela, 'profiles', 'tabela = profiles');

insert into public.profiles (id, nome, email) values
  ('00000000-0000-0000-0000-0000000000b1', 'Prof', 't-prof@teste.test');

-- CA-03: admin aprova pendente → ativo, com motivo ---------------------------
select pg_temp.como('00000000-0000-0000-0000-0000000000a1');
select set_config('app.motivo', 'Professor confirmado pela coordenação', true);
update public.profiles set status = 'ativo' where id = '00000000-0000-0000-0000-0000000000b1';
select set_config('app.motivo', '', true);

select is((pg_temp.ultima('00000000-0000-0000-0000-0000000000b1')).acao, 'UPDATE',
  'CA-03: aprovação gera registro de UPDATE');
select is((pg_temp.ultima('00000000-0000-0000-0000-0000000000b1')).campos_alterados, array['status'],
  'CA-03: campos_alterados = {status}');
select is((pg_temp.ultima('00000000-0000-0000-0000-0000000000b1')).dados_antes->>'status', 'pendente',
  'CA-03: dados_antes.status = pendente');
select is((pg_temp.ultima('00000000-0000-0000-0000-0000000000b1')).dados_depois->>'status', 'ativo',
  'CA-03: dados_depois.status = ativo');
select is((pg_temp.ultima('00000000-0000-0000-0000-0000000000b1')).usuario_id,
  '00000000-0000-0000-0000-0000000000a1'::uuid, 'CA-03: usuario_id = admin que aprovou');
select is((pg_temp.ultima('00000000-0000-0000-0000-0000000000b1')).motivo,
  'Professor confirmado pela coordenação', 'spec-006/RF-17: motivo vem de app.motivo');

-- spec-006/CA-07 e CA-06: promover/rebaixar ---------------------------------
update public.profiles set perfil = 'admin' where id = '00000000-0000-0000-0000-0000000000b1';
select is((pg_temp.ultima('00000000-0000-0000-0000-0000000000b1')).campos_alterados, array['perfil'],
  'spec-006/CA-07: promoção traz perfil em campos_alterados');
select is((pg_temp.ultima('00000000-0000-0000-0000-0000000000b1')).motivo, null,
  'sem app.motivo, motivo fica nulo');

update public.profiles set perfil = 'solicitante' where id = '00000000-0000-0000-0000-0000000000b1';
select is((pg_temp.ultima('00000000-0000-0000-0000-0000000000b1')).dados_depois->>'perfil', 'solicitante',
  'CA-06: rebaixamento fica registrado');

-- spec-006/CA-08 e RF-07: alterações que não geram registro -----------------
select pg_temp.qtd('00000000-0000-0000-0000-0000000000b1') as antes \gset
update public.profiles set nome = 'Prof. Silva', matricula = '123' where id = '00000000-0000-0000-0000-0000000000b1';
select is(pg_temp.qtd('00000000-0000-0000-0000-0000000000b1'), :'antes'::bigint,
  'spec-006/CA-08: mudar só nome/matrícula não gera registro');
update public.profiles set status = status, perfil = perfil where id = '00000000-0000-0000-0000-0000000000b1';
select is(pg_temp.qtd('00000000-0000-0000-0000-0000000000b1'), :'antes'::bigint,
  'spec-006/RF-07: UPDATE sem mudança de valor não gera registro');

-- Mudança mista: só os campos auditáveis entram em campos_alterados
update public.profiles set nome = 'Prof. Souza', status = 'inativo' where id = '00000000-0000-0000-0000-0000000000b1';
select is((pg_temp.ultima('00000000-0000-0000-0000-0000000000b1')).campos_alterados, array['status'],
  'spec-006/RF-06: nome junto com status → campos_alterados só com status');

-- spec-006/RF-09: só colunas da tabela auditada
select is(
  (select array_agg(k order by k) from jsonb_object_keys((pg_temp.ultima('00000000-0000-0000-0000-0000000000b1')).dados_depois) k),
  (select array_agg(column_name::text order by column_name::text) from information_schema.columns
   where table_schema = 'public' and table_name = 'profiles'),
  'spec-006/RF-09: dados_depois contém só colunas de profiles');

-- DELETE (spec-006/RF-03) ---------------------------------------------------
insert into public.profiles (id, nome, email) values
  ('00000000-0000-0000-0000-0000000000c1', 'Outro', 't-outro@teste.test');
delete from public.profiles where id = '00000000-0000-0000-0000-0000000000c1';
select ok((pg_temp.ultima('00000000-0000-0000-0000-0000000000c1')).acao = 'DELETE'
  and (pg_temp.ultima('00000000-0000-0000-0000-0000000000c1')).dados_depois is null
  and (pg_temp.ultima('00000000-0000-0000-0000-0000000000c1')).dados_antes->>'nome' = 'Outro',
  'spec-006/RF-03: DELETE grava dados_antes e dados_depois nulo');

-- spec-006/CA-13 e RF-08: falha na auditoria desfaz a alteração --------------
alter table public.auditoria add constraint teste_falha check (motivo is distinct from 'FALHAR');
select set_config('app.motivo', 'FALHAR', true);
select throws_ok(
  $$ update public.profiles set status = 'ativo' where id = '00000000-0000-0000-0000-0000000000b1' $$,
  '23514', null, 'spec-006/CA-13: erro ao gravar auditoria propaga');
select set_config('app.motivo', '', true);
alter table public.auditoria drop constraint teste_falha;
select is((select status::text from public.profiles where id = '00000000-0000-0000-0000-0000000000b1'), 'inativo',
  'spec-006/CA-13: alteração original não é persistida');

-- spec-006/CA-10: leitura só para admin ativo --------------------------------
-- (o solicitante "outro" precisa existir e estar ativo)
insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000d1', 't-sol@teste.test');
insert into public.profiles (id, nome, email, status) values
  ('00000000-0000-0000-0000-0000000000d1', 'Sol', 't-sol@teste.test', 'ativo');

set local role authenticated;
select pg_temp.como('00000000-0000-0000-0000-0000000000d1');
select is((select count(*) from public.auditoria), 0::bigint,
  'spec-006/CA-10: solicitante ativo não lê auditoria');
select pg_temp.como('00000000-0000-0000-0000-0000000000a1');
select ok((select count(*) from public.auditoria) > 0, 'spec-006/RF-10: admin ativo lê auditoria');

-- spec-006/CA-11: aplicação não escreve direto na auditoria -----------------
select throws_ok(
  $$ insert into public.auditoria (tabela, registro_id, acao) values ('profiles', gen_random_uuid(), 'INSERT') $$,
  '42501', null, 'spec-006/CA-11: INSERT direto negado para authenticated');
select throws_ok(
  $$ delete from public.auditoria $$,
  '42501', null, 'spec-006/CA-11: DELETE direto negado para authenticated');
reset role;

-- spec-006/CA-12: imutável inclusive para service_role -----------------------
set local role service_role;
select throws_ok(
  $$ update public.auditoria set motivo = 'x' $$,
  'P0001', 'A auditoria não pode ser alterada nem apagada.', 'spec-006/CA-12: UPDATE com service_role rejeitado');
select throws_ok(
  $$ delete from public.auditoria $$,
  'P0001', 'A auditoria não pode ser alterada nem apagada.', 'spec-006/CA-12: DELETE com service_role rejeitado');
reset role;
select throws_ok(
  $$ truncate public.auditoria $$,
  'P0001', 'A auditoria não pode ser alterada nem apagada.', 'spec-006/RF-12: TRUNCATE rejeitado mesmo para o dono');

select * from finish();
rollback;
