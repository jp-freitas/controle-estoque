# Plano — 007 Painel, relatórios e estoque mínimo

Decisões técnicas ("como") da spec 007. Convenções transversais no `CLAUDE.md` → Banco.

Depende de: 002 (`item`, `estoque_minimo`, `movimentacao`), 003/004/005 (`solicitacao`, `solicitacao_item` com `quantidade_aprovada`, `quantidade_devolvida`, `quantidade_baixada`, `data_retirada`), 004 (view `aprovadas_aguardando_retirada`). Entrega também spec-002/RF-12 (CA-09) e spec-005/RF-14, RF-15 (CA-12).

## Abordagem

Todos os números vêm do banco (RN-03). Em vez de views soltas, **funções de relatório** em SQL (`stable`, `SECURITY INVOKER`, só leitura — RF-19):
- começam com `if not eh_admin_ativo() then raise …` (RF-01, CA-11) — a RLS das tabelas já impede o vazamento; a checagem dá erro claro e evita que um solicitante receba "só os próprios" por acidente;
- recebem filtros e `p_limite`/`p_offset`; devolvem as linhas + `total` via `count(*) over ()` (RF-18);
- ordenação estável (sempre com desempate por `id`), para a paginação e a exportação não repetirem nem pularem linhas.

Período (RF-17, CA-14): parâmetros `p_de date, p_ate date`, convertidos uma vez:
`ts >= (p_de::timestamp at time zone 'America/Sao_Paulo') and ts < ((p_ate + 1)::timestamp at time zone 'America/Sao_Paulo')`.

## Funções

| Função | RF / CA | Observações |
|---|---|---|
| `painel_admin()` → `jsonb` | RF-02 a RF-04, CA-10 | Contagens: pendentes; aprovadas aguardando + `max(dias_aguardando)` (view da 004); abaixo do mínimo; inoperantes ativos; soma de `em_uso` de não consumíveis |
| `relatorio_estoque_minimo(p_local_id, p_limite, p_offset)` | RF-05 a RF-08, CA-01 a CA-05; spec-002/CA-09 | Só item ativo, tipo consumível, `estoque_minimo` não nulo, `total − reservada <= estoque_minimo`; `situacao` = `Abaixo` / `No limite`; ordem `disponivel − estoque_minimo` asc |
| `relatorio_itens_com_professor(p_professor_id, p_item_id, p_tipo_id, p_local_id, p_limite, p_offset)` | RF-09 a RF-11, CA-06 a CA-09; spec-005/CA-12 | Linhas não consumíveis de solicitações `retirada` com `pendente = aprovada − devolvida − baixada > 0`; `dias_com_item = current_date − data_retirada` (local); totais por professor via `sum(...) over (partition by solicitante_id)` |
| `itens_comigo()` | RF-20, CA-17 | Mesma consulta, **sem** checagem de admin, filtrada por `solicitante_id = auth.uid()` e `usuario_ativo()` |
| `historico_item(p_item_id, p_de, p_ate, p_tipo, p_limite, p_offset)` | RF-12, CA-12 | `movimentacao` + usuário + solicitação; atalho para a auditoria do item (componente da spec 006) |
| `historico_professor(p_professor_id, p_de, p_ate, p_status, p_limite, p_offset)` | RF-13 | Solicitações do professor com decisor, retirada e itens; movimentações vinculadas |
| `ranking_itens_retirados(p_de default current_date − 30, p_ate default current_date, p_tipo_id, p_local_id, p_limite default 20)` | RF-14, CA-13 | Soma `quantidade_aprovada` de solicitações `retirada`/`concluida` por `data_retirada` + contagem de solicitações; padrão 30 dias (OPEN-03) |

Índices extras (migration `007_relatorios`): `solicitacao(data_retirada)`, `movimentacao(item_id, criado_em)`, `solicitacao(solicitante_id, status)`. Nenhuma tabela nova.

## Exportação CSV (RF-15, RF-16, CA-15, CA-16)

Sem servidor fora do Postgres (I-01), o CSV é montado **no navegador**:
- `web/src/shared/lib/csv.ts`: recebe colunas (cabeçalho em português + formatador) e linhas; gera UTF-8 com BOM (`﻿`), separador `;`, aspas duplas escapadas, datas `dd/mm/aaaa HH:mm` em `America/Sao_Paulo`, `\r\n` entre linhas.
- `exportarCompleto(fn, filtros)`: chama a função de relatório em páginas de 1000 (`max_rows` do PostgREST) até atingir `total`, então baixa o arquivo — exporta o conjunto completo, não a página atual (CA-15: 2.500 linhas = 3 chamadas). Sem resultados → só o cabeçalho (CA-16).

## Front

- `features/painel/`: página inicial do admin com os 5 cards; cada card navega para a lista com o filtro na URL (RF-03): fila (spec 004), estoque mínimo, catálogo com `operante=false` (spec 002), com cada professor.
- `features/relatorios/`: estoque mínimo, com cada professor, histórico por item, histórico por professor, ranking; filtros na URL (`useSearchParams`), paginação no servidor, estado vazio "Nenhum item encontrado" (RF-18), botão "Exportar CSV".
- "Itens comigo" no menu do professor (RF-20).
- Alerta de estoque mínimo só no painel, sem e-mail (OPEN-05).

## Testes

- pgTAP `007_*.test.sql`: CA-01 a CA-14, CA-16 (lado banco: zero linhas), CA-17; spec-002/CA-09; spec-005/CA-12. Caminho negado: solicitante, pendente e inativo chamando cada função de admin (CA-11).
- CA-14 com `data_retirada = '2026-10-31 23:30-03'` e filtro 01/10–31/10.
- Vitest: `csv.ts` (BOM, `;`, escape de aspas e quebras de linha, acentos), `exportarCompleto` com mock de 2.500 linhas (CA-15) e com zero linhas (CA-16).
