# Plano — 004 Aprovação de solicitações

Decisões técnicas ("como") da spec 004. Convenções transversais no `CLAUDE.md` → Banco.

Depende de: 001 (helpers), 002 (`item`, `movimentacao`), 003 (`solicitacao`, `solicitacao_item`).

## Dados

Migration `004_aprovacao` acrescenta:

- `solicitacao`: `aprovador_id` FK `profiles` null, `data_decisao timestamptz` null, `motivo_recusa text` null, `observacao_decisao text` null (RF-04, OPEN-01), `cancelado_por_id` FK null, `motivo_cancelamento text` null.
  - `check (status <> 'recusada' or motivo_recusa is not null)`.
- `solicitacao_item`: `quantidade_aprovada int` null, `check (quantidade_aprovada between 0 and quantidade_solicitada)`.

## RPCs

Todas `SECURITY DEFINER`, `search_path` fixo, `eh_admin_ativo()` no início (RF-01, CA-04). As que mexem em `quantidade_reservada` fazem `set_config('app.origem', 'movimentacao', true)` (spec-006/RF-05, CA-04).

### `aprovar_solicitacao(id, itens jsonb, observacao text default null)`
`itens` = `[{"solicitacao_item_id", "quantidade_aprovada"}]`.

1. `select … from solicitacao where id = $1 for update` — serializa decisões sobre a mesma solicitação (CA-07).
2. Valida `status = 'pendente'` (RF-09), `solicitante_id <> auth.uid()` (RF-02, CA-05), que **todas** as linhas da solicitação vieram no payload, e soma aprovada > 0 (RF-05, CA-10: "Nada aprovado — use Recusar").
3. `select … from item where id = any(…) order by id for update` — ordem fixa evita deadlock entre aprovações concorrentes (P-04, RN-02).
4. Para cada linha com aprovada > 0: item ativo e operante (RF-07, CA-09) e `disponivel >= aprovada` (RF-06, CA-01). Falhas acumuladas → `raise` com `detail` por item; nada muda.
5. `update item set quantidade_reservada += aprovada`; `movimentacao` tipo `reserva` por linha com aprovada > 0 (RF-04).
6. Grava `quantidade_aprovada` (inclusive 0 — CA-02), `aprovador_id`, `data_decisao`, `observacao_decisao`, `status = 'aprovada'`.

O `CHECK` P-03 do item é a última barreira se algo escapar (CA-03).

### `recusar_solicitacao(id, motivo)`
Trava a solicitação; `pendente`; não própria; `motivo` não vazio (CA-06); `status = 'recusada'`, `aprovador_id`, `data_decisao`, `motivo_recusa`. Não toca estoque (RF-08).

### `cancelar_solicitacao_aprovada(id, motivo)`
Trava a solicitação e depois os itens em ordem de `id`; só `aprovada` (sem retirada); `reservada -= quantidade_aprovada` por linha; `movimentacao` `liberacao_reserva`; `status = 'cancelada'`, `cancelado_por_id`, `motivo_cancelamento` (RF-10, CA-08, RN-03).

## Leitura

- View `fila_aprovacao` (`security_invoker`, admin): solicitações `pendente` ordenadas por `criado_em` (mais antigas primeiro), solicitante, justificativa, linhas com quantidade solicitada e **disponível atual** de cada item (RF-03).
- View `aprovadas_aguardando_retirada` (admin): `aprovada`, com `dias_aguardando = current_date − data_decisao::date` (RF-13, CA-12). Sem job de expiração (OPEN-02). Também alimenta o card "aprovadas aguardando retirada" do painel (spec-007/RF-02).
- O professor vê `quantidade_aprovada` e `observacao_decisao` pelo próprio `select` em `solicitacao`/`solicitacao_item` (RF-11, RF-12, CA-11); a RLS da 003 já cobre.
- 004 OPEN-03 (aviso ao professor) segue aberto; na v1 o professor vê o status em "Minhas solicitações".

## Front

`features/aprovacao/`: fila de pendentes; tela de decisão com quantidade aprovada por linha (pré-preenchida com `min(solicitada, disponível)`), observação opcional, aprovar/recusar (motivo obrigatório); lista de aprovadas aguardando retirada com dias e ação de cancelar (motivo). Erros por item do `detail` aparecem na linha.

## Testes

- pgTAP `004_*.test.sql`: CA-01, CA-02, CA-04 a CA-12, com caminho negado (solicitante, admin pendente/inativo).
- pgTAP de invariante (RN-03): para cada item, `quantidade_reservada` = soma de `quantidade_aprovada` das solicitações `aprovada` — rodado ao fim de cada cenário.
- Concorrência (`supabase/tests/concorrencia/`): **CA-03** — duas sessões aprovando solicitações do mesmo item com estoque para uma; exatamente uma conclui, sem reserva dupla.
