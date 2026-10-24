# Tarefas — 004 Aprovação de solicitações

Ordem do projeto: **testes → migration/código → rodar testes → atualizar spec/tasks**, banco antes do front.
Marque `[x]` só quando os testes da tarefa passam. Detalhes técnicos em `plan.md`.

Legenda: 🧪 teste primeiro · 🗄️ banco · 🖥️ front · 🔍 validação

**Pré-requisito:** specs 001 a 003 entregues; suíte de concorrência da spec 001 (T-06a) disponível.

---

## Fase 1 — Dados (RF-04, RF-08, RF-10)

- [ ] **T-01** 🧪 pgTAP `004_schema.test.sql`: novas colunas em `solicitacao` e `solicitacao_item`; `check (0 <= aprovada <= solicitada)`; `check` de motivo na recusa.
- [ ] **T-02** 🗄️ Migration `004_aprovacao`: colunas e constraints.

## Fase 2 — Aprovar (RF-01 a RF-07, RF-09)

- [ ] **T-03** 🧪 pgTAP `004_aprovar.test.sql`:
  - **CA-01**: total 10, reservada 8, aprovar 5 → "estoque insuficiente", nada muda;
  - **CA-02**: 3 linhas, uma com aprovada 0 → `aprovada`, reservas e `movimentacao` `reserva` só para 2;
  - **CA-04**: solicitante (e admin pendente/inativo) → erro de permissão;
  - **CA-05**: admin aprovando a própria → rejeitado;
  - **CA-07**: aprovar de novo → status inválido, sem reserva duplicada;
  - **CA-09**: item ficou inoperante → rejeitado;
  - **CA-10**: soma aprovada 0 → orienta a recusar;
  - **CA-13**: solicitante inativado ou pendente depois do envio → rejeitado; recusa permitida;
  - payload sem todas as linhas → rejeitado; `aprovador_id`, `data_decisao`, `observacao_decisao` gravados;
  - nenhuma linha nova em `auditoria` (spec-006/CA-04).
- [ ] **T-04** 🗄️ RPC `aprovar_solicitacao(id, itens, observacao)` com bloqueio solicitação → itens por `id` e `app.origem`.
- [ ] **T-05** 🧪 Concorrência `supabase/tests/concorrencia/004-aprovacao.test.ts` — **CA-03**: duas sessões de admins diferentes aprovam, ao mesmo tempo, solicitações do mesmo item com estoque para uma; exatamente uma conclui, a outra falha, `reservada` correto e CHECK nunca violado. **RN-03**: professor cancela × admin aprova a mesma solicitação → sem reserva órfã.

## Fase 3 — Recusar e cancelar (RF-08, RF-10, RN-03)

- [ ] **T-06** 🧪 pgTAP `004_recusar_cancelar.test.sql`:
  - **CA-06**: recusa sem motivo → rejeitada; com motivo → `recusada`, estoque intacto;
  - **CA-08**: cancelar aprovada com reserva 3 → `reservada` volta, `movimentacao` `liberacao_reserva`;
  - cancelar solicitação não `aprovada` → rejeitado; caminho negado em ambas.
- [ ] **T-07** 🗄️ RPCs `recusar_solicitacao(id, motivo)` e `cancelar_solicitacao_aprovada(id, motivo)`.
- [ ] **T-08** 🧪 pgTAP `004_invariante.test.sql` — **RN-03**: após uma sequência de aprovações, cancelamentos e recusas, para cada item `quantidade_reservada` = soma de `quantidade_aprovada` das solicitações `aprovada`.

## Fase 4 — Leitura (RF-03, RF-11 a RF-13)

- [ ] **T-09** 🧪 pgTAP `004_leitura.test.sql`:
  - fila em ordem de `criado_em`, com disponível atual (RF-03); solicitante não lê a fila;
  - **CA-11**: professor vê quantidade aprovada por linha e a observação;
  - **CA-12**: aprovada há 10 dias continua `aprovada`, reserva mantida, `dias_aguardando = 10`.
- [ ] **T-10** 🗄️ Views `fila_aprovacao` e `aprovadas_aguardando_retirada`.
- [ ] **T-11** 🔍 `supabase db reset` + `supabase test db` + `npm run test:db:concorrencia`; revisão de grants/`search_path`; `npm run db:types`.

## Fase 5 — Front

- [ ] **T-12** 🖥️ **RF-03**: `features/aprovacao/` — fila de pendentes.
- [ ] **T-13** 🖥️ **RF-04 a RF-08**: tela de decisão (quantidade por linha pré-preenchida com `min(solicitada, disponível)`, observação opcional, aprovar/recusar com motivo); erros por item via `erroRpc.ts`. Testes Vitest do formulário.
- [ ] **T-14** 🖥️ **RF-10, RF-13**: lista de aprovadas aguardando retirada com dias e ação de cancelar (motivo).
- [ ] **T-15** 🖥️ **RF-11, RF-12**: detalhe em "Minhas solicitações" (spec 003) mostra quantidade aprovada, observação e motivo de recusa.

## Fase 6 — Fechamento

- [ ] **T-16** 🔍 Teste manual com token de solicitante chamando `aprovar_solicitacao` e lendo `fila_aprovacao` pela API REST (CA-04).
- [ ] **T-17** 🔍 CI verde, incluindo a suíte de concorrência.
- [ ] **T-18** 📝 Atualizar `spec.md`/`plan.md` e abrir PR `spec-004-aprovacao`.

---

## Cobertura de critérios de aceite

| CA | Tarefa de teste |
|---|---|
| CA-01 | T-03 |
| CA-02 | T-03 |
| CA-03 | T-05 |
| CA-04 | T-03, T-16 |
| CA-05 | T-03 |
| CA-06 | T-06 |
| CA-07 | T-03 |
| CA-08 | T-06 |
| CA-09 | T-03 |
| CA-10 | T-03 |
| CA-11 | T-09 |
| CA-12 | T-09 |
| CA-13 | T-03 |
