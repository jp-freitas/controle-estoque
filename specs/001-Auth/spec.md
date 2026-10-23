# 001 — Autenticação e perfis

## Contexto
Controle de quem entra no sistema e o que cada perfil pode fazer. Base de todas as demais features.

A entrada de usuários é **por convite do administrador** (OPEN-01, resolvido). Não há autocadastro.

## Histórias
- Como administrador, quero convidar uma pessoa pelo e-mail, já com o perfil definido, para que só quem eu autorizei tenha conta.
- Como professor convidado, quero aceitar o convite e definir minha senha para acessar o sistema.
- Como professor, quero entrar com e-mail e senha para solicitar itens.
- Como administrador, quero liberar ou bloquear usuários para controlar quem acessa o sistema.
- Como administrador, quero promover um usuário a admin ou rebaixá-lo, com segurança.

## Requisitos funcionais
- RF-01: Login por e-mail e senha (Supabase Auth); logout; recuperação de senha por e-mail.
- RF-02: Todo usuário autenticado tem um registro em `profiles` com `nome`, `email`, `matricula` (opcional), `perfil` (`admin` | `solicitante`) e `status` (`pendente` | `ativo` | `inativo`).
- RF-03: Não há autocadastro. Só é possível criar conta com um **convite válido** para o e-mail usado. Tentativas sem convite são rejeitadas e não criam `profiles`.
- RF-04: Usuário `pendente` ou `inativo` autentica, mas vê apenas uma tela informativa ("aguardando liberação" / "acesso desativado") e não acessa nenhum dado.
- RF-05: Somente `admin` ativo pode aprovar (`pendente → ativo`), inativar e reativar usuários, e alterar `perfil`.
- RF-06: O usuário não pode alterar o próprio `perfil` nem o próprio `status`.
- RF-07: O sistema nunca fica sem administrador ativo (último admin ativo não pode ser rebaixado nem inativado).
- RF-08: Rotas do front são protegidas por perfil e status; a proteção real é feita por RLS.
- RF-09: Admin vê a lista de usuários com filtro por status e perfil.
- RF-10: Admin ativo cria um convite informando **e-mail**, **nome**, **matrícula** (opcional) e **perfil** (padrão `solicitante`). O convite fica registrado no banco com esses dados, quem convidou, data de criação, data de validade e situação.
- RF-11: Ao criar o convite, o convidado recebe por e-mail um link de acesso. Ao abrir o link, define a própria senha; nesse momento a conta é criada com o `email`, o `nome`, a `matricula` e o `perfil` do convite e `status = pendente`, e o convite passa a `aceito`.
- RF-12: O convite vale **7 dias** a partir da criação. Depois disso não pode mais ser aceito; o admin precisa criar um novo convite. Reenviar o e-mail não renova o prazo.
- RF-13: Admin lista os convites com a situação (`enviado`, `aceito`, `cancelado`, `expirado`), reenvia o e-mail de um convite ainda válido e cancela convites não aceitos.
- RF-14: Não pode existir convite em aberto (não aceito, não cancelado, não expirado) para um e-mail que já tem conta ou que já tem outro convite em aberto.
- RF-15: O usuário `ativo` pode editar o próprio `nome` e a própria `matricula`. Nunca o próprio `email`, `perfil` ou `status` (RF-06).
- RF-16: Admin ativo pode editar `nome` e `matricula` de qualquer usuário.

## Regras de negócio
- RN-01: Existem 2 administradores previstos; o sistema não impõe limite rígido, mas o primeiro admin é criado manualmente (seed/SQL), sem convite.
- RN-02: Alterações de `perfil` e `status` são auditadas (constituição P-06).
- RN-03: O e-mail da conta é o e-mail do convite; o convidado não pode trocá-lo no aceite. E-mails são comparados sem diferenciar maiúsculas de minúsculas.
- RN-04: Mesmo convidado, o usuário entra como `pendente` e só opera depois que um admin o aprova (RF-05). O perfil escolhido no convite vale a partir da aprovação.
- RN-05: `matricula` é opcional para todos os perfis; quando preenchida, é única entre usuários e entre convites em aberto.

## Critérios de aceite
CA-01  Dado um visitante sem convite
       Quando tenta criar uma conta (inclusive via chamada direta à API)
       Então a criação é rejeitada e nenhum `profiles` é criado.

CA-02  Dado um usuário `pendente`
       Quando tenta consultar itens ou solicitações
       Então a consulta retorna vazio/negado por RLS e a interface mostra "aguardando liberação".

CA-03  Dado um admin ativo
       Quando aprova um usuário `pendente`
       Então o status vira `ativo` e o evento aparece na auditoria.

CA-04  Dado um solicitante ativo
       Quando tenta alterar o próprio `perfil` para `admin` (inclusive via chamada direta à API)
       Então a operação é negada.

CA-05  Dado um único admin ativo
       Quando ele tenta rebaixar ou inativar a si mesmo
       Então a operação é rejeitada com mensagem explicando o motivo.

CA-06  Dado dois admins ativos
       Quando um deles rebaixa o outro para `solicitante`
       Então a operação é permitida e fica registrada na auditoria.

CA-07  Dado um usuário `inativo`
       Quando tenta qualquer operação de escrita
       Então a operação é negada.

CA-08  Dado um admin ativo
       Quando convida "prof@escola.br" com nome e perfil `solicitante`
       Então o convite fica registrado com e-mail, nome, perfil, quem convidou, situação `enviado` e validade de 7 dias.

CA-09  Dado um convite `enviado` dentro da validade
       Quando o convidado abre o link e define a senha
       Então é criado um `profiles` com o e-mail e o perfil do convite e status `pendente`, e o convite passa a `aceito`.

CA-10  Dado um convite criado há mais de 7 dias
       Quando o convidado tenta aceitá-lo
       Então o aceite é rejeitado com a mensagem "Convite expirado" e nenhum `profiles` é criado.

CA-11  Dado um convite `cancelado`
       Quando o convidado tenta aceitá-lo
       Então o aceite é rejeitado e nenhum `profiles` é criado.

CA-12  Dado um usuário `solicitante`, `pendente` ou `inativo`
       Quando tenta criar, listar, reenviar ou cancelar convites (inclusive via chamada direta à API)
       Então a operação é negada.

CA-13  Dado um e-mail que já tem conta ou já tem convite em aberto
       Quando um admin tenta convidá-lo
       Então o convite é rejeitado com mensagem explicando o motivo.

CA-14  Dado um convite aceito por um convidado com perfil `admin` no convite
       Quando o convite é aceito
       Então o usuário fica `pendente` e só passa a operar como admin depois de aprovado por um admin ativo.

CA-15  Dado um convite com matrícula "12345"
       Quando o convidado aceita o convite
       Então o `profiles` criado tem `matricula = '12345'`.

CA-16  Dado um usuário `ativo`
       Quando altera a própria matrícula
       Então a alteração é salva; e quando tenta alterar o próprio `email`, `perfil` ou `status` (inclusive via API), é negada.

CA-17  Dado um usuário com matrícula "12345"
       Quando um admin convida outra pessoa com a matrícula "12345", ou outro usuário tenta usá-la no próprio perfil
       Então a operação é rejeitada com a mensagem "Matrícula já cadastrada".

CA-18  Dado um convite sem matrícula
       Quando o convidado aceita o convite
       Então o `profiles` é criado com `matricula` vazia, sem erro.

## Fora de escopo
Login social, autenticação em dois fatores, múltiplas escolas, autocadastro, convites em lote/importação de planilha.

## Pontos em aberto
- **OPEN-01 (resolvido em 2026-10-19):** Modelo de entrada de usuários → **convite pelo admin**, com o e-mail registrado no banco. Convidado entra como `pendente`; admin escolhe o perfil no convite (padrão `solicitante`); convite expira em 7 dias. Refletido em RF-03, RF-10 a RF-14, RN-03, RN-04 e CA-01, CA-08 a CA-14.
- **OPEN-02 (resolvido por consequência de OPEN-01):** Confirmação de e-mail — o próprio link do convite comprova o e-mail; não há etapa extra.
- **OPEN-03 (resolvido em 2026-10-19):** Campos extras → apenas **matrícula**, opcional, informada pelo admin no convite e editável depois pelo próprio usuário ativo ou por admin. Refletido em RF-02, RF-10, RF-11, RF-15, RF-16, RN-05 e CA-15 a CA-18.
- **OPEN-04 (em aberto, 2026-10-23):** CA-12 exige que não-admins não consigam **reenviar** convite "inclusive via chamada direta à API". Pelo `plan.md`, reenviar é chamar `signInWithOtp` de novo, e esse endpoint do Supabase Auth é público: qualquer pessoa pode pedir um link para um e-mail que já está em `auth.users`. O banco não consegue barrar isso. Efeito de um abuso: o convidado recebe outro link no próprio e-mail; quem chamou não ganha acesso, e cancelado/expirado continua barrado em `aceitar_convite()`. Opções: (a) ajustar CA-12 para que reenviar seja negado **na interface** e, via API, valha só a garantia de não ganhar acesso; (b) exigir mecanismo server-side para o envio, o que esbarra na constituição I-01 (sem Edge Functions).
