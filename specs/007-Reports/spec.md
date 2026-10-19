# 007 — Painel, relatórios e estoque mínimo

## Contexto
O administrador precisa enxergar rapidamente o que exige ação (solicitações pendentes, estoque baixo) e consultar quem está com o quê e o histórico de uso. Esta spec reúne o alerta de estoque mínimo (spec-002/RF-12), o relatório "itens com cada professor" (spec-005/RF-14) e os históricos (spec-005/RF-15).

## Histórias
- Como administrador, quero um painel com o que precisa da minha atenção ao abrir o sistema.
- Como administrador, quero saber quais insumos estão acabando para repor a tempo.
- Como administrador, quero saber quais ferramentas e máquinas estão com cada professor.
- Como administrador, quero ver o histórico de um item ou de um professor.
- Como administrador, quero exportar os relatórios para planilha.

## Requisitos funcionais

### Acesso
- RF-01: Painel e relatórios são exclusivos do `admin` ativo, exceto "Itens comigo" (RF-20). As consultas passam por views ou funções do banco que verificam o perfil; esconder o menu não é segurança (P-02).

### Painel do administrador
- RF-02: A página inicial do admin é o **Painel**, com cards: (a) solicitações **pendentes**; (b) solicitações **aprovadas aguardando retirada**, com a idade em dias da mais antiga; (c) itens **abaixo do estoque mínimo**; (d) itens **inoperantes**; (e) **unidades em uso** (ferramentas e máquinas fora do estoque).
- RF-03: Cada card mostra a contagem e leva à lista já filtrada: a fila da spec-004, o relatório de estoque mínimo, o catálogo com filtro "inoperante" (spec-002/RF-10) ou o relatório "com cada professor".
- RF-04: As contagens refletem o estado atual e são atualizadas ao abrir o painel.

### Estoque mínimo
- RF-05: Um item entra em "abaixo do mínimo" quando está ativo, o tipo é **consumível**, `estoque_minimo` não é nulo e `quantidade_total − quantidade_reservada <= estoque_minimo`.
- RF-06: O relatório mostra nome, local, total, reservada, disponível, mínimo e uma situação: **Abaixo** (disponível < mínimo) ou **No limite** (disponível = mínimo).
- RF-07: Ordenação padrão: mais crítico primeiro (menor `disponível − mínimo`).
- RF-08: `estoque_minimo` em itens de tipo não consumível é ignorado pelo relatório, e o formulário de item só exibe o campo para tipos consumíveis.

### Itens com cada professor
- RF-09: Lista, agrupada por professor, as quantidades **ainda pendentes de devolução**: linhas de itens não consumíveis em solicitações `retirada`, com `pendente = aprovada − devolvida − baixada`. Mostra item, quantidade pendente, data da retirada, solicitação de origem e "dias com o item".
- RF-10: Filtros por professor, item, tipo e local; totais por professor.
- RF-11: Nunca lista insumos nem linhas com pendente zero.

### Históricos
- RF-12: **Histórico por item:** movimentações (`movimentacao`) em ordem cronológica, com data, tipo, quantidade, usuário e solicitação vinculada. Filtros por período e tipo de movimento, e atalho para a auditoria do item (spec-006).
- RF-13: **Histórico por professor:** solicitações do professor (data, status, itens, quem decidiu, retirada) e suas movimentações. Filtros por período e status.

### Itens mais retirados
- RF-14: Ranking de itens por quantidade retirada em um período: soma de `quantidade_aprovada` das solicitações que chegaram a `retirada` ou `concluida` (pela `data_retirada`), mais o número de solicitações. Filtros por período, tipo e local; padrão: últimos 30 dias, 20 primeiros.

### Exportação e comportamento geral
- RF-15: Os relatórios RF-06, RF-09, RF-12, RF-13 e RF-14 são exportáveis em **CSV** com os filtros ativos, contendo o **conjunto completo** filtrado, não só a página atual.
- RF-16: Formato do CSV: UTF-8 com BOM, separador `;`, cabeçalhos em português, datas `dd/mm/aaaa HH:mm`, para abrir corretamente no Excel em português.
- RF-17: Filtros de período interpretam datas no fuso `America/Sao_Paulo`, incluindo o dia final inteiro (início 00:00:00 e fim 23:59:59.999 locais).
- RF-18: Listas são paginadas no servidor e têm estado vazio explícito ("Nenhum item encontrado").
- RF-19: Relatórios são somente leitura; nenhuma tela desta spec altera dados.

### Itens comigo (professor)
- RF-20: Todo usuário ativo vê a lista "Itens comigo": o RF-09 restrito às próprias solicitações, sem acesso aos dados de outros usuários.

## Regras de negócio
- RN-01: `disponível = total − reservada − em_uso` (constituição). Para insumos, `em_uso` é sempre 0.
- RN-02: "Dias com o item" é apenas informativo. Não existe prazo, atraso nem alerta de atraso (fora de escopo da versão inicial).
- RN-03: Os números vêm do banco (views ou funções), nunca recalculados no front a partir de listas parciais.
- RN-04: A baixa por perda (spec-005/RF-12) reduz o pendente do RF-09. A baixa é registrada por linha da solicitação, em `quantidade_baixada` (spec-005/RF-12, RF-16).

## Critérios de aceite
CA-01  Dado um insumo com mínimo 5, total 10 e reservada 5 (disponível 5)
       Então aparece no relatório de estoque mínimo como "No limite".

CA-02  Dado um insumo com mínimo 5, total 10 e reservada 6 (disponível 4)
       Então aparece como "Abaixo".

CA-03  Dado um insumo com mínimo 5 e disponível 6
       Então não aparece no relatório.

CA-04  Dado uma ferramenta (não consumível) com `estoque_minimo` preenchido
       Então não aparece no relatório.

CA-05  Dado um insumo desativado, ou sem `estoque_minimo`
       Então não aparece no relatório.

CA-06  Dado um professor que retirou 5 chaves e devolveu 3
       Então "com cada professor" mostra pendente 2 para ele.

CA-07  Dado uma solicitação só de insumos, já retirada
       Então ela não aparece em "com cada professor".

CA-08  Dado 2 unidades pendentes das quais 1 recebeu baixa por perda
       Então o pendente passa a 1.

CA-09  Dado dois professores com itens
       Então a lista agrupa por professor com totais, e o filtro por professor mostra só os dele.

CA-10  Dado 3 solicitações pendentes e 2 aprovadas aguardando retirada, a mais antiga há 4 dias
       Então os cards mostram 3, 2 e "4 dias", e cada card abre a lista com as mesmas contagens.

CA-11  Dado um solicitante comum
       Quando tenta ler os relatórios ou views (inclusive por chamada direta à API)
       Então a resposta é negada ou vazia.

CA-12  Dado um item com retirada, devolução e ajuste
       Então o histórico mostra os 3 movimentos em ordem cronológica, com tipo, quantidade e usuário, e o filtro por tipo funciona.

CA-13  Dado o ranking de um período
       Então a soma por item está correta, em ordem decrescente, e solicitações recusadas, canceladas ou apenas aprovadas (sem retirada) não contam.

CA-14  Dado o período de 01/10 a 31/10 e uma retirada em 31/10 às 23:30 (horário de Brasília)
       Então a retirada é incluída.

CA-15  Dado um relatório filtrado com 2.500 linhas
       Quando o admin exporta o CSV
       Então o arquivo traz as 2.500 linhas, não só a primeira página, e abre no Excel com acentos corretos.

CA-16  Dado um filtro sem resultados
       Então a tela mostra o estado vazio e o CSV exportado contém apenas o cabeçalho.

CA-17  Dado um professor com 2 chaves pendentes e outro professor com 1 furadeira
       Quando o primeiro abre "Itens comigo" (inclusive via chamada direta à API)
       Então vê só as 2 chaves.

## Fora de escopo
Notificação por e-mail ou push (inclusive alerta de estoque baixo e de nova solicitação) · gráficos avançados ou BI · relatórios agendados · exportação em PDF · controle e relatório de atraso · previsão de demanda.

## Pontos em aberto
- **OPEN-01 (resolvido em 2026-10-19):** `quantidade_baixada` por linha e a regra `devolvida + baixada <= aprovada` foram acrescentadas à spec-005 (RF-09, RF-12, RF-16). Refletido em RN-04 e CA-08.
- **OPEN-02 (resolvido em 2026-10-19):** Sim, o professor vê "Itens comigo", só os próprios (RF-20, CA-17).
- **OPEN-03 (resolvido em 2026-10-19):** Período padrão do ranking: últimos 30 dias (RF-14).
- **OPEN-04 (resolvido em 2026-10-19):** Separador `;` (RF-16).
- **OPEN-05 (resolvido em 2026-10-19):** Alerta de estoque mínimo só no painel, sem e-mail (coerente com a constituição §10).
