# Tarefas — 003 Solicitação de retirada com carrinho

Ordem do projeto: **testes → migration/código → rodar testes → atualizar spec/tasks**, banco antes do front.
Marque `[x]` só quando os testes da tarefa passam. Detalhes técnicos em `plan.md`.

Legenda: 🧪 teste primeiro · 🗄️ banco · 🖥️ front · 🔍 validação

**Pré-requisito:** specs 001 e 002 entregues (`catalogo`, `useCatalogo`, `erroRpc.ts`).

---

## Fase 1 — Dados e RLS (RF-01, RF-03, RF-10, RF-11)

- [ ] **T-01** 🧪 pgTAP `003_solicitacao_schema.test.sql`: enum `status_solicitacao`, tabelas, `unique (solicitacao_id, item_id)`, `check` de justificativa e quantidade, FK `movimentacao.solicitacao_id`, RLS habilitado.
- [ ] **T-02** 🧪 pgTAP `003_solicitacao_rls.test.sql`:
  - **CA-07**: professor A não lê solicitação nem linhas do professor B (inclusive API direta);
  - admin lê todas (RF-10);
  - `insert`/`update`/`delete` direto negados para todos (RF-11).
- [ ] **T-03** 🗄️ Migration `003_solicitacao`: enum, `solicitacao`, `solicitacao_item`, FK em `movimentacao`, índices, RLS.

## Fase 2 — RPCs (RF-05 a RF-07, RF-09)

- [ ] **T-04** 🧪 pgTAP `003_enviar.test.sql`:
  - **CA-01**: 2 itens disponíveis → `pendente` com 2 linhas; nenhum contador muda;
  - **CA-02**: disponível 2, pede 3 → rejeitado, nada criado;
  - **CA-03**: item inoperante → rejeitado, `detail` identifica o item;
  - **CA-04**: sem justificativa → erro de validação;
  - **CA-08**: pendente e inativo → negado;
  - RF-07: dois itens inválidos → `detail` lista os dois; item repetido no payload → rejeitado; item desativado → rejeitado;
  - solicitação sempre em nome de `auth.uid()` (RF-01).
- [ ] **T-05** 🗄️ RPC `enviar_solicitacao(itens, justificativa)`.
- [ ] **T-06** 🧪 pgTAP `003_cancelar.test.sql`:
  - **CA-05**: dono cancela `pendente` → `cancelada`, nenhum contador muda;
  - **CA-06**: `aprovada` (ou posterior) → negado pelo fluxo do solicitante (montar o estado direto no teste, já que a 004 ainda não existe);
  - outro usuário cancelando → negado.
- [ ] **T-07** 🗄️ RPC `cancelar_solicitacao(id)`.
- [ ] **T-08** 🔍 `supabase db reset` + `supabase test db`; revisão de `search_path`, grants e RLS; `npm run db:types`.

## Fase 3 — Front (RF-02, RF-04, RF-08, RF-09)

- [ ] **T-09** 🖥️ **RF-02, RF-03**: `features/carrinho/` — Context + `useReducer`; testes Vitest do reducer (adicionar, alterar, remover, item não repete).
- [ ] **T-10** 🖥️ **CA-09**: persistência em `localStorage` (`estoque:carrinho:<user_id>`, `try/catch`) e revalidação contra `useCatalogo` ao carregar (remove desativado, marca inoperante, reduz acima do disponível, avisa). Testes Vitest com `localStorage` falso.
- [ ] **T-11** 🖥️ **RF-04, RF-05, RF-06, RF-07**: tela do carrinho com justificativa (Zod), envio, erros por item do `detail` na linha correspondente; limpa o carrinho após sucesso.
- [ ] **T-12** 🖥️ **RF-08, RF-09**: `features/solicitacoes/` — "Minhas solicitações" (status, data, itens), detalhe, botão cancelar só em `pendente`.

## Fase 4 — Fechamento

- [ ] **T-13** 🔍 Teste manual com token de solicitante: ler solicitações de outro usuário e chamar `insert` direto em `solicitacao` pela API REST (CA-07).
- [ ] **T-14** 🔍 CI verde.
- [ ] **T-15** 📝 Atualizar `spec.md`/`plan.md` e abrir PR `spec-003-solicitacao`.

> 003 OPEN-02 (limite por solicitação) segue aberto; se for decidido, entra como cenário novo no T-04 e checagem no passo 2 da RPC.

---

## Cobertura de critérios de aceite

| CA | Tarefa de teste |
|---|---|
| CA-01 | T-04 |
| CA-02 | T-04 |
| CA-03 | T-04 |
| CA-04 | T-04 |
| CA-05 | T-06 |
| CA-06 | T-06 |
| CA-07 | T-02, T-13 |
| CA-08 | T-04 |
| CA-09 | T-10 |
