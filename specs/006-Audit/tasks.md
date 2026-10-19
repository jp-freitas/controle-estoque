# Tarefas — 006 Auditoria de alterações

Ordem do projeto: **testes → migration/código → rodar testes → atualizar spec/tasks**, banco antes do front.
Marque `[x]` só quando os testes da tarefa passam. Detalhes técnicos em `plan.md`.

Legenda: 🧪 teste primeiro · 🗄️ banco · 🖥️ front · 🔍 validação

**Pré-requisito:** o **registro** já existe — tabela, bloqueios e `auditar()` (spec 001, T-03 a T-05) e triggers do catálogo (spec 002, T-09/T-10). De preferência, specs 004 e 005 entregues (CA-04 e CA-16 usam as RPCs reais).

---

## Fase 1 — Bateria completa do registro (RF-01 a RF-12, RF-17)

Parte dos cenários já foi coberta nas specs 001/002; aqui fica a bateria completa, nomeada pelos CA desta spec.

- [ ] **T-01** 🧪 pgTAP `006_registro_item.test.sql`:
  - **CA-01**: mudança de local → 1 `UPDATE`, `campos_alterados = {local_id}`, ids antes/depois;
  - **CA-02**: insert → `dados_antes` nulo, `dados_depois` completo;
  - **CA-03**: desativação → campo `ativo` alterado;
  - **CA-04**: aprovação (RPC da 004) → nenhum registro, `movimentacao` `reserva` existe;
  - **CA-05**: update com os mesmos valores → nenhum registro;
  - **CA-06**: ajuste manual → `quantidade_total` em `campos_alterados` + `movimentacao` `ajuste`;
  - **CA-16**: retirada de insumo (RPC da 005) → nenhum registro, `movimentacao` `retirada` existe;
  - **CA-17**: reativação com motivo "Consertado" → `operante` alterado e `motivo` gravado;
  - `delete` de item sem histórico é auditado (RF-03, RN-02).
- [ ] **T-02** 🧪 pgTAP `006_registro_profiles.test.sql`:
  - **CA-07**: mudança de perfil → `perfil` em `campos_alterados`, `usuario_id` do admin;
  - **CA-08**: mudança só de `nome` → nenhum registro;
  - insert de `profiles` (aceite de convite) é auditado (RF-06).
- [ ] **T-03** 🧪 pgTAP `006_seguranca.test.sql`:
  - **CA-09**: alteração como `postgres` sem claims JWT → `usuario_id` nulo;
  - **CA-10**: solicitante consulta `auditoria` (inclusive API direta) → vazio;
  - **CA-11**: `insert`/`update`/`delete` direto por `authenticated` → negado;
  - **CA-12**: `update`/`delete`/`truncate` como `service_role` → rejeitado pelo trigger;
  - **CA-13**: `check` sempre falso acrescentado à `auditoria` dentro do teste → alterar item falha e o item não muda (RF-08);
  - RF-09: `dados_*` só têm colunas da tabela auditada.
- [ ] **T-04** 🗄️ Correções no `auditar()`/bloqueios que a bateria revelar (migration nova; nunca editar a já aplicada).

## Fase 2 — Consulta (RF-13 a RF-16)

- [ ] **T-05** 🧪 pgTAP `006_consulta.test.sql`:
  - **CA-14**: item com 3 alterações → 3 linhas em ordem decrescente; `auditoria_diferencas` traz "Armário A → Sala 2" (nomes de `local`/`tipo_item`, inclusive desativados);
  - **CA-15**: filtro por usuário e período → só os correspondentes, `total` correto, paginação com `limite`/`offset`;
  - período inclui o dia final inteiro em `America/Sao_Paulo`;
  - `usuario_nome = 'Sistema'` quando `usuario_id` é nulo;
  - solicitante chamando as funções → erro de permissão.
- [ ] **T-06** 🗄️ Migration `006_consulta_auditoria`: funções `consultar_auditoria(...)` e `auditoria_diferencas(id)`.
- [ ] **T-07** 🔍 `supabase db reset` + `supabase test db`; `npm run db:types`.

## Fase 3 — Front

- [ ] **T-08** 🖥️ `features/auditoria/` — `api`, hooks `useHistorico` e `useAuditoria`, mapa `rotulos.ts`.
- [ ] **T-09** 🖥️ **RF-13, RF-14, CA-14**: componente público `HistoricoAuditoria` ("Rótulo: antes → depois", data/hora em `America/Sao_Paulo`, "Sistema" para usuário nulo); aba Histórico no detalhe de item (spec-002/RF-13), tipo, local e usuário. Testes Vitest da formatação.
- [ ] **T-10** 🖥️ **RF-15, CA-15**: tela Auditoria com filtros (tabela, ação, usuário, período, registro) na URL e paginação no servidor.

## Fase 4 — Fechamento

- [ ] **T-11** 🔍 Teste manual com token de solicitante: `select` em `auditoria` e chamada às funções de consulta pela API REST (CA-10).
- [ ] **T-12** 🔍 CI verde.
- [ ] **T-13** 📝 Atualizar `spec.md`/`plan.md` e abrir PR `spec-006-auditoria`.

---

## Cobertura de critérios de aceite

| CA | Tarefa de teste |
|---|---|
| CA-01 | T-01 |
| CA-02 | T-01 |
| CA-03 | T-01 |
| CA-04 | T-01 |
| CA-05 | T-01 |
| CA-06 | T-01 |
| CA-07 | T-02 |
| CA-08 | T-02 |
| CA-09 | T-03 |
| CA-10 | T-03, T-11 |
| CA-11 | T-03 |
| CA-12 | T-03 |
| CA-13 | T-03 |
| CA-14 | T-05, T-09 |
| CA-15 | T-05, T-10 |
| CA-16 | T-01 |
| CA-17 | T-01 |
