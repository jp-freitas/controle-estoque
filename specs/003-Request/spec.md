# 003 — Solicitação de retirada com carrinho

## Contexto
O professor monta um carrinho com vários itens e envia uma solicitação de retirada, que segue para análise do administrador.

## Histórias
- Como professor, quero adicionar vários itens a um carrinho e enviar uma única solicitação.
- Como professor, quero acompanhar o status das minhas solicitações.
- Como professor, quero cancelar uma solicitação que ainda não foi analisada.

## Requisitos funcionais
- RF-01: Somente usuário ativo (qualquer perfil) cria solicitações, sempre em seu próprio nome.
- RF-02: O carrinho existe apenas no front (estado local, persistido no navegador). Só a solicitação **enviada** vai ao banco.
- RF-03: Cada linha do carrinho tem item e quantidade (inteiro ≥ 1). Um mesmo item não aparece duas vezes na solicitação.
- RF-04: O carrinho impede quantidade acima da disponível exibida e itens inoperantes (validação de conveniência; a validação real ocorre no banco).
- RF-05: Envio via RPC `enviar_solicitacao(itens, justificativa)`:
  - valida usuário ativo;
  - valida cada item: existe, ativo, operante e com `disponível >= quantidade`;
  - cria `solicitacao` com status `pendente` e as linhas em `solicitacao_item`;
  - **não** altera contadores de estoque (a reserva só ocorre na aprovação).
- RF-06: `justificativa` é obrigatória (texto curto, ex.: aula/turma/finalidade).
- RF-07: Se qualquer item falhar na validação, **nenhuma** solicitação é criada e o erro indica quais itens falharam e por quê.
- RF-08: "Minhas solicitações": lista com status, data e itens; detalhe mostra decisão, motivo de recusa e quantidades aprovadas.
- RF-09: Cancelamento via RPC `cancelar_solicitacao(id)` pelo dono, somente enquanto `pendente`. Depois de aprovada, só o admin cancela (spec-004/RF-10).
- RF-10: Solicitante só enxerga as próprias solicitações; admin enxerga todas.
- RF-11: Solicitações enviadas não são editáveis. Para mudar algo, cancelar e criar outra.

## Regras de negócio
- RN-01: A disponibilidade na solicitação é uma verificação de pré-validação; a garantia final é a da aprovação (spec-004).
- RN-02: Várias solicitações pendentes podem concorrer pelo mesmo estoque; vale a ordem de aprovação do admin.
- RN-03: Admin também pode solicitar itens, mas não pode aprovar a própria solicitação (ver spec-004).

## Critérios de aceite
CA-01  Dado um professor ativo com 2 itens no carrinho, ambos disponíveis
       Quando envia a solicitação com justificativa
       Então é criada uma solicitação `pendente` com 2 linhas e nenhum contador de estoque é alterado.

CA-02  Dado um item com disponível 2
       Quando o professor tenta enviar quantidade 3
       Então a solicitação é rejeitada e nada é criado.

CA-03  Dado um item inoperante no carrinho
       Quando o professor envia a solicitação
       Então é rejeitada, identificando o item inoperante.

CA-04  Dado um envio sem justificativa
       Então é rejeitado com erro de validação.

CA-05  Dado um professor com solicitação `pendente`
       Quando a cancela
       Então o status vira `cancelada` e nenhum contador muda.

CA-06  Dado uma solicitação `aprovada` ou posterior
       Quando o professor tenta cancelar pelo fluxo de solicitante
       Então a operação é negada (só o admin cancela após a aprovação, spec-004/RF-10).

CA-07  Dado dois professores
       Quando um tenta ler a solicitação do outro (inclusive via API direta)
       Então o acesso é negado por RLS.

CA-08  Dado um usuário `pendente` ou `inativo`
       Quando tenta enviar uma solicitação
       Então a operação é negada.

CA-09  Dado a recarga da página com itens no carrinho
       Então o carrinho é restaurado (persistência local) e revalidado contra o catálogo atual.

## Fora de escopo
Reserva de itens ao montar o carrinho, agendamento de data futura de retirada, edição de solicitação enviada.

## Pontos em aberto
- **OPEN-01 (resolvido em 2026-10-19):** Após a aprovação, só o admin cancela (spec-004/RF-10), coerente com CA-06. Refletido em RF-09.
- **OPEN-02:** Limite de quantidade de itens/unidades por solicitação?
- **OPEN-03 (resolvido em 2026-10-19):** Sem campo próprio de turma/disciplina; a `justificativa` cobre (RF-06).
