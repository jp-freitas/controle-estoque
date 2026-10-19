# 005 — Retirada e devolução

## Contexto
Após a aprovação, o item é entregue fisicamente ao professor (retirada) e, quando não é consumível, devolvido depois. O mesmo grupo de administradores aprova e entrega.

## Histórias
- Como administrador, quero registrar a retirada quando o professor pegar os itens aprovados.
- Como administrador, quero registrar a devolução (inclusive parcial) para o estoque voltar a ficar disponível.
- Como administrador, quero marcar um item como inoperante se voltar danificado.
- Como administrador, quero ver o que está atualmente com cada professor.

## Requisitos funcionais

### Retirada
- RF-01: RPC `registrar_retirada(solicitacao_id)` só para `admin` ativo, sobre solicitação `aprovada`.
- RF-02: Em uma única transação, com bloqueio de linha dos itens, para cada linha com `quantidade_aprovada > 0`:
  - **Insumo (consumível):** `reservada -= q` e `total -= q`;
  - **Ferramenta/Máquina (não consumível):** `reservada -= q` e `em_uso += q`;
  - grava `movimentacao` tipo `retirada`.
- RF-03: Grava `entregue_por_id` e `data_retirada`; status passa a `retirada`.
- RF-04: Se a solicitação só tem itens consumíveis, o status passa direto a `concluida` na retirada. Em solicitação mista, permanece `retirada` até as devoluções dos não consumíveis.
- RF-05: Entrega parcial de uma solicitação aprovada **não** é suportada na primeira versão: a retirada contempla todas as linhas aprovadas. Para cancelar parte, usar o cancelamento da spec-004. *(Ver OPEN-01.)*
- RF-06: A tela mostra uma conferência (checklist) dos itens e quantidades antes de confirmar a retirada.

### Devolução
- RF-07: RPC `registrar_devolucao(solicitacao_id, itens)` só para `admin` ativo, sobre solicitação `retirada`. `itens` informa, por linha, `quantidade_devolvida` (unidades em bom estado), `quantidade_danificada` e, opcionalmente, `marcar_inoperante` e `observacao`.
- RF-08: Cada devolução faz `em_uso -= q` e acumula em `quantidade_devolvida`; devolução parcial é permitida.
- RF-09: Por linha, `quantidade_devolvida + quantidade_baixada` acumuladas nunca excedem `quantidade_aprovada`. Devolução só vale para itens não consumíveis.
- RF-10: `marcar_inoperante = true` só é aceito para item de **unidade única** (com `numero_patrimonio`): o item passa a `operante = false`, a unidade volta ao estoque contábil, mas não pode ser solicitado até um admin reativá-lo com motivo (spec-002/RF-14).
- RF-16: Unidades **danificadas** (`quantidade_danificada`) recebem baixa: `em_uso -= q` e `total -= q`, movimentação tipo `ajuste` com o motivo, e acumulam em `quantidade_baixada` da linha. Vale para itens com várias unidades e para itens de patrimônio irrecuperáveis.
- RF-11: Quando todas as linhas não consumíveis estiverem com `devolvida + baixada = aprovada`, a solicitação passa a `concluida`.
- RF-12: Registro de **perda/baixa** (item não devolvido por perda ou quebra irreparável): admin pode dar baixa na quantidade pendente, com motivo, reduzindo `em_uso` e `total`, acumulando em `quantidade_baixada` da linha e gravando `movimentacao` tipo `ajuste`.
- RF-13: Todas as operações geram `movimentacao` com usuário e data.

### Consultas
- RF-14: Relatório "Itens atualmente com cada professor" (solicitações `retirada` com quantidade pendente = aprovada − devolvida − baixada > 0), filtrável por professor e item. Entregue pela spec-007 (RF-09 a RF-11).
- RF-15: Histórico por item e por professor (movimentações em ordem cronológica). Entregue pela spec-007 (RF-12, RF-13).

## Regras de negócio
- RN-01: Nunca existe estoque "negativo": o `CHECK (reservada + em_uso <= total)` é a última barreira.
- RN-02: Não há prazo de devolução nem controle de atraso na primeira versão.
- RN-03: A retirada só pode ocorrer uma vez por solicitação (idempotência: chamar de novo falha).

## Critérios de aceite
CA-01  Dado uma solicitação aprovada de 3 unidades de insumo (total 10, reservada 3)
       Quando o admin registra a retirada
       Então `total = 7`, `reservada = 0`, status `concluida` e movimentação `retirada` gravada.

CA-02  Dado uma solicitação aprovada de 1 furadeira (Máquina)
       Quando o admin registra a retirada
       Então `reservada -= 1`, `em_uso += 1`, `total` inalterado e status `retirada`.

CA-03  Dado uma solicitação com insumo e ferramenta
       Quando é retirada
       Então o insumo é baixado definitivamente, a ferramenta vai para `em_uso` e o status é `retirada`.

CA-04  Dado uma solicitação `retirada` com 5 chaves (em_uso 5)
       Quando o admin devolve 3
       Então `em_uso = 2`, `quantidade_devolvida = 3` e o status continua `retirada`.

CA-05  Dado a devolução das 2 restantes
       Então `em_uso = 0` e o status passa a `concluida`.

CA-06  Dado uma devolução de quantidade maior que a pendente
       Então a operação é rejeitada e nenhum contador muda.

CA-07  Dado a devolução de um item com patrimônio com `marcar_inoperante`
       Então o item fica `operante = false`, deixa de poder ser solicitado e a mudança é auditada.

CA-08  Dado uma solicitação já retirada
       Quando o admin tenta registrar a retirada de novo
       Então a operação é rejeitada (status inválido), sem alterar contadores.

CA-09  Dado um solicitante comum
       Quando chama `registrar_retirada` ou `registrar_devolucao`
       Então recebe erro de permissão.

CA-10  Dado uma ferramenta não devolvida
       Quando o admin registra a perda com motivo
       Então `em_uso` e `total` diminuem na quantidade perdida e fica registrada a movimentação de ajuste.

CA-11  Dado duas operações simultâneas (retirada e ajuste) no mesmo item
       Então são serializadas e o CHECK de estoque nunca é violado.

CA-12  Dado o relatório "com cada professor"
       Então lista apenas quantidades ainda pendentes de devolução, agrupadas por professor.

CA-13  Dado uma solicitação `retirada` com 10 chaves (em_uso 10, total 10)
       Quando o admin devolve 9 boas e 1 danificada
       Então `em_uso = 0`, `total = 9`, `quantidade_baixada = 1`, movimentações `devolucao` e `ajuste` gravadas e status `concluida`.

CA-14  Dado uma solicitação `retirada` com 2 ferramentas, uma delas perdida (baixa de 1)
       Quando a outra é devolvida
       Então a solicitação passa a `concluida` (devolvida 1 + baixada 1 = aprovada 2).

CA-15  Dado um item sem patrimônio (várias unidades)
       Quando a devolução vem com `marcar_inoperante`
       Então a operação é rejeitada, orientando a informar as unidades danificadas.

## Fora de escopo
Assinatura digital de recebimento, prazo e alerta de atraso, QR code, retirada parcial de uma solicitação aprovada.

## Pontos em aberto
- **OPEN-01 (resolvido em 2026-10-19):** Sem retirada parcial na v1, coerente com RF-05.
- **OPEN-02 (resolvido em 2026-10-19):** A devolução informa as unidades danificadas, que recebem baixa (RF-16); `marcar_inoperante` só para item de unidade única (RF-10). Conclusão passa a considerar `devolvida + baixada` (RF-11). Refletido em RF-07, RF-09 a RF-12, RF-14, RF-16 e CA-13 a CA-15.
- **OPEN-03 (resolvido em 2026-10-19):** Só admin ativo reativa item inoperante, com motivo obrigatório, auditado (spec-002/RF-14, CA-11).
