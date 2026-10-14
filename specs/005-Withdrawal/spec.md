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
- RF-07: RPC `registrar_devolucao(solicitacao_id, itens)` só para `admin` ativo, sobre solicitação `retirada`. `itens` informa, por linha, `quantidade_devolvida` e, opcionalmente, `marcar_inoperante` e `observacao`.
- RF-08: Cada devolução faz `em_uso -= q` e acumula em `quantidade_devolvida`; devolução parcial é permitida.
- RF-09: A quantidade devolvida acumulada nunca excede `quantidade_aprovada`, e só vale para itens não consumíveis.
- RF-10: Se `marcar_inoperante = true`, o item passa a `operante = false`. A unidade devolvida volta ao estoque contábil, mas o item inoperante deixa de poder ser solicitado até o admin reativá-lo. *(Ver OPEN-02 sobre perdas e itens com várias unidades.)*
- RF-11: Quando todas as linhas não consumíveis estiverem com `devolvida = aprovada`, a solicitação passa a `concluida`.
- RF-12: Registro de **perda/baixa** (item não devolvido por perda ou quebra irreparável): admin pode dar baixa na quantidade pendente, com motivo, reduzindo `em_uso` e `total` e gravando `movimentacao` tipo `ajuste`.
- RF-13: Todas as operações geram `movimentacao` com usuário e data.

### Consultas
- RF-14: Relatório "Itens atualmente com cada professor" (solicitações `retirada` com quantidade pendente de devolução), filtrável por professor e item.
- RF-15: Histórico por item e por professor (movimentações em ordem cronológica).

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

CA-07  Dado uma devolução com `marcar_inoperante`
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

## Fora de escopo
Assinatura digital de recebimento, prazo e alerta de atraso, QR code, retirada parcial de uma solicitação aprovada.

## Pontos em aberto
- **OPEN-01:** Admins precisam de retirada parcial (professor leva só parte dos itens aprovados e o resto depois)?
- **OPEN-02:** Item com várias unidades (ex.: 10 chaves) devolvido com 1 unidade danificada: marcar o item todo como inoperante é incorreto. Opções: (a) permitir informar quantas unidades voltaram danificadas e baixá-las ou movê-las para um item "em manutenção"; (b) tratar como perda parcial (RF-12). Definir a regra antes da implementação.
- **OPEN-03:** Quem pode reativar um item inoperante? Sugestão: apenas admin, com motivo, auditado.
