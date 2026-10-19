# Tarefas — 002 Cadastro de itens, tipos e locais

Ordem do projeto: **testes → migration/código → rodar testes → atualizar spec/tasks**, banco antes do front.
Marque `[x]` só quando os testes da tarefa passam. Detalhes técnicos em `plan.md`.

Legenda: 🧪 teste primeiro · 🗄️ banco · 🖥️ front · 🔍 validação

**Pré-requisito:** spec 001 entregue (helpers `eh_admin_ativo()`/`usuario_ativo()`, `auditoria` e `auditar()`).

---

## Fase 1 — Tipos e locais (RF-01 a RF-04)

- [ ] **T-01** 🧪 pgTAP `002_tipo_local.test.sql`: estrutura e RLS de `tipo_item` e `local`; os três tipos iniciais existem após a migration, com `consumivel` correto (RF-01, RF-02); nome único (citext); tipo em uso não é excluído, só desativado (RF-03); caminho negado para solicitante, pendente e inativo.
- [ ] **T-02** 🗄️ Migration `002_catalogo` (parte 1): `tipo_item` com os três tipos inseridos na migration, `local`, RLS (`select` para ativo, escrita só admin).

## Fase 2 — Itens e movimentação (RF-05 a RF-09, RF-14)

- [ ] **T-03** 🧪 pgTAP `002_item.test.sql`:
  - **CA-01**: patrimônio com quantidade 5 → rejeitado; **CA-02**: patrimônio duplicado → rejeitado;
  - **CA-03**: 10 chaves sem patrimônio → `total = 10`, disponível 10;
  - CHECK P-03; `estoque_minimo` rejeitado para tipo não consumível; enum `estado_item`;
  - **CA-06**: solicitante cria/edita/exclui (inclusive API direta) → negado;
  - `update` direto em `quantidade_total`/`reservada`/`em_uso`/`operante` → negado até para admin (RF-06, RF-14);
  - **CA-08**: excluir item com movimentação → erro de FK (`23503`).
- [ ] **T-04** 🗄️ Migration `002_catalogo` (parte 2): enum `estado_item`, `item` com constraints e triggers (patrimônio = 1 no insert, `estoque_minimo` só consumível), índices, RLS e revokes por coluna; enum `tipo_movimentacao` e tabela `movimentacao` imutável.
- [ ] **T-05** 🧪 pgTAP `002_ajuste.test.sql`:
  - **CA-04**: reservada 3 + em_uso 2, ajuste para 4 → rejeitado, nada muda;
  - ajuste válido grava `movimentacao` `ajuste` com diferença e motivo (RF-09); motivo vazio → rejeitado;
  - item com patrimônio não passa de 1;
  - caminho negado (solicitante, pendente, inativo).
- [ ] **T-06** 🗄️ RPC `ajustar_quantidade_item(item_id, nova_quantidade, motivo)`.
- [ ] **T-07** 🧪 pgTAP `002_operancia.test.sql`:
  - **CA-11**: reativar sem motivo → rejeitado; com motivo → `operante = true` e auditoria com `motivo`;
  - marcar inoperante (motivo opcional) → auditado;
  - caminho negado.
- [ ] **T-08** 🗄️ RPC `alterar_operancia_item(item_id, operante, motivo)` com `app.motivo`.

## Fase 3 — Auditoria e catálogo (RN-02, RF-10, RF-11)

- [ ] **T-09** 🧪 pgTAP `002_auditoria.test.sql`:
  - **CA-07**: mudança de local gera registro com usuário, data, antes/depois (= spec-006/CA-01);
  - insert e desativação de item, tipo e local são auditados;
  - ajuste manual de `quantidade_total` é auditado com motivo (spec-006/CA-06);
  - update só de `reservada`/`em_uso` com `app.origem = 'movimentacao'` não gera registro (RN-02).
- [ ] **T-10** 🗄️ Ligar `auditar()` em `item`, `tipo_item`, `local` (spec-006/RF-02, RF-05).
- [ ] **T-11** 🧪 pgTAP `002_catalogo.test.sql`:
  - `disponivel = total − reservada − em_uso` (RF-11);
  - **CA-05**: inoperante aparece com `operante = false`;
  - **CA-10**: desativado não aparece para professor (inclusive API direta); admin vê;
  - item de tipo ou local desativado some para professor.
- [ ] **T-12** 🗄️ View `catalogo` (`security_invoker = true`).
- [ ] **T-13** 🔍 `supabase db reset` + `supabase test db`; revisão manual: RLS em toda tabela nova, `search_path` fixo, `grant execute` só para `authenticated`; `seed.sql` com locais e itens de exemplo (insumo com mínimo, ferramenta com várias unidades, máquina com patrimônio).
- [ ] **T-14** 🗄️ `npm run db:types`.

## Fase 4 — Front

- [ ] **T-15** 🖥️ `web/src/shared/lib/erroRpc.ts` (convenção do `CLAUDE.md`): converte `PostgrestError` em mensagem + lista por item; `23503` → "Possui histórico — desative". Teste Vitest.
- [ ] **T-16** 🖥️ **RF-10, RF-11, CA-05**: `features/catalogo/` com busca, filtros (tipo, local, operante, disponibilidade), badge "Inoperante" sem botão de adicionar; hook público `useCatalogo` no `index.ts`. Testes Vitest dos filtros e da sinalização.
- [ ] **T-17** 🖥️ **RF-03, RF-04**: `features/itens-admin/` — telas de tipos e locais (criar, editar, desativar).
- [ ] **T-18** 🖥️ **RF-05, RF-07, RF-08, CA-08**: formulário de item (Zod; patrimônio ⇒ quantidade 1; `estoque_minimo` só para tipo consumível — spec-007/RF-08); exclusão negada oferece "Desativar".
- [ ] **T-19** 🖥️ **RF-09, RF-14**: ajuste de quantidade com motivo; "Marcar inoperante" e "Reativar" (motivo obrigatório).

## Fase 5 — Fechamento

- [ ] **T-20** 🔍 Teste manual com token de solicitante: tentar `insert`/`update`/`delete` em `item`, `tipo_item`, `local` e `update` nos contadores pela API REST (CA-06).
- [ ] **T-21** 🔍 CI verde (lint, Prettier, `typecheck`, Vitest, `supabase test db`).
- [ ] **T-22** 📝 Atualizar `spec.md`/`plan.md` com o entregue e abrir PR `spec-002-catalogo`.

> RF-12 (estoque mínimo, CA-09) é entregue e testado na spec 007; RF-13 (aba Histórico) na spec 006.

---

## Cobertura de critérios de aceite

| CA | Tarefa de teste |
|---|---|
| CA-01 | T-03 |
| CA-02 | T-03 |
| CA-03 | T-03 |
| CA-04 | T-05 |
| CA-05 | T-11, T-16 |
| CA-06 | T-03, T-20 |
| CA-07 | T-09 |
| CA-08 | T-03, T-18 |
| CA-09 | spec 007 (T-02 de lá) |
| CA-10 | T-11 |
| CA-11 | T-07 |
