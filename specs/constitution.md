# Constituição do Projeto — Sistema de Controle de Inventário

Princípios inegociáveis. Qualquer spec, plano ou tarefa que os contrarie deve ser corrigido, ou esta constituição deve ser alterada **antes**, de forma explícita.

## 1. Contexto

Sistema web para uma única escola controlar o inventário de **insumos**, **ferramentas** e **máquinas**. Professores solicitam retiradas; administradores aprovam e entregam.

## 2. Perfis

| Perfil | Quantidade | Responsabilidades |
|---|---|---|
| `admin` | 2 pessoas | Aprovar/recusar, registrar retirada e devolução, cadastrar itens/tipos/locais, gerir usuários, ver relatórios e auditoria |
| `solicitante` | Demais usuários (professores) | Consultar catálogo, solicitar retirada, acompanhar e cancelar solicitações próprias pendentes |

- O perfil é um **campo do usuário**, nunca uma lista fixa no código.
- Um usuário só opera o sistema se `status = 'ativo'`.

## 3. Princípios de arquitetura

- **P-01** Toda regra que altera estoque vive no banco, em **funções RPC transacionais** (Postgres). O front nunca faz `update` direto em contadores de estoque.
- **P-02** Toda tabela tem **RLS habilitado**. Nenhuma permissão depende apenas de esconder telas.
- **P-03** A integridade do estoque é garantida por `CHECK` no banco: `quantidade_reservada + quantidade_em_uso <= quantidade_total`.
- **P-04** Operações concorrentes sobre o mesmo item usam bloqueio de linha (`SELECT ... FOR UPDATE`).
- **P-05** Todo movimento de estoque gera registro em `movimentacao` (imutável).
- **P-06** Alterações em `item`, `tipo_item`, `local` e `profiles` (perfil/status) são auditadas por **trigger** na tabela `auditoria`. Ninguém edita nem apaga auditoria.
- **P-07** O usuário não pode alterar o próprio `perfil` nem o próprio `status`.
- **P-08** Nunca ficar sem administrador ativo: o último admin ativo não pode ser rebaixado nem inativado.

## 4. Modelo de estoque

`disponível = quantidade_total − quantidade_reservada − quantidade_em_uso`

| Evento | Efeito |
|---|---|
| Aprovar | `reservada += aprovada` |
| Retirar insumo | `reservada -= q` e `total -= q` |
| Retirar ferramenta/máquina | `reservada -= q` e `em_uso += q` |
| Devolver | `em_uso -= q` |
| Recusar/cancelar solicitação já aprovada | `reservada -= aprovada` |

- Item com `numero_patrimonio` representa **uma unidade física** (`quantidade_total = 1`).
- Item **inoperante** permanece visível no catálogo, mas não pode ser solicitado nem aprovado.
- A disponibilidade é validada no envio **e** na aprovação.

## 5. Status da solicitação

`pendente → aprovada → retirada → concluida`
Saídas alternativas: `pendente → cancelada`, `pendente → recusada`, `aprovada → cancelada`.

Insumos: a solicitação vai a `concluida` no ato da retirada, se não houver ferramenta/máquina nela. Em solicitações mistas, conclui quando todos os itens que exigem devolução forem devolvidos.

## 6. Frontend

- React + TypeScript + Vite.
- Estrutura **por feature** (`features/<nome>/{components,hooks,api,schemas,types}`).
- Apenas a camada `api` acessa o cliente Supabase; componentes usam hooks.
- Dados do servidor com TanStack Query; formulários com React Hook Form + Zod.
- Tipos do banco gerados com `supabase gen types typescript`.
- Interface em **português do Brasil**.

## 7. Qualidade

- **Q-01** Toda regra de negócio tem ao menos um teste automatizado referenciando um critério de aceite (`CA-xx`).
- **Q-02** Funções RPC e políticas RLS são testadas no banco (ex.: pgTAP).
- **Q-03** ESLint, Prettier e verificação de tipos rodam em CI.
- **Q-04** O fluxo principal (solicitar → aprovar → retirar → devolver) tem teste end-to-end.

## 8. Fluxo de trabalho (SDD)

1. Spec (o quê) → 2. Clarificação → 3. Plano (como) → 4. Tarefas → 5. Implementação com testes → 6. Validação contra os critérios.
Se o comportamento mudar, **a spec muda primeiro**. Uma spec = uma branch/PR.

## 9. Convenções de IDs

- `RF-xx` requisito funcional · `CA-xx` critério de aceite · `RN-xx` regra de negócio · `OPEN-xx` ponto em aberto.
- IDs são únicos dentro de cada spec; para referenciar de outra spec use `spec-004/RF-03`.

## 10. Fora de escopo (versão inicial)

Prazo de devolução e controle de atraso · multi-escola · aplicativo móvel nativo · leitura de QR code · notificação por e-mail (candidata a extra futuro).

## 11. Infraestrutura e ambientes

| Ambiente | Situação | Front-end | Banco / Auth |
|---|---|---|---|
| local | em uso | Vite (`npm run dev`) | Supabase local (Docker) |
| staging | a criar | Vercel — deploys de preview (um por PR) | Projeto Supabase **staging**, separado |
| produção | **planejado** | Vercel — domínio de produção, só a partir da `main` | Projeto Supabase **produção** |

Os princípios abaixo valem desde já para qualquer ambiente remoto que venha a ser criado.

- **I-01** O front é um **SPA estático** hospedado na Vercel. Não há código de servidor fora do Postgres: nada de Vercel Functions, Next.js, Server Actions nem Supabase Edge Functions (reforça P-01).
- **I-02** O schema remoto (staging e produção) **só muda por migration versionada** em `supabase/migrations/`, aplicada com `supabase db push` depois de testada localmente. Nunca pelo painel nem por SQL avulso.
- **I-03** Deploys de preview **nunca** apontam para o banco de produção.
- **I-04** Só variáveis públicas (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`) são configuradas na Vercel. A `service_role` nunca sai do painel do Supabase.

### Pontos em aberto

- **OPEN-01 (adiado):** Deploy de produção automático a cada merge na `main` ou promoção manual de um deploy de preview? Decidir quando o ambiente de produção for criado.
