# 001 — Autenticação e perfis

## Contexto
Controle de quem entra no sistema e o que cada perfil pode fazer. Base de todas as demais features.

## Histórias
- Como professor, quero me cadastrar e entrar com e-mail e senha para solicitar itens.
- Como administrador, quero liberar ou bloquear usuários para controlar quem acessa o sistema.
- Como administrador, quero promover um usuário a admin ou rebaixá-lo, com segurança.

## Requisitos funcionais
- RF-01: Login por e-mail e senha (Supabase Auth); logout; recuperação de senha por e-mail.
- RF-02: Todo usuário autenticado tem um registro em `profiles` com `nome`, `email`, `perfil` (`admin` | `solicitante`) e `status` (`pendente` | `ativo` | `inativo`).
- RF-03: Novo cadastro nasce com `perfil = solicitante` e `status = pendente`. *(Ver OPEN-01.)*
- RF-04: Usuário `pendente` ou `inativo` autentica, mas vê apenas uma tela informativa ("aguardando liberação" / "acesso desativado") e não acessa nenhum dado.
- RF-05: Somente `admin` ativo pode aprovar (`pendente → ativo`), inativar e reativar usuários, e alterar `perfil`.
- RF-06: O usuário não pode alterar o próprio `perfil` nem o próprio `status`.
- RF-07: O sistema nunca fica sem administrador ativo (último admin ativo não pode ser rebaixado nem inativado).
- RF-08: Rotas do front são protegidas por perfil e status; a proteção real é feita por RLS.
- RF-09: Admin vê a lista de usuários com filtro por status e perfil.

## Regras de negócio
- RN-01: Existem 2 administradores previstos; o sistema não impõe limite rígido, mas o primeiro admin é criado manualmente (seed/SQL).
- RN-02: Alterações de `perfil` e `status` são auditadas (constituição P-06).

## Critérios de aceite
CA-01  Dado um visitante sem conta
       Quando se cadastra com e-mail e senha válidos
       Então é criado um `profiles` com perfil `solicitante` e status `pendente`.

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

## Fora de escopo
Login social, autenticação em dois fatores, múltiplas escolas.

## Pontos em aberto
- **OPEN-01:** Modelo de entrada de usuários ainda não definido. Recomendação: autocadastro com aprovação do admin (opção B). Alternativas: convite pelo admin (A) ou autocadastro por domínio institucional (C). A troca afeta só RF-03 e as telas de cadastro/convite.
- **OPEN-02:** Exigir confirmação de e-mail antes de aparecer na lista de pendentes?
- **OPEN-03:** Campos extras do professor (disciplina, matrícula)?
