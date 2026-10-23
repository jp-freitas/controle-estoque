# Tarefas — 001 Auth

Ordem do projeto: **testes → migration/código → rodar testes → atualizar spec/tasks**, banco antes do front.
Cada tarefa cita os `RF`/`CA` que cobre. Marque `[x]` só quando os testes da tarefa passam.

Legenda: 🧪 teste primeiro · 🗄️ banco · 🖥️ front · 🔍 validação

---

## Fase 0 — Validação técnica do convite (antes de tudo)

O plano depende de dois comportamentos do Supabase Auth que precisam ser confirmados localmente antes de escrever o resto.

- [x] **T-01** 🔍 Spike (descartável, fora de `migrations/`): habilitar `[auth.hook.before_user_created]` no `config.toml` apontando para uma função que rejeita tudo, e confirmar:
  - `signUp` e `signInWithOtp({ shouldCreateUser: true })` são bloqueados com erro legível pelo front;
  - em que momento `signInWithOtp` cria a linha em `auth.users` (no envio ou no clique do link);
  - o e-mail chega no Mailpit e o link redireciona para `emailRedirectTo`;
  - `signInWithOtp` chamado pelo admin logado **não** altera a sessão dele.
  
  Se algo divergir do `plan.md`, **parar e atualizar o plano** antes da Fase 1.

  ✅ Concluído em 2026-10-23: os quatro pontos confirmados; ajustes registrados em `plan.md` → "Achados do spike T-01" (hook `SECURITY DEFINER` que nunca lança erro; "já tem conta" checado em `profiles`; manter fluxo `implicit`; tratar `429` no reenvio; template de e-mail em pt-BR pendente).

## Fase 1 — Base: perfis, auditoria e primeiro admin (RF-02, RF-06, RN-01, RN-02)

- [ ] **T-02** 🧪 pgTAP `001_profiles_schema.test.sql`: estrutura de `profiles` (colunas, enums `perfil` e `status_usuario`, `matricula` nullable), RLS habilitado em `profiles` e `auditoria`, índice único parcial de `matricula`.
- [ ] **T-03** 🗄️ Migration `001_perfis_e_auditoria`:
  - extensão `citext`; enums `perfil` (`admin`, `solicitante`) e `status_usuario` (`pendente`, `ativo`, `inativo`);
  - `profiles` (`id` → `auth.users`, `nome`, `email citext unique`, `matricula`, `perfil`, `status`, timestamps);
  - `auditoria` conforme spec-006/RF-01 e `plan.md` → Auditoria, com revokes e trigger de bloqueio de `update`/`delete`/`truncate` (spec-006/RF-10 a RF-12, P-06);
  - funções auxiliares `eh_admin_ativo()` e `usuario_ativo()` (`SECURITY DEFINER`, `search_path` fixo) usadas pelas políticas.
- [ ] **T-04** 🧪 pgTAP `001_auditoria.test.sql` — **RN-02/CA-03, CA-06**: mudança de `perfil`/`status` grava linha em `auditoria` com antes/depois, autor e motivo (`app.motivo`), conforme `plan.md` → Auditoria; cobre também spec-006 CA-07, CA-08, CA-11 a CA-13 no que toca `profiles`; `update`/`delete` em `auditoria` é negado inclusive para admin.
- [ ] **T-05** 🗄️ Trigger de auditoria em `profiles` (perfil/status) — base reutilizada pela spec 002 (`item`, `tipo_item`, `local`).
- [ ] **T-06a** 🧪 Suíte de concorrência: `supabase/tests/concorrencia/` com Vitest + `pg` (devDependency em `web/`), helper para abrir duas sessões autenticadas como usuários diferentes contra o Postgres local, script `npm run test:db:concorrencia` (ver `CLAUDE.md` → Banco). Usada por T-09, T-13 e pelas specs 004/005.
- [ ] **T-06** 🗄️ `seed.sql`: primeiro admin (`auth.users` + `profiles` `admin`/`ativo`) e um solicitante de exemplo de cada status, com senha conhecida só para dev (RN-01).

## Fase 2 — RLS e gestão de usuários (RF-04 a RF-07, RF-09, RF-15, RF-16)

- [ ] **T-07** 🧪 pgTAP `001_profiles_rls.test.sql`:
  - **CA-02**: `pendente` não lê nada além do próprio `profiles`;
  - **CA-07**: `inativo` não escreve nada;
  - solicitante ativo lê só o próprio perfil; admin ativo lê todos (RF-09);
  - `update` direto em `profiles` é negado para todos (só por RPC).
- [ ] **T-08** 🗄️ Políticas RLS de `profiles` conforme T-07.
- [ ] **T-09** 🧪 pgTAP `001_gestao_usuarios.test.sql`:
  - **CA-03**: admin aprova `pendente → ativo`, com auditoria;
  - **CA-04**: solicitante tentando virar admin (RPC e `update` direto) → negado;
  - **CA-05**: único admin ativo não se rebaixa nem se inativa, com mensagem clara;
  - **CA-06**: com dois admins, um rebaixa o outro;
  - **RF-07** com concorrência: dois admins se rebaixando ao mesmo tempo não zeram os admins ativos — teste na suíte de concorrência (T-06a), não em pgTAP.
  - caminhos negados: solicitante, pendente e inativo chamando cada RPC.
- [ ] **T-10** 🗄️ RPCs `alterar_status_usuario(id, status)` e `alterar_perfil_usuario(id, perfil)`: admin ativo, nunca a si mesmo em perfil/status (RF-06), trava de último admin com `FOR UPDATE` (RF-07, P-04, P-08).
- [ ] **T-11** 🧪 pgTAP `001_editar_perfil.test.sql`:
  - **CA-16**: usuário ativo edita o próprio `nome`/`matricula`; não há via para mudar `email`/`perfil`/`status`;
  - **CA-17**: matrícula duplicada → "Matrícula já cadastrada";
  - RF-16: admin edita nome/matrícula de outro; solicitante não edita outro.
- [ ] **T-12** 🗄️ RPCs `atualizar_meu_perfil(nome, matricula)` e `atualizar_usuario(id, nome, matricula)` (trim, vazio → `null`).

## Fase 3 — Convite (RF-03, RF-10 a RF-14, RN-03 a RN-05)

- [ ] **T-13** 🧪 pgTAP `001_convite.test.sql`:
  - **CA-08**: admin cria convite com e-mail, nome, matrícula e perfil; situação `enviado`, validade 7 dias;
  - **CA-12**: solicitante/pendente/inativo não criam, listam, reenviam nem cancelam;
  - **CA-13**: e-mail com conta ou com convite em aberto → rejeitado; e-mail com convite **expirado** → permitido;
  - **CA-17**: matrícula de usuário ou de convite em aberto → rejeitada;
  - RN-03: `Prof@Escola.br` e `prof@escola.br` são o mesmo e-mail;
  - concorrência: dois admins convidando o mesmo e-mail ao mesmo tempo → só um convite — teste na suíte de concorrência (T-06a).
- [ ] **T-14** 🗄️ Migration `001_convite`: tabela `convite`, view/função de situação derivada, RLS (só `select` para admin ativo), RPCs `convidar_usuario` e `cancelar_convite` com `pg_advisory_xact_lock`.
- [ ] **T-15** 🧪 pgTAP `001_aceitar_convite.test.sql`:
  - **CA-09**: aceite válido cria `profiles` `pendente` com e-mail, nome e perfil do convite; convite vira `aceito`;
  - **CA-10**: convite com mais de 7 dias → "Convite expirado";
  - **CA-11**: convite cancelado → rejeitado;
  - **CA-14**: convite com perfil `admin` → usuário `pendente`, sem poderes até aprovação;
  - **CA-15 / CA-18**: matrícula copiada / ausente sem erro;
  - aceitar duas vezes não cria dois perfis.
- [ ] **T-16** 🗄️ RPC `aceitar_convite()`.
- [ ] **T-17** 🧪 pgTAP `001_hook_cadastro.test.sql` — **CA-01**: hook `before_user_created` rejeita e-mail sem convite em aberto (inclui expirado e cancelado) e aceita e-mail com convite válido.
- [ ] **T-18** 🗄️ Função do hook + `[auth.hook.before_user_created]` no `config.toml`.
- [ ] **T-18a** 🗄️ **RF-11**: template do e-mail de convite em pt-BR (achado do T-01). O convite usa o template *magic link* do Auth, que é em inglês por padrão. Criar `supabase/templates/convite.html` (assunto e corpo em pt-BR, link `{{ .ConfirmationURL }}`, aviso de que o convite vale 7 dias e o link 1 h) e apontar `[auth.email.template.magic_link]` no `config.toml` (`subject` + `content_path`). Verificar no Mailpit. Nos projetos remotos, o mesmo template é configurado no painel quando staging/produção forem criados.
- [ ] **T-19** 🔍 Rodar `supabase db reset` + `supabase test db` completos; `get_advisors` não se aplica (só local) — revisar manualmente: RLS em todas as tabelas novas, `search_path` fixo em toda `SECURITY DEFINER`, `grant execute` só para `authenticated`.
- [ ] **T-20** 🗄️ `npm run db:types` e commit de `web/src/types/database.ts`.

## Fase 4 — Front (RF-01, RF-04, RF-08 a RF-16)

Estrutura em `web/src/features/auth/` e `web/src/features/usuarios/` (`components`, `hooks`, `api`, `schemas`, `types`). Só a camada `api` usa o cliente Supabase.

- [ ] **T-21** 🖥️ Sessão e perfil: provider/hook `useSessao` (sessão do Auth + `profiles` do usuário), com teste Vitest.
- [ ] **T-22** 🖥️ **RF-01**: telas de login, logout e recuperação de senha (`resetPasswordForEmail` com `redirectTo = window.location.origin`), Zod com mensagens em pt-BR. Não há tela de cadastro (RF-03).
- [ ] **T-23** 🖥️ **RF-04 / RF-08**: guarda de rotas por status e perfil; telas "Aguardando liberação" e "Acesso desativado". Teste Vitest de cada caso.
- [ ] **T-24** 🖥️ **RF-11**: tela `/primeiro-acesso` (definir senha → `aceitar_convite()`), com mensagens para convite expirado/cancelado.
- [ ] **T-25** 🖥️ **RF-10, RF-13**: área do admin "Convites": formulário (e-mail, nome, matrícula opcional, perfil padrão `solicitante`), lista com situação, reenviar (só válido) e cancelar.
- [ ] **T-26** 🖥️ **RF-05, RF-09, RF-16**: área do admin "Usuários": lista com filtros por status/perfil, aprovar, inativar/reativar, promover/rebaixar, editar nome/matrícula; erros das RPCs exibidos como vêm do banco.
- [ ] **T-27** 🖥️ **RF-15**: tela "Meu perfil" (nome e matrícula editáveis; e-mail, perfil e status só leitura).

## Fase 5 — E2E e fechamento

- [ ] **T-28** 🧪 Playwright `e2e/001-convite.spec.ts`: admin convida → e-mail no Mailpit → convidado define senha → vê "aguardando liberação" → admin aprova → convidado entra.
- [ ] **T-29** 🔍 Teste manual de RLS com token comum (CLAUDE.md, Segurança): com o token de um solicitante, tentar ler `convite`, ler outros `profiles` e chamar as RPCs de admin pela API REST.
- [ ] **T-30** 🔍 CI verde: lint, Prettier, `typecheck`, Vitest, `supabase test db` (Q-03).
- [ ] **T-31** 📝 Atualizar `spec.md`/`plan.md` com o que foi entregue (inclusive achados do T-01) e abrir PR `spec-001-auth` citando os CA cobertos.

---

## Cobertura de critérios de aceite

| CA | Tarefa de teste |
|---|---|
| CA-01 | T-17 |
| CA-02 | T-07, T-23 |
| CA-03 | T-04, T-09 |
| CA-04 | T-09 |
| CA-05 | T-09 |
| CA-06 | T-04, T-09 |
| CA-07 | T-07 |
| CA-08 | T-13 |
| CA-09 | T-15, T-28 |
| CA-10 | T-15 |
| CA-11 | T-15 |
| CA-12 | T-13 |
| CA-13 | T-13 |
| CA-14 | T-15 |
| CA-15 | T-15 |
| CA-16 | T-11 |
| CA-17 | T-11, T-13 |
| CA-18 | T-15 |
