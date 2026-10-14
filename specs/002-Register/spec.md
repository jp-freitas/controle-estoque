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
| `estado` | Não | Ex.: novo, bom, desgastado |
| `numero_patrimonio` | Não | Único quando preenchido |
| `descricao` | Não | |
| `estoque_minimo` | Não | Só faz sentido para insumos |

- RF-06: Contadores `quantidade_reservada` e `quantidade_em_uso` não são editáveis pelo formulário; só mudam via funções de estoque (constituição P-01).
- RF-07: Item com `numero_patrimonio` exige `quantidade_total = 1`.
- RF-08: Admin pode criar, editar e desativar itens. Item com histórico de movimentação não pode ser excluído, apenas desativado.
- RF-09: Admin ajusta `quantidade_total` por ajuste manual com motivo obrigatório, registrado em `movimentacao` (tipo `ajuste`). O ajuste não pode deixar `total < reservada + em_uso`.
- RF-10: Catálogo (todos os usuários ativos) com busca por nome e filtros por tipo, local, operante e disponibilidade.
- RF-11: O catálogo exibe a quantidade **disponível** (`total − reservada − em_uso`); itens inoperantes aparecem sinalizados e sem opção de solicitar.
- RF-12: Alerta de estoque mínimo: para itens com `estoque_minimo` definido, sinalizar quando `total − reservada <= estoque_minimo`. Exibido no painel do admin (ver spec-007).
- RF-13: Detalhe do item mostra aba "Histórico" (auditoria) apenas para admin.

## Regras de negócio
- RN-01: Somente `admin` ativo escreve em `item`, `tipo_item` e `local`; usuários ativos leem.
- RN-02: Alterações em item, tipo e local são auditadas (P-06). Mudanças apenas nos contadores `reservada` e `em_uso` não geram linha de auditoria (já estão em `movimentacao`).

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

## Fora de escopo
Importação em lote por planilha, fotos dos itens, QR code/etiquetas.

## Pontos em aberto
- **OPEN-01:** Lista fechada de estados (`novo`, `bom`, `regular`, `ruim`) ou texto livre?
- **OPEN-02:** Importação inicial do inventário existente via CSV é desejada já na primeira versão?
- **OPEN-03:** Itens desativados somem do catálogo para professores?
