# Plano — 005 Retirada e devolução

Decisões técnicas ("como") da spec 005. Convenções transversais no `CLAUDE.md` → Banco.

Depende de: 001 (helpers, auditoria), 002 (`item`, `movimentacao`, `alterar_operancia_item`), 003/004 (`solicitacao`, `quantidade_aprovada`).

## Dados

Migration `005_retirada_devolucao` acrescenta:

- `solicitacao`: `entregue_por_id` FK `profiles` null, `data_retirada timestamptz` null, `data_conclusao timestamptz` null (RF-03).
- `solicitacao_item`: `quantidade_devolvida int not null default 0`, `quantidade_baixada int not null default 0`, `check (quantidade_devolvida >= 0 and quantidade_baixada >= 0 and quantidade_devolvida + quantidade_baixada <= coalesce(quantidade_aprovada, 0))` (RF-09).

Pendente de devolução de uma linha = `quantidade_aprovada − quantidade_devolvida − quantidade_baixada`.

## RPCs

Todas `SECURITY DEFINER`, `search_path` fixo, `eh_admin_ativo()` no início (CA-09). Ordem de bloqueio: solicitação → itens por `id` (P-04). Antes de mexer nos contadores, cada RPC faz `set_config('app.origem', 'movimentacao', true)` — a baixa de `quantidade_total` (insumo retirado, danificada, perda) **não** vai para a auditoria (spec-006/RF-05, CA-16), só para `movimentacao`. A mudança de `operante` continua auditada.

### `registrar_retirada(solicitacao_id)` (RF-01 a RF-05)
Sempre retira **todas** as linhas aprovadas; não há retirada parcial (RF-05).

1. Trava a solicitação; exige `aprovada` — chamar de novo falha com "Solicitação não está aprovada" (RN-03, CA-08).
2. Trava os itens das linhas com aprovada > 0.
3. Por linha: consumível → `reservada -= q, total -= q` (CA-01); não consumível → `reservada -= q, em_uso += q` (CA-02); `movimentacao` `retirada` (RF-02).
4. `entregue_por_id`, `data_retirada`; status `concluida` (+ `data_conclusao`) se não houver linha não consumível com aprovada > 0, senão `retirada` (RF-04, CA-03).

### `registrar_devolucao(solicitacao_id, itens jsonb)` (RF-07 a RF-11, RF-16)
`itens` = `[{"solicitacao_item_id", "quantidade_devolvida", "quantidade_danificada", "marcar_inoperante", "observacao"}]`.

1. Trava a solicitação (`retirada`) e os itens.
2. Por linha: só item não consumível; `devolvida + danificada <= pendente` (CA-06 — falha inteira, nada muda).
3. Devolvidas: `em_uso -= q`, `quantidade_devolvida += q`, `movimentacao` `devolucao` (RF-08, CA-04).
4. Danificadas: `em_uso -= q`, `total -= q`, `quantidade_baixada += q`, `movimentacao` `ajuste` com motivo "Devolvido danificado: <observacao>" (RF-16, CA-13).
5. `marcar_inoperante`: só se o item tem `numero_patrimonio`, senão erro "Informe as unidades danificadas" (RF-10, CA-15); chama `alterar_operancia_item(item, false, observacao)` da spec 002, que audita (CA-07).
6. `concluir_se_completa(solicitacao_id)`.

### `registrar_baixa(solicitacao_item_id, quantidade, motivo)` — perda (RF-12)
Trava solicitação (`retirada`) e item; `quantidade <= pendente`; motivo obrigatório; `em_uso -= q`, `total -= q`, `quantidade_baixada += q`, `movimentacao` `ajuste` (CA-10); `concluir_se_completa`.

### `concluir_se_completa(solicitacao_id)` (interna, sem `grant execute`)
Se toda linha não consumível tem `devolvida + baixada = aprovada` → `concluida`, `data_conclusao = now()` (RF-11, CA-05, CA-14).

O `CHECK` P-03 e os `check >= 0` dos contadores são a última barreira (RN-01).

## Leitura

RF-14 (com cada professor) e RF-15 (históricos) são entregues pela **spec 007** (RF-09 a RF-13). Esta spec garante os dados de que eles dependem: `quantidade_devolvida`, `quantidade_baixada`, `data_retirada`, `entregue_por_id` e as `movimentacao`.

## Front

`features/retirada/`: conferência (checklist) dos itens aprovados antes de confirmar a retirada (RF-06); tela de devolução por linha com "boas" e "danificadas", observação e "marcar inoperante" só para item com patrimônio; ação de baixa por perda com motivo.

## Testes

- pgTAP `005_*.test.sql`: CA-01 a CA-10 e CA-13 a CA-15 (CA-12 é testado na spec 007), com caminho negado; invariante `em_uso` do item = soma dos pendentes das linhas `retirada` não consumíveis.
- Concorrência (`supabase/tests/concorrencia/`): **CA-11** — retirada e `ajustar_quantidade_item` (spec 002) simultâneos no mesmo item; serializados, `CHECK` nunca violado.
