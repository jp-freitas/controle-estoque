# Plano — 003 Solicitação de retirada com carrinho

Decisões técnicas ("como") da spec 003. Convenções transversais no `CLAUDE.md` → Banco.

Depende de: 001 (`usuario_ativo()`, `eh_admin_ativo()`), 002 (`item`, view `catalogo`, `movimentacao`).

## Dados

Migration `003_solicitacao`.

- Enum `status_solicitacao`: `pendente`, `aprovada`, `retirada`, `concluida`, `cancelada`, `recusada` (constituição §5).
- `solicitacao`:
  | Coluna | Tipo | Observação |
  |---|---|---|
  | `id` | `uuid` PK | |
  | `solicitante_id` | FK `profiles` | sempre `auth.uid()` (RF-01) |
  | `status` | `status_solicitacao` default `pendente` | |
  | `justificativa` | `text` not null, `check (char_length(trim(justificativa)) between 3 and 500)` | RF-06, CA-04 |
  | `criado_em` | `timestamptz` default `now()` | |
  | `cancelado_em` | `timestamptz` null | |
- `solicitacao_item`: `id`, `solicitacao_id` FK `on delete restrict`, `item_id` FK, `item_nome text not null`, `quantidade_solicitada int check (>= 1)`, `unique (solicitacao_id, item_id)` (RF-03).
  - `item_nome` é uma **cópia do nome no envio**: o professor não lê `item` desativado (spec-002/CA-10), então o histórico dele (RF-08) não pode depender do join com `item`. Mostra o nome que o item tinha quando foi pedido.
- Adiciona a FK `movimentacao.solicitacao_id → solicitacao`.
- Índices: `solicitacao(solicitante_id, criado_em)`, `solicitacao(status, criado_em)` (fila da 004), `solicitacao_item(solicitacao_id)`, `solicitacao_item(item_id)`.
- As colunas de decisão (004) e de retirada/devolução (005) são acrescentadas pelas migrations dessas specs.

## RLS (RF-10, CA-07, CA-08)

- `solicitacao`: `select` se `solicitante_id = auth.uid() and usuario_ativo()` ou `eh_admin_ativo()`. Sem `insert/update/delete` direto — só RPC.
- `solicitacao_item`: `select` via `exists` na `solicitacao` visível.
- RF-11 (não editável) sai de graça: não há `update` permitido.

## RPCs

- `enviar_solicitacao(itens jsonb, justificativa text) returns uuid` — `SECURITY DEFINER` (RF-05):
  1. `usuario_ativo()` senão "Seu acesso não permite enviar solicitações" (CA-08);
  2. valida formato: lista não vazia, `quantidade >= 1`, sem item repetido (RF-03);
  3. para **cada** item, acumula falhas em um array: não existe/desativado, inoperante (CA-03), `disponivel < quantidade` (CA-02) — mensagem geral "Alguns itens não podem ser solicitados." e o motivo por item no `detail`;
  4. se houver falha, `raise` com `detail` = `[{"item_id", "nome", "motivo"}]` e nada é gravado (RF-07);
  5. insere `solicitacao` + linhas. **Não** toca contadores e **não** usa `FOR UPDATE` (RN-01: é pré-validação; a garantia é na aprovação).
- `cancelar_solicitacao(id)` — dono, `usuario_ativo()`, `select … for update` na solicitação, só se `pendente` → `cancelada`, `cancelado_em = now()` (RF-09, CA-05). Em `aprovada`: "Solicitação já aprovada; peça ao administrador para cancelar." (CA-06); `retirada`/`concluida`, `cancelada` e `recusada` têm mensagem própria. Só o dono: de outro usuário (inclusive admin) → "Solicitação não encontrada." (o admin cancela pela RPC da spec 004).

## Front

- `features/carrinho/` — o carrinho só existe no front; nada vai ao banco antes do envio (RF-02):
  - estado em Context + `useReducer` (`adicionar`, `alterarQuantidade`, `remover`, `limpar`);
  - persistência em `localStorage` com chave `estoque:carrinho:<user_id>` (carrinho não vaza entre usuários no mesmo navegador), leitura/escrita em `try/catch`;
  - ao carregar, revalida cada linha contra `useCatalogo` (spec 002): remove itens desativados ou sem disponível, marca inoperantes (o envio fica bloqueado até removê-los) e reduz quantidade acima do disponível, avisando o usuário (CA-09, RF-04);
  - o botão "Adicionar ao carrinho" fica no catálogo: `CatalogoPage` recebe uma prop `acaoItem` e o `app/router` compõe com o componente do carrinho, sem a feature catalogo importar carrinho; só aparece quando `podeSolicitar(item)` (CA-05).
  - schema Zod do envio (justificativa obrigatória, quantidades ≥ 1).
- `features/solicitacoes/`: "Minhas solicitações" (status, data, itens — RF-08), detalhe, cancelar; erros por item do `detail` mostrados na linha correspondente do carrinho.

## Testes

- pgTAP `003_*.test.sql`: CA-01 a CA-08 (CA-01 confere que nenhum contador mudou; CA-07 com dois solicitantes; CA-08 com pendente e inativo).
- Vitest: reducer e persistência/revalidação do carrinho (CA-09).

## Como foi implementado

Migrations: `solicitacao`, `enviar_solicitacao`, `cancelar_solicitacao`.

- **`enviar_solicitacao`:** lê a lista com `jsonb_to_record` e trata só erros de dados (classe 22) como "Lista de itens inválida." — um `when others` escondeu um bug na primeira versão. Item desativado ou inexistente vem no `detail` com `nome: null`, para não revelar o nome a quem não o vê.
- **`cancelar_solicitacao`:** `for update` na solicitação do próprio usuário (prepara a concorrência com a aprovação da spec 004).
- **Front:**
  - `features/carrinho`: regras puras em `hooks/carrinho.ts` (`aplicar`, `revalidar`, `lerCarrinho`/`salvarCarrinho`). O provider guarda as linhas salvas e **deriva** as conferidas com `useMemo` a cada mudança do catálogo (sem efeito que mexa em estado); o que vai para o `localStorage` já é a versão conferida, para o aviso não se repetir a cada recarga. O provider fica no `RootLayout` (o menu mostra "Carrinho (n)"), com `key` por usuário.
  - Erro de envio invalida o catálogo: o carrinho é reconferido e o motivo de cada item recusado aparece na linha ("Recusado: Disponível: 3.").
  - `features/solicitacoes`: "Minhas solicitações" filtra por `solicitante_id` (o admin vê todas pela RLS). Decisão, motivo de recusa e quantidades aprovadas (RF-08) entram com as colunas da spec 004.
  - `CatalogoPage` ganhou a prop `acaoItem`; `app/router` põe o `AdicionarAoCarrinho`.
- **Testes:** pgTAP `003_solicitacao_schema` (20), `003_solicitacao_rls` (17), `003_enviar` (30), `003_cancelar` (14); Vitest do carrinho (9) e do fluxo pelas rotas reais (11); verificação no navegador (8 passos, inclusive o admin reduzindo o estoque com o item no carrinho do professor) e T-13 pela API REST (44 tentativas indevidas, todas negadas).

