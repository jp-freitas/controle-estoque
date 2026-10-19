# Tarefas — 005 Retirada e devolução

Ordem do projeto: **testes → migration/código → rodar testes → atualizar spec/tasks**, banco antes do front.
Marque `[x]` só quando os testes da tarefa passam. Detalhes técnicos em `plan.md`.

Legenda: 🧪 teste primeiro · 🗄️ banco · 🖥️ front · 🔍 validação

**Pré-requisito:** specs 001 a 004 entregues (`alterar_operancia_item` e `ajustar_quantidade_item` da 002; aprovação da 004).

---

## Fase 1 — Dados

- [ ] **T-01** 🧪 pgTAP `005_schema.test.sql`: novas colunas em `solicitacao` e `solicitacao_item`; `check (devolvida >= 0, baixada >= 0, devolvida + baixada <= aprovada)` (RF-09).
- [ ] **T-02** 🗄️ Migration `005_retirada_devolucao`: colunas e constraints.

## Fase 2 — Retirada (RF-01 a RF-06, RN-03)

- [ ] **T-03** 🧪 pgTAP `005_retirada.test.sql`:
  - **CA-01**: 3 insumos (total 10, reservada 3) → `total = 7`, `reservada = 0`, `concluida`, `movimentacao` `retirada`;
  - **CA-02**: 1 furadeira → `reservada −1`, `em_uso +1`, total igual, `retirada`;
  - **CA-03**: mista → insumo baixado, ferramenta em uso, `retirada`;
  - **CA-08**: retirar de novo → status inválido, contadores intactos;
  - **CA-09**: solicitante chamando → erro de permissão;
  - todas as linhas aprovadas são retiradas (RF-05); `entregue_por_id`/`data_retirada` gravados;
  - **spec-006/CA-16**: baixa de `total` do insumo não gera auditoria.
- [ ] **T-04** 🗄️ RPC `registrar_retirada(solicitacao_id)` com `app.origem`.

## Fase 3 — Devolução, danificadas e baixa (RF-07 a RF-13, RF-16)

- [ ] **T-05** 🧪 pgTAP `005_devolucao.test.sql`:
  - **CA-04**: 5 chaves, devolve 3 → `em_uso = 2`, `devolvida = 3`, continua `retirada`;
  - **CA-05**: devolve as 2 restantes → `em_uso = 0`, `concluida`;
  - **CA-06**: devolver mais que o pendente → rejeitado, nada muda;
  - **CA-07**: item com patrimônio com `marcar_inoperante` → `operante = false`, auditado;
  - **CA-13**: 10 chaves, 9 boas e 1 danificada → `em_uso = 0`, `total = 9`, `baixada = 1`, movimentações `devolucao` e `ajuste`, `concluida`;
  - **CA-15**: `marcar_inoperante` em item sem patrimônio → rejeitado;
  - devolução de linha consumível → rejeitada; **CA-09** para `registrar_devolucao`.
- [ ] **T-06** 🗄️ RPC `registrar_devolucao(solicitacao_id, itens)` e função interna `concluir_se_completa(solicitacao_id)` (sem `grant execute`).
- [ ] **T-07** 🧪 pgTAP `005_baixa.test.sql`:
  - **CA-10**: ferramenta não devolvida, perda com motivo → `em_uso` e `total` diminuem, `movimentacao` `ajuste`;
  - **CA-14**: 2 ferramentas, baixa de 1 e devolução de 1 → `concluida`;
  - baixa sem motivo ou acima do pendente → rejeitada; caminho negado.
- [ ] **T-08** 🗄️ RPC `registrar_baixa(solicitacao_item_id, quantidade, motivo)`.
- [ ] **T-09** 🧪 pgTAP `005_invariante.test.sql`: após retiradas, devoluções e baixas, `em_uso` de cada item = soma dos pendentes das linhas `retirada` não consumíveis; RF-13 — toda operação deixou `movimentacao` com usuário e data.
- [ ] **T-10** 🧪 Concorrência `supabase/tests/concorrencia/005-retirada.test.ts` — **CA-11**: `registrar_retirada` e `ajustar_quantidade_item` simultâneos no mesmo item; serializados, CHECK nunca violado.
- [ ] **T-11** 🔍 `supabase db reset` + `supabase test db` + `npm run test:db:concorrencia`; revisão de grants/`search_path`; `npm run db:types`.

## Fase 4 — Front

- [ ] **T-12** 🖥️ **RF-06**: `features/retirada/` — conferência (checklist) dos itens aprovados e confirmação da retirada.
- [ ] **T-13** 🖥️ **RF-07 a RF-10, RF-16**: devolução por linha com "boas" e "danificadas", observação, "marcar inoperante" só para item com patrimônio; validação Zod (soma ≤ pendente). Testes Vitest.
- [ ] **T-14** 🖥️ **RF-12**: baixa por perda com motivo.

## Fase 5 — Fechamento

- [ ] **T-15** 🧪 Playwright `e2e/fluxo-principal.spec.ts` (Q-04): professor solicita → admin aprova → admin registra retirada → admin registra devolução → solicitação `concluida`.
- [ ] **T-16** 🔍 Teste manual com token de solicitante chamando `registrar_retirada`/`registrar_devolucao`/`registrar_baixa` pela API REST (CA-09).
- [ ] **T-17** 🔍 CI verde, incluindo concorrência e E2E.
- [ ] **T-18** 📝 Atualizar `spec.md`/`plan.md` e abrir PR `spec-005-retirada-devolucao`.

> RF-14 e RF-15 (relatórios, CA-12) são entregues e testados na spec 007.

---

## Cobertura de critérios de aceite

| CA | Tarefa de teste |
|---|---|
| CA-01 | T-03 |
| CA-02 | T-03 |
| CA-03 | T-03 |
| CA-04 | T-05 |
| CA-05 | T-05, T-15 |
| CA-06 | T-05 |
| CA-07 | T-05 |
| CA-08 | T-03 |
| CA-09 | T-03, T-05, T-16 |
| CA-10 | T-07 |
| CA-11 | T-10 |
| CA-12 | spec 007 (T-04 de lá) |
| CA-13 | T-05 |
| CA-14 | T-07 |
| CA-15 | T-05 |
