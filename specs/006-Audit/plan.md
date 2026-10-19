# Plano — 006 Auditoria de alterações

Decisões técnicas ("como") da spec 006. Convenções transversais no `CLAUDE.md` → Banco.

## Divisão da entrega entre specs

A auditoria é base para outras specs, então o **registro** (RF-01 a RF-12, RF-17) não espera por esta PR:

| Parte | Onde é implementada |
|---|---|
| Tabela `auditoria`, bloqueios (RF-10 a RF-12), trigger `auditar()`, auditoria de `profiles` | spec 001 — `specs/001-Auth/plan.md` → Auditoria, tarefas T-03 a T-05 |
| Trigger em `item`, `tipo_item`, `local`; `app.origem`/`app.motivo` nas RPCs | spec 002 (e 004/005 marcam `app.origem`) |
| **Consulta** (RF-13 a RF-16) e a bateria completa de CA desta spec | **esta spec** |

Ordem natural: 001 → 002 → … → 006. Esta PR entra depois da 002 (precisa de `item`, `local`, `tipo_item`) e, de preferência, depois da 005 (para cobrir CA-04 e CA-16 com as RPCs reais).

## Registro (resumo do que esta spec exige do trigger)

Detalhes no plano da 001. Pontos que os testes desta spec verificam:
- `campos_alterados` calculado comparando `to_jsonb(old)` e `to_jsonb(new)`, só nas colunas auditáveis da tabela; vazio → não grava (RF-07, CA-05, CA-08).
- Em `item`: update só de `quantidade_total`/`reservada`/`em_uso`/`atualizado_em` com `app.origem = 'movimentacao'` → não grava (RF-05, CA-04, CA-16); sem a marca (ajuste manual) → grava (CA-06).
- `motivo` lido de `app.motivo` (RF-17, CA-17).
- `usuario_id = auth.uid()`, nulo fora de sessão autenticada → "Sistema" (RF-04, CA-09).

## Consulta (RF-13 a RF-16)

### Banco
- Função `consultar_auditoria(p_tabela text, p_acao text, p_usuario_id uuid, p_de date, p_ate date, p_registro_id uuid, p_limite int default 50, p_offset int default 0)`:
  - `SECURITY INVOKER` + `if not eh_admin_ativo() then raise` (RF-01 de leitura; a RLS já restringe, a checagem dá mensagem clara);
  - devolve registro + `usuario_nome` (`coalesce(profiles.nome, 'Sistema')`) + `total` via `count(*) over ()` para paginação no servidor (RF-15, CA-15);
  - período no fuso `America/Sao_Paulo`, dia final inteiro: `criado_em >= (p_de::timestamp at time zone 'America/Sao_Paulo') and criado_em < ((p_ate + 1)::timestamp at time zone 'America/Sao_Paulo')`;
  - ordem `criado_em desc` (RF-13).
- Função `auditoria_diferencas(p_auditoria_id bigint)` → linhas `(campo, antes, depois)` com **nomes legíveis** para chaves estrangeiras: `local_id` → `local.nome`, `tipo_id` → `tipo_item.nome` (inclui desativados, que continuam existindo) (RF-13, CA-14).
- Índices já previstos na 001: `(tabela, registro_id, criado_em desc)`, `usuario_id`, `criado_em`.

### Front — `features/auditoria/`
- `api/`: chamadas às duas funções; `hooks/`: `useHistorico(tabela, registroId)` e `useAuditoria(filtros, pagina)`.
- Rótulos legíveis dos campos ("Local", "Quantidade total", "Operante"…) num mapa em `features/auditoria/rotulos.ts`; o banco resolve os **valores**, o front só traduz o **nome do campo**.
- Componente público `HistoricoAuditoria` (exportado pelo `index.ts`), usado nas telas de detalhe de item, tipo, local e usuário (RF-13, RF-14; spec-002/RF-13). Formato "Rótulo: antes → depois"; datas com `Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo' })`.
- Tela **Auditoria** (admin) com filtros tabela, ação, usuário, período e registro, paginação no servidor (RF-15).

## Testes

pgTAP `006_*.test.sql`, CA-01 a CA-17:
- CA-09: rodar como `postgres` sem claims JWT → `usuario_id` nulo.
- CA-10, CA-11: `set local role authenticated` + claims de solicitante → `select` vazio; `insert/update/delete` negados.
- CA-12: `set local role service_role` → `update`/`delete` em `auditoria` rejeitados pelo trigger.
- CA-13 (falha forçada): dentro do teste, acrescentar à `auditoria` um `check` que sempre falha, alterar um item e conferir que o erro sobe e o item **não** mudou (a transação de teste é desfeita no fim).
- CA-04 e CA-16: chamar as RPCs reais de aprovação e retirada (specs 004/005) e conferir zero linhas novas de auditoria e a `movimentacao` presente.
- Vitest: formatação "antes → depois" e rótulos do `HistoricoAuditoria`.
