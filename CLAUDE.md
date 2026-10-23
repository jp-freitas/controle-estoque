# CLAUDE.md — Sistema de Controle de Inventário

Sistema web para uma única escola controlar o inventário de **insumos**, **ferramentas** e **máquinas**. Professores solicitam retiradas; administradores aprovam e entregam.

## Fonte da verdade (SDD)

Este projeto segue **Spec Driven Development**. Antes de qualquer trabalho:

1. Leia `specs/constitution.md` (princípios inegociáveis).
2. Leia a `spec.md` da feature em questão (`specs/NNN-nome/spec.md`).

Regras:
- **Se o comportamento muda, a spec muda primeiro.** Nunca implemente algo que contrarie a spec ou a constituição; proponha a alteração na spec antes.
- Uma spec = uma branch/PR.
- Não invente funcionalidades. O que está em "Fora de escopo" não deve ser implementado.
- Itens `OPEN-xx` são decisões pendentes: **pergunte ao usuário**, não decida sozinho.
- Cite os IDs (`RF-xx`, `CA-xx`, `spec-004/RF-03`) em commits, testes e PRs.
- Decisões técnicas ("como") vão em `plan.md`; tarefas em `tasks.md`, na pasta da feature.

## Stack

| Camada | Tecnologia |
|---|---|
| Banco / Auth | Supabase (Postgres + Auth + RLS) |
| Regras de negócio | Funções RPC em Postgres (PL/pgSQL) |
| Front-end | React + TypeScript + Vite (pasta `web/`) |
| Dados do servidor | TanStack Query |
| Formulários | React Hook Form + Zod |
| UI | Tailwind + shadcn/ui |
| Rotas | React Router |
| Testes banco | pgTAP (`supabase test db`) |
| Testes front | Vitest + Testing Library; Playwright para E2E |
| Hospedagem front | Vercel (SPA estático, Root Directory `web/`) |

> **Não é Next.js.** O plugin da Vercel sugere padrões de Next.js (App Router, Server Actions, middleware, Functions, Cache Components) — **ignore**. Não há backend fora do Postgres: nada de Vercel Functions nem Supabase Edge Functions (constituição I-01).

## Ambientes

| Ambiente | Situação | Front | Banco |
|---|---|---|---|
| local | **em uso** | `npm run dev` | `supabase start` (Docker) |
| staging (homologação) | **em uso** | projeto Vercel `controle-estoque`: previews (um por PR) e, provisoriamente, o deploy da `main` (`https://controle-estoque.vercel.app`) | Supabase `controle-estoque-stagging` (ref `nfuagnapfergfheeohbh`) |
| produção | **planejado — ainda não existe** | Vercel, só a partir da `main` | projeto Supabase **produção** |

Hoje existem **local** e **staging**. Não crie projetos remotos (Supabase/Vercel) nem configure produção sem pedido explícito do usuário.

- **Provisório, até existir produção:** as variáveis *Production* da Vercel também apontam para o staging, então o deploy da `main` é a URL fixa da homologação. Quando a produção for criada, troque essas variáveis (e o `site_url` em `[remotes.staging.auth]`).
- **Configuração do Auth do staging é código:** bloco `[remotes.staging]` em `supabase/config.toml` (herda hook e templates; sobrescreve URLs e regras de e-mail). Aplicar com `supabase config diff` → `supabase config push`, sempre com confirmação explícita.

- As variáveis `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` na Vercel são configuradas **por ambiente**: *Preview* → staging, *Production* → produção (hoje, provisoriamente, staging). Preview nunca aponta para produção (I-03).
- Tudo que começa com `VITE_` vai para o bundle público: só a chave anon/publishable. Nunca a `service_role` (I-04).
- O Supabase Auth de cada projeto precisa das Redirect URLs do domínio correspondente (recuperação de senha, spec-001/RF-01). Ver `specs/001-Auth/plan.md`.
- Deploy de produção automático ou manual (constituição OPEN-01): **adiado** até existir produção. Não trate como decisão a tomar agora.

### Ambiente local (desenvolvimento)

- **SO:** Ubuntu no WSL2, com `systemd=true` em `/etc/wsl.conf`.
- **Docker:** Docker Engine **nativo no WSL** (não Docker Desktop). Instalação: `sudo bash scripts/setup-docker-wsl.sh`. O usuário fica no grupo `docker` — `docker` roda sem `sudo`.
- **Supabase CLI:** vem como devDependency em `web/`; não precisa de instalação global. De dentro de `web/`: `npx supabase <comando> --workdir ..` (ex.: `npx supabase start --workdir ..`). Os comandos `supabase …` deste arquivo equivalem a isso.
- **Portas locais:** API `54321`, Postgres `54322`, Studio `54323` (http://127.0.0.1:54323), Mailpit `54324` (http://127.0.0.1:54324 — e-mails de auth, como recuperação de senha, chegam aqui), Vite `5173`.
- **Memória:** a stack do Supabase usa ~2–3 GB. Se o WSL ficar sem memória, ajuste `memory=` em `%UserProfile%\.wslconfig` no Windows.
- Para parar a stack sem perder dados: `supabase stop`. `supabase db reset` **apaga** o banco local e recria a partir das migrations + seed.

## Plugins / MCP

### Supabase (somente leitura)

O MCP do Supabase é usado **só para leitura**. As ferramentas de escrita estão bloqueadas em `.claude/settings.json` (`permissions.deny`); não tente contorná-las com CLI, `psql` ou outra via.

- **Pode usar:** `list_tables`, `list_migrations`, `list_extensions`, `get_advisors` (rode os advisors de segurança/performance antes de concluir uma feature — complementa a validação de RLS), `query_logs`, `search_docs`, `get_project`, `get_project_url`, `get_publishable_keys`.
- **Bloqueado:** `apply_migration`, `execute_sql`, branches (`create/merge/rebase/reset/delete_branch`), `create/pause/restore_project`, edge functions e secrets.
- Mudança de schema segue o fluxo normal: arquivo em `supabase/migrations/` → `supabase db reset` + `supabase test db` local → PR → `supabase db push` no staging e depois na produção, **sempre com confirmação explícita do usuário**.
- Tipos vêm do banco local (`npm run db:types`), não do `generate_typescript_types` remoto.
- Para inspeção/debug, prefira o projeto **staging**; só consulte produção quando o usuário pedir.

### Vercel

- Configuração do projeto: Root Directory `web/`, build `npm run build`, saída `dist`. `web/vercel.json` reescreve todas as rotas para `/index.html` (React Router).
- **Pode usar sem pedir:** leitura de deploys, build logs, runtime logs, variáveis (sem decifrar valores), `search_vercel_documentation`.
- **Só com confirmação explícita:** deploy de produção, `request_promote`, `request_rollback`, criar/editar variáveis de ambiente, domínios/DNS, firewall, criar/pausar projeto.
- Não adicione integrações da Marketplace, Blob, Edge Config, Flags, AI SDK etc. — fora da stack; se parecer necessário, proponha na spec/constituição primeiro.

## Estrutura do repositório

```
specs/                 # constituição e specs por feature (fonte da verdade)
supabase/
├─ migrations/         # SQL versionado (uma ou mais por feature)
├─ tests/              # testes pgTAP, nomeados por spec/CA
├─ seed.sql            # dados de exemplo para desenvolvimento
└─ config.toml
web/
└─ src/
   ├─ app/             # providers, router, layout raiz
   ├─ features/<nome>/ # components, hooks, api, schemas, types
   ├─ shared/          # UI e utilitários genéricos
   ├─ lib/             # cliente Supabase, queryClient
   └─ types/           # tipos gerados do banco
```

## Regras de arquitetura (resumo da constituição)

- **Estoque só muda via RPC.** Nunca faça `update` direto em `quantidade_total`, `quantidade_reservada` ou `quantidade_em_uso` pelo front (P-01).
- **RLS em toda tabela.** Esconder tela não é segurança (P-02).
- **Invariante:** `quantidade_reservada + quantidade_em_uso <= quantidade_total`, garantida por `CHECK` (P-03).
- **Concorrência:** funções de estoque usam `SELECT ... FOR UPDATE` nos itens envolvidos (P-04).
- **Toda movimentação** de estoque grava em `movimentacao` (imutável) (P-05).
- **Auditoria por trigger** em `item`, `tipo_item`, `local` e `profiles` (perfil/status); ninguém edita ou apaga auditoria (P-06).
- O usuário **não altera o próprio** `perfil` nem `status` (P-07). Nunca ficar sem admin ativo (P-08).
- Funções `SECURITY DEFINER` devem fixar `search_path` e checar perfil/status do `auth.uid()` dentro da própria função.

### Modelo de estoque

`disponível = total − reservada − em_uso`

| Evento | Efeito |
|---|---|
| Aprovar | `reservada += aprovada` |
| Retirar insumo | `reservada -= q`, `total -= q` |
| Retirar ferramenta/máquina | `reservada -= q`, `em_uso += q` |
| Devolver | `em_uso -= q` |
| Cancelar/recusar solicitação aprovada | `reservada -= aprovada` |

### Status da solicitação

`pendente → aprovada → retirada → concluida`; alternativas: `cancelada`, `recusada`.

## Convenções

### Banco
- Nomes de tabelas e colunas em **português, snake_case, singular** (`item`, `solicitacao_item`, `quantidade_total`).
- Migrations: uma por mudança lógica, nome descritivo (`supabase migration new nome`). **Nunca altere o banco pelo painel**; nunca edite migration já aplicada em produção, crie uma nova.
- Todo objeto novo: tabela com RLS habilitado e políticas explícitas, constraints no banco (não só no front), índices para chaves estrangeiras usadas em filtros.
- Funções RPC: nome em verbo (`aprovar_solicitacao`), retornam erros com mensagens claras em português para o front exibir.
- Depois de mudar o schema: `supabase gen types typescript --local > web/src/types/database.ts`.
- **Dono do schema:** cada spec cria as próprias tabelas e acrescenta colunas às de outra spec por **migration própria** (002 cria `item` e `movimentacao`; 003 cria `solicitacao`; 004 e 005 acrescentam colunas).

### Banco — convenções técnicas transversais
- **Erros de RPC:** `raise exception using errcode = 'P0001', message = '<texto em pt-BR para o usuário>', detail = '<jsonb>'`. Erros por item vão em `detail` como `[{"item_id": …, "nome": …, "motivo": …}]`. No front, `web/src/shared/lib/erroRpc.ts` converte `PostgrestError` em mensagem + lista. Violação de FK (`23503`) numa exclusão vira "Possui histórico — desative".
- **Helpers da spec 001**, reutilizados em todas as políticas e RPCs: `eh_admin_ativo()`, `usuario_ativo()` e o trigger genérico `auditar()`. Para gravar motivo na auditoria, a RPC faz `set_config('app.motivo', motivo, true)` antes do `update`; RPCs de movimento de estoque (reserva, retirada, devolução, baixa) fazem `set_config('app.origem', 'movimentacao', true)` para o trigger não auditar contadores (spec-006/RF-05).
- **Bloqueio (P-04):** RPCs de estoque travam primeiro a `solicitacao` (`FOR UPDATE`) e depois os `item` **em ordem de `id`**, para evitar deadlock.
- **Contadores e `operante`:** `revoke insert/update` por coluna para `authenticated` em `quantidade_total`, `quantidade_reservada`, `quantidade_em_uso` e `operante`; só RPCs `SECURITY DEFINER` mexem (P-01).
- **Leitura agregada:** views com `security_invoker = true` (respeitam a RLS) para catálogo, filas e relatórios.
- **Teste de concorrência:** pgTAP roda numa transação só e não simula duas sessões. Concorrência fica em Vitest + `pg` com dois clientes contra o Postgres local (porta `54322`), em `supabase/tests/concorrencia/*.test.ts`, rodado por `npm run test:db:concorrencia` em `web/`. O nome do teste cita o CA.

### Front-end
- TypeScript estrito; sem `any` sem justificativa.
- **Só a camada `api` de cada feature acessa o cliente Supabase.** Componentes usam hooks (`useItens`, `useAprovarSolicitacao`).
- Cada feature expõe só o necessário; evite importar entre features, use `shared/`.
- Validação de formulário com Zod; mensagens de erro e textos da interface em **português do Brasil**.
- Carrinho vive em estado local (persistido no navegador); só a solicitação enviada vai ao banco.
- Validações no front são conveniência; a validação real está no banco.
- Componentes pequenos, nomes em inglês ou português de forma **consistente** com o código já existente (decisão do projeto: código e identificadores de domínio em português; termos técnicos de React/TS em inglês).

### Git
- Branches: `spec-NNN-nome` ou `feat/…`, `fix/…`. Nunca commitar direto na `main`.
- Commits pequenos, no padrão Conventional Commits em português, citando a spec: `feat(spec-004): aprovar_solicitacao com reserva (RF-04, CA-01)`.
- Nunca commitar `.env*`, chaves, senhas ou dumps com dados reais.

## Qualidade e testes

- Toda regra de negócio tem teste automatizado referenciando um `CA-xx` (Q-01). Nomeie o teste com o ID: `CA-03: aprovações simultâneas não reservam em dobro`.
- Funções RPC e políticas RLS são testadas no banco com pgTAP (Q-02). Teste sempre o caminho **negado** (usuário comum, pendente, inativo), não só o feliz.
- Concorrência de estoque precisa de teste com duas transações simultâneas.
- CI (`.github/workflows/ci.yml`, Q-03): ESLint, Prettier, `tsc --noEmit`, Vitest e build do front; migrations do zero, `supabase db lint` e `supabase test db` no banco. O passo pgTAP só roda quando existir algum `.sql` em `supabase/tests/`; a suíte de concorrência (`npm run test:db:concorrencia`) roda no mesmo job, e `lint`/`format:check`/`typecheck` também cobrem `supabase/tests/concorrencia/`. O Playwright entra no CI quando for criado (spec-005/T-15).
- Fluxo principal tem E2E: solicitar → aprovar → retirar → devolver (Q-04).
- Uma tarefa só está pronta quando os testes passam e a spec reflete o que foi entregue.

## Comandos

```bash
# Banco (Supabase local, requer Docker)
supabase start                      # sobe o ambiente local
supabase db reset                   # recria o banco: migrations + seed
supabase test db                    # roda testes pgTAP
supabase migration new <nome>       # nova migration
supabase gen types typescript --local > web/src/types/database.ts

# Banco remoto (sempre com confirmação explícita)
supabase link --project-ref <ref>   # staging ou produção
supabase db push                    # aplica migrations pendentes no projeto linkado
supabase config diff                # compara config.toml ([remotes.<ambiente>]) com o projeto linkado
supabase config push                # aplica a config do Auth (pede confirmação por recurso)

# Vercel
vercel                              # deploy de preview (ou /vercel:deploy)
vercel env pull                     # baixa variáveis (ou /vercel:env)
# vercel --prod                     # produção — só com confirmação (ver OPEN-01)

# Front (dentro de web/)
npm install
npm run dev
npm run lint
npm run typecheck                   # tsc --noEmit
npm run test                        # Vitest
npm run test:e2e                    # Playwright
npm run test:db:concorrencia        # concorrência no banco (Vitest + pg, requer supabase start)
```

> Ajuste os nomes dos scripts acima se o `package.json` usar outros.

## Segurança

- No front, **apenas a chave pública (anon)** do Supabase. A `service_role` nunca vai para o front nem para o Git.
- Variáveis de ambiente em `.env.local` (ignorado pelo Git); mantenha um `.env.example` sem segredos.
- O primeiro administrador é criado manualmente (SQL/seed); o resto da gestão de perfis é pela própria aplicação.
- Antes de concluir uma feature, tente acessar dados de outro usuário com token comum para validar o RLS.

## Como trabalhar neste projeto (instruções para o Claude)

1. Antes de implementar, identifique a spec e os `RF`/`CA` envolvidos; se não existirem, pare e proponha a spec.
2. Siga a ordem: **testes → migration/código → rodar testes → atualizar spec/tasks**.
3. Banco antes do front: não construa tela para uma regra que ainda não está no banco.
4. Prefira mudanças pequenas e revisáveis; não refatore código fora do escopo da tarefa.
5. Se uma regra nova surgir durante o trabalho, **registre na spec** (ou como `OPEN-xx`) em vez de decidir silenciosamente.
6. Ao terminar, resuma: o que mudou, quais `CA-xx` foram cobertos, o que ficou pendente.
7. Nunca execute comandos destrutivos (`db reset` em produção, `drop`, `git push --force`) sem confirmação explícita. O mesmo vale para ações remotas: `supabase db push`, deploy/promote/rollback de produção na Vercel e alteração de variáveis ou domínios.

## Fora de escopo (versão inicial)

Prazo de devolução e controle de atraso · multi-escola · app móvel nativo · QR code · notificação por e-mail (extra futuro).

## Decisões pendentes

Consulte os `OPEN-xx` em cada `spec.md`. Principais:
- Deploy de produção automático ou manual (constituição, OPEN-01) — *adiado até existir produção*.
