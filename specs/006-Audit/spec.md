# 006 — Auditoria de alterações

## Contexto
Registra **quem alterou o quê, quando e com quais valores** nos cadastros que definem o inventário (itens, tipos, locais) e nos acessos (perfil e status de usuários). Complementa `movimentacao` (spec-005), que registra os movimentos de estoque.

## Histórias
- Como administrador, quero ver o histórico de alterações de um item para entender por que ele mudou (local, estado, operante, quantidade).
- Como administrador, quero saber quem mudou o perfil ou o status de um usuário.
- Como administrador, quero ter certeza de que ninguém consegue alterar ou apagar o histórico.

## Requisitos funcionais

### Registro
- RF-01: Existe a tabela `auditoria` com: `id`, `tabela`, `registro_id`, `acao` (`INSERT` | `UPDATE` | `DELETE`), `usuario_id` (anulável), `dados_antes` (jsonb), `dados_depois` (jsonb), `campos_alterados` (lista de nomes de colunas), `motivo` (anulável) e `criado_em`.
- RF-02: O registro é feito por **triggers no Postgres** nas tabelas `item`, `tipo_item`, `local` e `profiles`, independente do front. Vale para qualquer origem: aplicação, funções RPC ou SQL direto.
- RF-03: `INSERT` grava `dados_antes` nulo e `dados_depois` completo; `DELETE` faz o inverso; `UPDATE` grava os dois e a lista de `campos_alterados`.
- RF-04: `usuario_id` recebe o `auth.uid()` do momento. Quando não há usuário autenticado (migration, SQL Editor, `service_role`), fica nulo e é exibido como "Sistema".
- RF-05: Um `UPDATE` em `item` que altere **somente** campos de estoque (`quantidade_total`, `quantidade_reservada`, `quantidade_em_uso`) e/ou `atualizado_em` **não** gera registro quando feito por uma função de movimento de estoque (reserva, retirada, devolução, baixa por dano ou perda — specs 004 e 005), porque esses movimentos já estão em `movimentacao`. O **ajuste manual** de `quantidade_total` (spec-002/RF-09) e qualquer alteração em outro campo geram registro.
- RF-06: Em `profiles`, o `INSERT` (cadastro) é auditado, e o `UPDATE` só é auditado quando muda `perfil` ou `status`. Outros campos (ex.: `nome`) não geram registro.
- RF-07: Um `UPDATE` que não altera nenhum valor não gera registro.
- RF-08: A gravação da auditoria acontece na **mesma transação** da alteração. Se a auditoria falhar, a alteração é desfeita.
- RF-17: `motivo` é preenchido quando a ação exige motivo: ajuste manual de quantidade (spec-002/RF-09) e marcar inoperante/reativar item (spec-002/RF-14). Edições comuns de cadastro não pedem motivo.
- RF-09: Nenhum dado de credencial (senha, token) é armazenado em `dados_antes`/`dados_depois`; só colunas das tabelas auditadas.

### Imutabilidade e segurança
- RF-10: `auditoria` tem RLS habilitado. `SELECT` somente para `admin` ativo. Não existe política de `INSERT`, `UPDATE` ou `DELETE` para usuários da aplicação, e os privilégios de escrita são revogados de `anon` e `authenticated`.
- RF-11: A inserção só ocorre pela função de trigger (`SECURITY DEFINER`, com `search_path` fixo).
- RF-12: Um trigger bloqueia `UPDATE`, `DELETE` e `TRUNCATE` em `auditoria`, inclusive para as roles de aplicação (incluindo `service_role`). Qualquer mudança exige migration explícita.

### Consulta
- RF-13: O detalhe do item (somente admin) tem a aba **Histórico**: lista em ordem cronológica decrescente com data e hora (fuso `America/Sao_Paulo`), nome do usuário, ação e, nos `UPDATE`, cada campo alterado no formato "rótulo: antes → depois" (ex.: "Local: Armário A → Sala 2"). Chaves estrangeiras (`local_id`, `tipo_id`) aparecem com o **nome legível**, não com o id.
- RF-14: A mesma visão existe no detalhe de tipos, locais e usuários.
- RF-15: Existe a tela **Auditoria** (admin) com filtros por tabela, ação, usuário, período e registro, com paginação no servidor.
- RF-16: A consulta é feita por função ou view somente leitura que resolve os nomes (usuário, local, tipo) e pagina no servidor.

## Regras de negócio
- RN-01: Auditoria cobre **dados cadastrais e de acesso**. Movimento de estoque fica em `movimentacao` (constituição P-05), e solicitações têm ciclo próprio de status, datas e decisor; nenhum dos dois é duplicado aqui.
- RN-02: A interface não oferece exclusão de usuários (só inativação, spec-001). Se um `DELETE` ocorrer por outro meio, ele é auditado.
- RN-03: A auditoria é permanente na versão inicial; não há expurgo automático.
- RN-04: A proteção do item RF-12 vale contra erros e uso indevido pela aplicação. Não pretende impedir o dono do banco de alterar a estrutura por migration.

## Critérios de aceite
CA-01  Dado um item no local A
       Quando o admin o muda para o local B
       Então é criado 1 registro `UPDATE` com `usuario_id` do admin, `campos_alterados = {local_id}` e os ids antes e depois.

CA-02  Dado o cadastro de um item novo
       Então é criado 1 registro `INSERT` com `dados_antes` nulo e `dados_depois` completo.

CA-03  Dado um item desativado pelo admin
       Então o registro `UPDATE` mostra o campo de ativação alterado.

CA-04  Dado a aprovação de uma solicitação, que altera apenas `quantidade_reservada`
       Então nenhum registro de auditoria é criado e a `movimentacao` de reserva existe.

CA-05  Dado um `UPDATE` que grava os mesmos valores já existentes
       Então nenhum registro é criado.

CA-06  Dado um ajuste manual que altera `quantidade_total`
       Então é criado registro com `quantidade_total` em `campos_alterados`, além da `movimentacao` de ajuste.

CA-07  Dado o admin mudando o perfil de um usuário para `admin`
       Então o registro em `profiles` traz `perfil` em `campos_alterados` e o `usuario_id` do admin.

CA-08  Dado uma alteração em `profiles` que muda apenas o `nome`
       Então nenhum registro é criado.

CA-09  Dado uma alteração feita pelo SQL Editor, sem usuário autenticado
       Então o registro é criado com `usuario_id` nulo e aparece como "Sistema".

CA-10  Dado um solicitante ativo
       Quando consulta `auditoria` (inclusive por chamada direta à API)
       Então não recebe nenhum registro.

CA-11  Dado qualquer usuário da aplicação
       Quando tenta `INSERT`, `UPDATE` ou `DELETE` direto em `auditoria`
       Então a operação é negada.

CA-12  Dado uma tentativa de `UPDATE` ou `DELETE` em `auditoria` com a role de serviço
       Então o trigger rejeita a operação.

CA-13  Dado uma falha forçada ao gravar a auditoria
       Então a alteração original também não é persistida.

CA-14  Dado um item com 3 alterações
       Quando o admin abre a aba Histórico
       Então vê as 3 em ordem decrescente, com nomes legíveis (ex.: "Local: Armário A → Sala 2").

CA-15  Dado a tela Auditoria com filtro de usuário e período
       Então só aparecem os registros correspondentes, paginados.

CA-16  Dado a retirada de um insumo, que reduz `quantidade_total`
       Então nenhum registro de auditoria é criado e a `movimentacao` de retirada existe.

CA-17  Dado a reativação de um item inoperante com motivo "Consertado"
       Então o registro `UPDATE` traz `operante` em `campos_alterados` e `motivo = 'Consertado'`.

## Fora de escopo
Auditoria de leituras e de logins · auditoria de `solicitacao` e `movimentacao` · desfazer alterações a partir do histórico · hash encadeado ou assinatura do log · exportação da auditoria · alertas sobre alterações.

## Pontos em aberto
- **OPEN-01 (resolvido em 2026-10-19):** Mudanças de estoque feitas por funções de movimento (inclusive a baixa de `quantidade_total` na retirada de insumo) **não** geram auditoria; ficam só em `movimentacao`. O ajuste manual continua auditado. Refletido em RF-05 e CA-16.
- **OPEN-02 (resolvido em 2026-10-19):** Auditoria mantida para sempre na v1 (RN-03).
- **OPEN-03 (resolvido em 2026-10-19):** Edições comuns não exigem motivo; só ajuste de quantidade e operância de item, guardado na coluna `motivo`. Refletido em RF-01, RF-17 e CA-17.
