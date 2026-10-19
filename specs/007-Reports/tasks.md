# Tarefas — 007 Painel, relatórios e estoque mínimo

Ordem do projeto: **testes → migration/código → rodar testes → atualizar spec/tasks**, banco antes do front.
Marque `[x]` só quando os testes da tarefa passam. Detalhes técnicos em `plan.md`.

Legenda: 🧪 teste primeiro · 🗄️ banco · 🖥️ front · 🔍 validação

**Pré-requisito:** specs 001 a 005 entregues; spec 006 para o atalho "auditoria do item" (RF-12).

---

## Fase 1 — Estoque mínimo (RF-05 a RF-08; spec-002/RF-12)

- [ ] **T-01** 🗄️ `seed.sql` / fixtures de teste: insumos com mínimos variados, ferramentas em uso com vários professores, histórico de retiradas em datas diferentes.
- [ ] **T-02** 🧪 pgTAP `007_estoque_minimo.test.sql`:
  - **CA-01**: mínimo 5, disponível 5 → "No limite" (= **spec-002/CA-09**);
  - **CA-02**: disponível 4 → "Abaixo";
  - **CA-03**: disponível 6 → não aparece;
  - **CA-04**: ferramenta com mínimo → não aparece;
  - **CA-05**: insumo desativado ou sem mínimo → não aparece;
  - ordem por `disponível − mínimo` (RF-07); paginação e `total`.
- [ ] **T-03** 🗄️ Migration `007_relatorios` (parte 1): `relatorio_estoque_minimo(...)` e índices.

## Fase 2 — Com cada professor e itens comigo (RF-09 a RF-11, RF-20)

- [ ] **T-04** 🧪 pgTAP `007_com_professor.test.sql`:
  - **CA-06**: retirou 5, devolveu 3 → pendente 2 (= **spec-005/CA-12**);
  - **CA-07**: solicitação só de insumos → não aparece;
  - **CA-08**: 2 pendentes, 1 com baixa → pendente 1;
  - **CA-09**: agrupamento e totais por professor; filtro por professor;
  - filtros por item, tipo e local; `dias_com_item`;
  - **CA-17**: `itens_comigo()` devolve só as linhas do próprio usuário (inclusive API direta); pendente/inativo → negado.
- [ ] **T-05** 🗄️ `relatorio_itens_com_professor(...)` e `itens_comigo()`.

## Fase 3 — Históricos e ranking (RF-12 a RF-14, RF-17)

- [ ] **T-06** 🧪 pgTAP `007_historicos.test.sql`:
  - **CA-12**: item com retirada, devolução e ajuste → 3 movimentos em ordem, filtro por tipo;
  - histórico por professor com status, decisor e retirada (RF-13);
  - **CA-14**: retirada em 31/10 às 23:30 (Brasília) entra no filtro 01/10–31/10.
- [ ] **T-07** 🗄️ `historico_item(...)` e `historico_professor(...)`.
- [ ] **T-08** 🧪 pgTAP `007_ranking.test.sql` — **CA-13**: soma correta, ordem decrescente, recusadas/canceladas/só aprovadas não contam; padrão últimos 30 dias, 20 primeiros.
- [ ] **T-09** 🗄️ `ranking_itens_retirados(...)`.

## Fase 4 — Painel e acesso (RF-01 a RF-04)

- [ ] **T-10** 🧪 pgTAP `007_painel_acesso.test.sql`:
  - **CA-10**: 3 pendentes, 2 aprovadas (mais antiga há 4 dias) → contagens 3, 2 e 4 dias; cada contagem bate com a lista correspondente;
  - inoperantes e unidades em uso corretos;
  - **CA-11**: solicitante, pendente e inativo chamando cada função de admin → negado;
  - **CA-16** (banco): filtro sem resultados → zero linhas, `total = 0`.
- [ ] **T-11** 🗄️ `painel_admin()`.
- [ ] **T-12** 🔍 `supabase db reset` + `supabase test db`; revisão de grants (`grant execute` só para `authenticated`); todas as funções de relatório são `stable` e não escrevem nada (RF-19); `npm run db:types`.

## Fase 5 — Front

- [ ] **T-13** 🖥️ **RF-15, RF-16, CA-15, CA-16**: `web/src/shared/lib/csv.ts` (BOM, `;`, escape de aspas e quebras de linha, datas `dd/mm/aaaa HH:mm` em `America/Sao_Paulo`) e `exportarCompleto` (páginas de 1000 até o `total`). Testes Vitest: 2.500 linhas mockadas → 3 chamadas e 2.500 linhas no arquivo; zero linhas → só cabeçalho.
- [ ] **T-14** 🖥️ **RF-02 a RF-04**: `features/painel/` como página inicial do admin, 5 cards com link para a lista filtrada (filtros na URL).
- [ ] **T-15** 🖥️ **RF-06, RF-09, RF-10, RF-12 a RF-14, RF-18**: `features/relatorios/` — telas com filtros na URL, paginação no servidor, estado vazio "Nenhum item encontrado", botão "Exportar CSV"; atalho do histórico do item para o `HistoricoAuditoria` (spec 006).
- [ ] **T-16** 🖥️ **RF-20**: "Itens comigo" no menu do professor.

## Fase 6 — Fechamento

- [ ] **T-17** 🔍 Teste manual com token de solicitante chamando as funções de relatório pela API REST (CA-11) e `itens_comigo()` (CA-17).
- [ ] **T-18** 🔍 Abrir um CSV exportado no Excel/LibreOffice em pt-BR e conferir acentos e colunas (CA-15).
- [ ] **T-19** 🔍 CI verde.
- [ ] **T-20** 📝 Atualizar `spec.md`/`plan.md` (e marcar spec-002/RF-12 e spec-005/RF-14, RF-15 como entregues) e abrir PR `spec-007-relatorios`.

---

## Cobertura de critérios de aceite

| CA | Tarefa de teste |
|---|---|
| CA-01 | T-02 |
| CA-02 | T-02 |
| CA-03 | T-02 |
| CA-04 | T-02 |
| CA-05 | T-02 |
| CA-06 | T-04 |
| CA-07 | T-04 |
| CA-08 | T-04 |
| CA-09 | T-04 |
| CA-10 | T-10 |
| CA-11 | T-10, T-17 |
| CA-12 | T-06 |
| CA-13 | T-08 |
| CA-14 | T-06 |
| CA-15 | T-13, T-18 |
| CA-16 | T-10, T-13 |
| CA-17 | T-04, T-17 |
| spec-002/CA-09 | T-02 |
| spec-005/CA-12 | T-04 |
