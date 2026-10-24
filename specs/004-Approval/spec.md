# 004 — Aprovação de solicitações

## Contexto
O administrador analisa solicitações pendentes e decide aprovar (total ou parcialmente) ou recusar. A aprovação reserva o estoque.

## Histórias
- Como administrador, quero ver a fila de solicitações pendentes para decidir rapidamente.
- Como administrador, quero aprovar parcialmente quando o estoque não cobrir tudo.
- Como administrador, quero recusar informando o motivo, para o professor entender.

## Requisitos funcionais
- RF-01: Apenas perfil `admin` com status `ativo` pode aprovar ou recusar.
- RF-02: Admin não pode aprovar nem recusar a própria solicitação.
- RF-03: Fila do admin lista solicitações `pendente` (mais antigas primeiro), com solicitante, itens, quantidades, justificativa e **disponibilidade atual** de cada item.
- RF-04: RPC `aprovar_solicitacao(id, itens_aprovados)` recebe `quantidade_aprovada` por linha (0 ≤ aprovada ≤ solicitada) e, em uma única transação:
  - bloqueia as linhas dos itens envolvidos (`FOR UPDATE`);
  - revalida a disponibilidade e a operância de cada item;
  - incrementa `quantidade_reservada` na quantidade aprovada;
  - grava `movimentacao` tipo `reserva` por linha com aprovada > 0;
  - registra `aprovador_id`, `data_decisao` e a `observacao` geral, opcional;
  - muda o status para `aprovada`.
- RF-05: Se a soma das quantidades aprovadas for zero, a aprovação é rejeitada (usar recusa).
- RF-06: Se qualquer linha excede a disponibilidade no momento da decisão, a operação inteira falha sem alterar contadores, indicando o item.
- RF-07: Item inoperante não pode ter quantidade aprovada maior que 0.
- RF-08: RPC `recusar_solicitacao(id, motivo)`: `motivo` obrigatório; status `recusada`; não altera estoque.
- RF-09: Só solicitações `pendente` podem ser aprovadas ou recusadas.
- RF-10: RPC `cancelar_solicitacao_aprovada(id, motivo)` (admin): solicitação `aprovada` e sem retirada volta a `cancelada`, liberando `reservada` e gravando `movimentacao` tipo `liberacao_reserva`.
- RF-11: Aprovação parcial exige que o professor veja, no detalhe da solicitação, a quantidade aprovada por item e a observação geral da aprovação, se houver. Não há justificativa por item.
- RF-12: Estado terminal para o professor: ao ser aprovada ou recusada, a solicitação aparece com o novo status em "Minhas solicitações".
- RF-14: Só se aprova solicitação de quem **ainda está ativo**. Se o solicitante foi inativado ou voltou a pendente depois do envio, a aprovação é rejeitada e a fila sinaliza a situação; recusar continua permitido.
- RF-13: A reserva de uma solicitação aprovada **não expira** automaticamente. O admin vê a lista de aprovadas aguardando retirada, com há quantos dias cada uma foi aprovada, e cancela pelo RF-10 se necessário.

## Regras de negócio
- RN-01: Apenas **um** administrador precisa aprovar.
- RN-02: A reserva é o que impede que dois professores levem a mesma unidade; qualquer aprovação concorrente é serializada pelo bloqueio de linha.
- RN-03: Recusa e cancelamento nunca deixam reserva "órfã": `reservada` deve sempre refletir exatamente as solicitações aprovadas e ainda não retiradas.

## Critérios de aceite
CA-01  Dado um item com total 10, reservada 8
       Quando o admin aprova 5 unidades
       Então a operação é rejeitada com "estoque insuficiente" e nenhum contador é alterado.

CA-02  Dado uma solicitação de 3 itens, onde 1 não tem estoque
       Quando o admin aprova os outros 2 e define aprovada = 0 para o terceiro
       Então a solicitação fica `aprovada`, o terceiro tem `quantidade_aprovada = 0` e as reservas são criadas só para os 2.

CA-03  Dado duas aprovações simultâneas de solicitações do mesmo item com estoque para apenas uma
       Então exatamente uma é concluída e a outra falha, sem reserva dupla e sem violar o CHECK de estoque.

CA-04  Dado um solicitante comum
       Quando chama `aprovar_solicitacao`
       Então recebe erro de permissão.

CA-05  Dado um admin que criou a própria solicitação
       Quando tenta aprová-la
       Então a operação é rejeitada (outro admin precisa aprovar).

CA-06  Dado uma recusa sem motivo
       Então é rejeitada com erro de validação.

CA-07  Dado uma solicitação já `aprovada`
       Quando o admin tenta aprová-la de novo
       Então a operação é rejeitada (status inválido) e nenhuma reserva duplicada é criada.

CA-08  Dado uma solicitação `aprovada` com reserva de 3 unidades
       Quando o admin a cancela
       Então `quantidade_reservada` volta ao valor anterior e a movimentação `liberacao_reserva` é registrada.

CA-09  Dado um item que ficou inoperante entre o envio e a aprovação
       Quando o admin tenta aprovar quantidade > 0 para ele
       Então a operação é rejeitada.

CA-10  Dado a aprovação de uma solicitação com quantidade aprovada total zero
       Então a operação é rejeitada com orientação para recusar.

CA-11  Dado uma aprovação parcial com observação "Só há 2 em estoque"
       Quando o professor abre o detalhe da solicitação
       Então vê a quantidade aprovada de cada item e a observação.

CA-12  Dado uma solicitação aprovada há 10 dias e não retirada
       Então continua `aprovada`, com a reserva mantida, e aparece na lista de aguardando retirada com "10 dias".

CA-13  Dado uma solicitação pendente de um professor que foi inativado depois do envio
       Quando o admin tenta aprová-la
       Então a operação é rejeitada ("O solicitante não está ativo; recuse a solicitação.") e nada muda;
       a recusa continua permitida.

## Fora de escopo
Notificação por e-mail ao professor ou ao admin (extra futuro), aviso/selo de novidade no sistema, aprovação em duas etapas, delegação de aprovação, expiração automática de reserva.

## Pontos em aberto
- **OPEN-01 (resolvido em 2026-10-19):** Sem justificativa por item; a aprovação tem uma observação geral opcional, visível ao professor. Refletido em RF-04, RF-11 e CA-11.
- **OPEN-02 (resolvido em 2026-10-19):** A reserva não expira na v1; o admin acompanha a lista de aguardando retirada e cancela pelo RF-10. Refletido em RF-13 e CA-12.
- **OPEN-04 (resolvido em 2026-10-24):** Solicitante inativado ou pendente depois do envio não tem a solicitação aprovada; o admin recusa. Refletido em RF-14 e CA-13.
- **OPEN-03 (resolvido em 2026-10-19):** Sem aviso/notificação na v1; o professor vê o novo status em "Minhas solicitações" (RF-12).
