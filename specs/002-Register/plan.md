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
- `numero_patrimonio`: `trim`, vazio vira `null` (trigger); índice único parcial `item_numero_patrimonio_key`.

### Regras entre item, tipo e local (RN-03 a RN-05, CA-12 a CA-14)

- Trigger `before insert or update` em `item` (`validar_item`): quando o item fica ativo (insert, troca de `tipo_id`/`local_id` ou reativação), lê tipo e local com **`for share`** e rejeita se algum estiver desativado ("Tipo desativado." / "Local desativado."). Também é onde se checam patrimônio = 1 no insert e `estoque_minimo` só para consumível.
- Trigger `before update` em `tipo_item` e `local`: desativar com itens ativos → "Há N itens ativos neste local. Mova ou desative esses itens antes." (`detail` com a lista); em `tipo_item`, mudar `consumivel` com qualquer item → "Este tipo já tem itens; não é possível mudar se é consumível."
- Concorrência (RN-05): o `before update` só roda com a linha do tipo/local travada, e o `for share` do item espera esse lock (e vice-versa). Assim, "cadastrar item no local X" e "desativar X" se serializam e o segundo vê o primeiro já confirmado. Teste em `supabase/tests/concorrencia/002_catalogo.test.ts`.
- Com essa invariante, item ativo implica tipo e local ativos: a visibilidade para não-admin depende só de `item.ativo`.

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

- RLS em `tipo_item`, `local`, `item`: `select` para `eh_admin_ativo()` ou (`usuario_ativo()` e `ativo`) — desativados ficam invisíveis para não-admin também pela API direta (CA-10); `insert/update/delete` só `eh_admin_ativo()`.
  - Atenção para a spec 003: o histórico de solicitações do professor não pode depender de ler `item` desativado (guardar o nome na linha da solicitação ou expor por view/RPC própria).
- CRUD de cadastro é **direto pela API** (não precisa de RPC: não mexe em estoque), mas:
  - `revoke insert (quantidade_reservada, quantidade_em_uso, operante)` e `revoke update (quantidade_total, quantidade_reservada, quantidade_em_uso, operante)` de `authenticated` (P-01, RF-06, RF-14);
  - `quantidade_total` entra só no `insert` (CA-03); depois só por `ajustar_quantidade_item`.
- Exclusão de item com movimentação ou de tipo/local em uso falha com `23503`; o front mostra "Possui histórico — desative" e oferece desativar (CA-08).
- Como o CRUD é direto, violações de unicidade chegam como `23505`. `erroRpc.ts` (já existe, spec 001) ganha um mapa por nome de constraint: `tipo_item_nome_key` → "Já existe um tipo com este nome.", `local_nome_key` → "Já existe um local com este nome.", `item_numero_patrimonio_key` → "Número de patrimônio já cadastrado." (CA-02).

## RPCs

- `ajustar_quantidade_item(item_id, nova_quantidade, motivo)` — admin ativo; `select … for update` no item; rejeita se `nova < reservada + em_uso` ("Quantidade menor que o reservado + em uso", CA-04) ou se patrimônio e `nova > 1`; grava `movimentacao` `ajuste` com a diferença e o motivo (RF-09).
- `alterar_operancia_item(item_id, operante, motivo)` — admin ativo; `for update`; motivo obrigatório quando `operante = true` (reativar, CA-11); `set_config('app.motivo', motivo, true)` antes do `update` para o trigger de auditoria gravar o motivo (RF-14). Usado também pela spec 005 (`marcar_inoperante`).

## Auditoria (RN-02, CA-07)

Nova migration faz `create or replace` de `auditar()` (spec 001) acrescentando a regra de origem: com `app.origem = 'movimentacao'` e `campos_alterados` contido em `{quantidade_total, quantidade_reservada, quantidade_em_uso}`, não grava. Em `item`, `tipo_item` e `local` o trigger é ligado sem argumentos (todas as colunas, menos `atualizado_em`).

Esta spec liga o trigger `auditar()` em `item`, `tipo_item` e `local` (spec-006/RF-02). Regras do trigger (spec-006/RF-05, RF-17):
- update que só mexe em contadores/`atualizado_em` **com** `app.origem = 'movimentacao'` não é auditado — é o caso das RPCs das specs 004 e 005;
- `ajustar_quantidade_item` **não** marca a origem, então o ajuste manual é auditado, com `motivo` (spec-006/CA-06);
- `alterar_operancia_item` grava `motivo` via `app.motivo` (spec-006/CA-17).

## Leitura

- View `catalogo` (`security_invoker = true`): item + tipo + local + `disponivel = total − reservada − em_uso`. A visibilidade vem da RLS de `item` (não-admin vê só ativos; ver RN-03); admin vê tudo e o front filtra "incluir desativados" (RF-10, RF-11, CA-10). Inoperante aparece com `operante = false` (CA-05).
- Estoque mínimo (RF-12, CA-09) e o painel ficam na **spec 007** (relatório `estoque_minimo`); aqui só existem os dados (`estoque_minimo`, consumível).
- Aba Histórico (RF-13) é entregue pela **spec 006** (RF-13), que lê `auditoria`.

## Front

- `features/catalogo/`: lista com busca e filtros (tipo, local, operante, disponibilidade), badge "Inoperante", hook público `useCatalogo` exportado pelo `index.ts` da feature — é o único ponto que a spec 003 (carrinho) consome.
- `features/itens-admin/`: formulários Zod de item/tipo/local (patrimônio ⇒ quantidade 1 já no form, conveniência), ajuste de quantidade com motivo, marcar inoperante/reativar. O campo `estoque_minimo` só aparece para tipo consumível (spec-007/RF-08). A aba Histórico vem da feature da spec 006.

## Testes

pgTAP `002_*.test.sql`: CA-01 a CA-08, CA-10 e CA-11 (CA-09 é testado na spec 007, junto com o relatório), sempre com o caminho negado (solicitante, pendente, inativo — CA-06) e tentativas de `update` direto nos contadores e em `operante`. Concorrência entre ajuste e retirada fica na spec 005 (CA-11 de lá).

## Como foi implementado

Migrations (em ordem): `catalogo_tipo_local`, `catalogo_item_movimentacao`, `catalogo_auditoria`, `ajustar_quantidade_item`, `alterar_operancia_item`, `catalogo_view`.

- **Triggers de regra:** `validar_item()` (before insert/update em `item`: patrimônio normalizado e = 1 no cadastro, RN-03 e estoque mínimo só consumível) e `validar_tipo_local()` (before update em `tipo_item`/`local`: CA-13 com a lista dos itens em `detail`, CA-14). Ambas `SECURITY DEFINER`, `search_path` fixo, sem `execute` para `anon`/`authenticated`.
- **RN-05:** `validar_item()` lê tipo e local com `for share`; teste de concorrência em `supabase/tests/concorrencia/002_catalogo.test.ts` (4 casos), **validado por mutação** (sem o `for share`, os 4 falham).
- **Privilégios:** `item` com `grant insert/update` por coluna (contadores e `operante` fora; `quantidade_total` só no insert). Até o admin recebe `42501` ao tentar mudar contadores ou `operante` direto.
- **Ajuste:** `ajustar_quantidade_item` rejeita valor igual ao atual e negativo; patrimônio aceita 0 ou 1. A movimentação guarda a diferença com sinal.
- **Auditoria:** `auditar()` recriada com a regra `app.origem = 'movimentacao'`; os motivos de ajuste e operância são limpos (`app.motivo = ''`) logo depois do `update`, para não vazarem para outras alterações da mesma transação.
- **Front:** `features/catalogo` (pública: `useCatalogo`, `chaveCatalogo`, `podeSolicitar`, `ROTULO_ESTADO`, tipo `ItemCatalogo`) e `features/itens-admin` (Itens, Tipos, Locais). O catálogo é a página inicial; o admin usa a mesma view para a lista de itens. Exclusão que falha por histórico (`23503`) troca o diálogo para "Desativar" (CA-08). `erroRpc` traduz `23505` por constraint.
- **Testes:** pgTAP `002_tipo_local` (37), `002_item` (72), `002_ajuste` (24), `002_operancia` (20), `002_auditoria` (16), `002_catalogo` (13); Vitest do catálogo (9) e das telas de admin (19); verificação manual no navegador (11 passos) e T-20 pela API REST com tokens reais (92 tentativas indevidas, todas negadas).

