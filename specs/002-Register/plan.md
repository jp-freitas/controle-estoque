# Plano — 002 Cadastro de itens, tipos e locais

Decisões técnicas ("como") da spec 002. O comportamento está em `spec.md`. Convenções transversais (erros, bloqueio, concorrência, auditoria) estão no `CLAUDE.md` → Banco.

Depende da spec 001: `eh_admin_ativo()`, `usuario_ativo()`, tabela `auditoria` e trigger `auditar()` (modelo definido pela spec 006, implementado na 001).

## Dados

Migration `002_catalogo`.

### `tipo_item`
| Coluna | Tipo | Observação |
|---|---|---|
| `id` | `uuid` PK | |
| `nome` | `citext` unique | |
| `consumivel` | `boolean` not null | RF-02 |
| `ativo` | `boolean` default `true` | RF-03 (desativar em vez de excluir) |

Insumo (consumível), Ferramenta e Máquina são inseridos **na própria migration** (RF-01), porque produção também precisa deles; não no `seed.sql`.

### `local`
`id`, `nome citext unique` (RF-04), `descricao text null`, `ativo boolean default true`.

### `item`
| Coluna | Tipo | Observação |
|---|---|---|
| `id` | `uuid` PK | |
| `nome` | `text` not null | |
| `tipo_id` | FK `tipo_item` `on delete restrict` | RF-03 (tipo em uso não é excluído) |
| `local_id` | FK `local` `on delete restrict` | |
| `quantidade_total` | `int` not null `check (>= 0)` | |
| `quantidade_reservada` | `int` not null default 0 `check (>= 0)` | só RPC |
| `quantidade_em_uso` | `int` not null default 0 `check (>= 0)` | só RPC |
| `operante` | `boolean` default `true` | só RPC (RF-14) |
| `estado` | enum `estado_item` (`novo`,`bom`,`regular`,`ruim`) null | RF-05 / OPEN-01 |
| `numero_patrimonio` | `text` null | único parcial `where not null` (CA-02) |
| `descricao` | `text` null | |
| `estoque_minimo` | `int` null `check (>= 0)` | |
| `ativo` | `boolean` default `true` | RF-08 |
| `criado_em`, `atualizado_em` | `timestamptz` | |

Constraints:
- **P-03:** `check (quantidade_reservada + quantidade_em_uso <= quantidade_total)`.
- **RF-07:** `check (numero_patrimonio is null or quantidade_total <= 1)`; o "= 1 no cadastro" é um trigger `before insert` (CA-01), porque depois da baixa (spec-005) o total pode ir a 0.
- `estoque_minimo` só para tipo consumível: trigger `before insert or update` consulta `tipo_item.consumivel`.
- Índices em `tipo_id`, `local_id` e `nome` (busca com `ilike`; `pg_trgm` se ficar lento).

### `movimentacao` (P-05)
Criada aqui porque o ajuste (RF-09) é a primeira movimentação; 004 e 005 reutilizam.

| Coluna | Tipo |
|---|---|
| `id` | `bigint` identity PK |
| `item_id` | FK `item` `on delete restrict` (item com histórico não é excluído — RF-08, CA-08) |
| `solicitacao_id` | `uuid` null (FK adicionada pela spec 003) |
| `tipo` | enum `tipo_movimentacao`: `ajuste`, `reserva`, `liberacao_reserva`, `retirada`, `devolucao` |
| `quantidade` | `int` not null — com sinal: efeito em `quantidade_total` no ajuste; positiva nos demais tipos |
| `motivo` | `text` null (obrigatório em `ajuste`, por `check`) |
| `usuario_id` | FK `profiles` |
| `criado_em` | `timestamptz` default `now()` |

Imutável: sem `grant update/delete` para ninguém; `select` só para admin ativo. Índices em `item_id`, `solicitacao_id`, `criado_em`.

## Permissões e escrita (RN-01, CA-06)

- RLS em `tipo_item`, `local`, `item`: `select` para `usuario_ativo()`; `insert/update/delete` só `eh_admin_ativo()`.
- CRUD de cadastro é **direto pela API** (não precisa de RPC: não mexe em estoque), mas:
  - `revoke insert (quantidade_reservada, quantidade_em_uso, operante)` e `revoke update (quantidade_total, quantidade_reservada, quantidade_em_uso, operante)` de `authenticated` (P-01, RF-06, RF-14);
  - `quantidade_total` entra só no `insert` (CA-03); depois só por `ajustar_quantidade_item`.
- Exclusão de item com movimentação ou de tipo/local em uso falha com `23503`; o front mostra "Possui histórico — desative" e oferece desativar (CA-08).

## RPCs

- `ajustar_quantidade_item(item_id, nova_quantidade, motivo)` — admin ativo; `select … for update` no item; rejeita se `nova < reservada + em_uso` ("Quantidade menor que o reservado + em uso", CA-04) ou se patrimônio e `nova > 1`; grava `movimentacao` `ajuste` com a diferença e o motivo (RF-09).
- `alterar_operancia_item(item_id, operante, motivo)` — admin ativo; `for update`; motivo obrigatório quando `operante = true` (reativar, CA-11); `set_config('app.motivo', motivo, true)` antes do `update` para o trigger de auditoria gravar o motivo (RF-14). Usado também pela spec 005 (`marcar_inoperante`).

## Auditoria (RN-02, CA-07)

Esta spec liga o trigger `auditar()` em `item`, `tipo_item` e `local` (spec-006/RF-02). Regras do trigger (spec-006/RF-05, RF-17):
- update que só mexe em contadores/`atualizado_em` **com** `app.origem = 'movimentacao'` não é auditado — é o caso das RPCs das specs 004 e 005;
- `ajustar_quantidade_item` **não** marca a origem, então o ajuste manual é auditado, com `motivo` (spec-006/CA-06);
- `alterar_operancia_item` grava `motivo` via `app.motivo` (spec-006/CA-17).

## Leitura

- View `catalogo` (`security_invoker = true`): item + tipo + local + `disponivel = total − reservada − em_uso`. Não-admin vê só `item.ativo` (e tipo/local ativos); admin vê tudo e o front filtra "incluir desativados" (RF-10, RF-11, CA-10). Inoperante aparece com `operante = false` (CA-05).
- Estoque mínimo (RF-12, CA-09) e o painel ficam na **spec 007** (relatório `estoque_minimo`); aqui só existem os dados (`estoque_minimo`, consumível).
- Aba Histórico (RF-13) é entregue pela **spec 006** (RF-13), que lê `auditoria`.

## Front

- `features/catalogo/`: lista com busca e filtros (tipo, local, operante, disponibilidade), badge "Inoperante", hook público `useCatalogo` exportado pelo `index.ts` da feature — é o único ponto que a spec 003 (carrinho) consome.
- `features/itens-admin/`: formulários Zod de item/tipo/local (patrimônio ⇒ quantidade 1 já no form, conveniência), ajuste de quantidade com motivo, marcar inoperante/reativar. O campo `estoque_minimo` só aparece para tipo consumível (spec-007/RF-08). A aba Histórico vem da feature da spec 006.

## Testes

pgTAP `002_*.test.sql`: CA-01 a CA-08, CA-10 e CA-11 (CA-09 é testado na spec 007, junto com o relatório), sempre com o caminho negado (solicitante, pendente, inativo — CA-06) e tentativas de `update` direto nos contadores e em `operante`. Concorrência entre ajuste e retirada fica na spec 005 (CA-11 de lá).
