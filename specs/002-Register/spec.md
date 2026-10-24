# 002 — Cadastro de itens, tipos e locais

## Contexto
O administrador mantém o catálogo do inventário: tipos de item, locais e itens. Solicitantes apenas consultam.

## Histórias
- Como administrador, quero cadastrar e editar itens para manter o inventário atualizado.
- Como administrador, quero marcar um item como inoperante para impedir que seja solicitado.
- Como professor, quero buscar e filtrar itens para encontrar o que preciso.

## Requisitos funcionais

### Tipos de item
- RF-01: Tipos iniciais: **Insumo**, **Ferramenta**, **Máquina**.
- RF-02: Cada tipo tem o atributo `consumivel` (Insumo = sim; Ferramenta e Máquina = não).
- RF-03: Admin pode criar novos tipos, definindo `consumivel`. Um tipo em uso não pode ser excluído (apenas desativado).

### Locais
- RF-04: Admin cadastra, edita e desativa locais (`nome`, `descricao` opcional). Nome único.

### Itens
- RF-05: Campos do item:

| Campo | Obrigatório | Observação |
|---|---|---|
| `nome` | Sim | |
| `tipo_id` | Sim | |
| `local_id` | Sim | |
| `quantidade_total` | Sim | Inteiro ≥ 0 |
| `operante` | Sim | Padrão: operante |
| `estado` | Não | Lista fechada: `novo`, `bom`, `regular`, `ruim` |
| `numero_patrimonio` | Não | Único quando preenchido |
| `descricao` | Não | |
| `estoque_minimo` | Não | Só faz sentido para insumos |

- RF-06: Contadores `quantidade_reservada` e `quantidade_em_uso` não são editáveis pelo formulário; só mudam via funções de estoque (constituição P-01).
- RF-07: Item com `numero_patrimonio` é cadastrado com `quantidade_total = 1`. Depois do cadastro, só pode ficar com 1 ou com 0 (após baixa por perda/dano, spec-005), nunca mais que 1.
- RF-08: Admin pode criar, editar e desativar itens. Item com histórico de movimentação não pode ser excluído, apenas desativado.
- RF-09: Admin ajusta `quantidade_total` por ajuste manual com motivo obrigatório, registrado em `movimentacao` (tipo `ajuste`). O ajuste não pode deixar `total < reservada + em_uso`.
- RF-10: Catálogo (todos os usuários ativos) com busca por nome e filtros por tipo, local, operante e disponibilidade. Itens **desativados** não aparecem para quem não é admin; o admin os vê com o filtro "incluir desativados".
- RF-11: O catálogo exibe a quantidade **disponível** (`total − reservada − em_uso`); itens inoperantes aparecem sinalizados e sem opção de solicitar.
- RF-12: Alerta de estoque mínimo: para itens com `estoque_minimo` definido, sinalizar quando `total − reservada <= estoque_minimo`. Exibido no painel e no relatório de estoque mínimo do admin (spec-007/RF-02, RF-05 a RF-08).
- RF-13: Detalhe do item mostra aba "Histórico" (auditoria) apenas para admin (spec-006/RF-13).
- RF-14: `operante` não muda pelo formulário comum do item; só pelas ações "Marcar inoperante" (motivo opcional) e "Reativar" (**motivo obrigatório**), exclusivas de admin ativo. Ambas são auditadas com o motivo.

## Regras de negócio
- RN-01: Somente `admin` ativo escreve em `item`, `tipo_item` e `local`; usuários ativos leem.
- RN-02: Alterações em item, tipo e local são auditadas (P-06). Mudanças apenas nos contadores `reservada` e `em_uso` não geram linha de auditoria (já estão em `movimentacao`).
- RN-03: Um item **ativo** sempre tem tipo e local ativos. Cadastrar, editar ou reativar item com tipo ou local desativado é rejeitado; desativar tipo ou local que ainda tem itens ativos é rejeitado, informando quantos itens precisam ser movidos ou desativados antes.
- RN-04: O atributo `consumivel` de um tipo só pode mudar enquanto nenhum item (ativo ou desativado) usar o tipo. Ele decide se a retirada baixa o total ou exige devolução (spec-005).
- RN-05: As regras RN-03 e RN-04 valem também sob concorrência (ex.: cadastrar item num local enquanto outro admin o desativa).

## Critérios de aceite
CA-01  Dado um admin
       Quando cadastra um item com número de patrimônio e quantidade 5
       Então o cadastro é rejeitado (patrimônio exige quantidade 1).

CA-02  Dado um item com patrimônio "1234"
       Quando outro item é cadastrado com o mesmo patrimônio
       Então o cadastro é rejeitado por duplicidade.

CA-03  Dado 10 chaves de fenda sem patrimônio
       Quando cadastradas como um único item
       Então `quantidade_total = 10` e o item aparece com 10 disponíveis.

CA-04  Dado um item com reservada 3 e em_uso 2
       Quando o admin tenta ajustar `quantidade_total` para 4
       Então o ajuste é rejeitado (total menor que reservada + em_uso).

CA-05  Dado um item marcado como inoperante
       Quando um professor visualiza o catálogo
       Então o item aparece sinalizado e não pode ser adicionado ao carrinho.

CA-06  Dado um solicitante ativo
       Quando tenta criar, editar ou excluir um item (inclusive via API direta)
       Então a operação é negada por RLS.

CA-07  Dado um item editado pelo admin (ex.: mudou de local)
       Então a auditoria registra usuário, data, valores antes e depois.

CA-08  Dado um item com movimentações
       Quando o admin tenta excluí-lo
       Então a exclusão é negada e é oferecida a opção de desativar.

CA-09  Dado um insumo com estoque mínimo 5 e disponível 5
       Então o item aparece na lista de "abaixo do mínimo".

CA-10  Dado um item desativado
       Quando um professor consulta o catálogo (inclusive via API direta)
       Então o item não aparece; para o admin, aparece com o filtro "incluir desativados".

CA-11  Dado um item inoperante
       Quando o admin tenta reativá-lo sem motivo
       Então a operação é rejeitada; com motivo, o item volta a `operante = true` e a auditoria registra o motivo.

CA-12  Dado um local desativado
       Quando o admin cadastra um item nele, move um item para ele ou reativa um item que está nele
       Então a operação é rejeitada ("Local desativado"); o mesmo vale para tipo desativado.

CA-13  Dado um local com 3 itens ativos
       Quando o admin tenta desativá-lo
       Então a operação é rejeitada informando os 3 itens; depois de movê-los ou desativá-los, a desativação é aceita.
       O mesmo vale para tipo de item.

CA-14  Dado o tipo "Ferramenta" com ao menos um item
       Quando o admin tenta torná-lo consumível
       Então a operação é rejeitada; um tipo sem itens pode mudar.

## Fora de escopo
Importação em lote por planilha, fotos dos itens, QR code/etiquetas.

## Pontos em aberto
- **OPEN-01 (resolvido em 2026-10-19):** `estado` é lista fechada (`novo`, `bom`, `regular`, `ruim`). Refletido em RF-05.
- **OPEN-02 (resolvido em 2026-10-19):** Importação por CSV fica fora da v1, coerente com "Fora de escopo".
- **OPEN-03 (resolvido em 2026-10-19):** Itens desativados somem do catálogo para não-admin; admin vê com filtro. Inoperantes continuam visíveis e sinalizados. Refletido em RF-10 e CA-10.
- **OPEN-04 (resolvido em 2026-10-23):** Item não pode ser cadastrado, movido ou reativado em tipo/local desativado. Refletido em RN-03 e CA-12.
- **OPEN-05 (resolvido em 2026-10-23):** Desativar tipo/local com itens ativos é bloqueado até mover ou desativar os itens. Refletido em RN-03 e CA-13.
- **OPEN-06 (resolvido em 2026-10-23):** `consumivel` só muda em tipo sem itens. Refletido em RN-04 e CA-14.
- Reativação de inoperante com motivo obrigatório (decisão de spec-005/OPEN-03) refletida em RF-14 e CA-11.
