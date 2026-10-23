# Plano — 001 Auth

Decisões técnicas ("como") da spec 001. O comportamento está em `spec.md`.

## Redirect URLs do Supabase Auth (RF-01)

A recuperação de senha por e-mail envia um link que volta para o front. Cada projeto Supabase precisa aceitar o domínio do ambiente correspondente (constituição §11):

| Projeto Supabase | Site URL | Additional Redirect URLs |
|---|---|---|
| local (`supabase/config.toml`) | `http://127.0.0.1:5173` | `http://localhost:5173/**`, `http://127.0.0.1:5173/**` |
| staging (a criar) | domínio de preview da Vercel | `https://<projeto>-*-<time>.vercel.app/**` |
| produção (planejado) | domínio de produção | — |

- No front, o `redirectTo` de `resetPasswordForEmail` usa `window.location.origin`, para funcionar em qualquer ambiente sem variável extra.
- Configurado em **Authentication → URL Configuration** de cada projeto remoto (configuração de projeto, não schema; não há migration).
- O link do convite (RF-11) também volta para essas URLs. Os destinos têm caminho (`/primeiro-acesso`, `/redefinir-senha`), por isso as URLs adicionais usam `/**`: sem isso o Auth descarta o destino e manda para a raiz do `site_url`.

## Convite (RF-03, RF-10 a RF-14)

Restrição: o convite nativo do Supabase (`auth.admin.inviteUserByEmail`) exige a `service_role`, que não pode ir para o front, e a constituição (I-01) não permite Edge Functions. O convite é feito só com Postgres + a API pública do Auth.

### Dados

Tabela `convite` (RLS habilitado):

| Coluna | Tipo | Observação |
|---|---|---|
| `id` | `uuid` PK | |
| `email` | `citext` | RN-03 (sem diferenciar maiúsculas) |
| `nome` | `text` | |
| `matricula` | `text` null | RN-05 |
| `perfil` | `perfil` (enum) | padrão `solicitante` |
| `convidado_por` | `uuid` → `profiles.id` | |
| `criado_em` | `timestamptz` | padrão `now()` |
| `expira_em` | `timestamptz` | `criado_em + interval '7 days'` (RF-12) |
| `aceito_em` | `timestamptz` null | |
| `cancelado_em` | `timestamptz` null | |

- A situação (`enviado` / `aceito` / `cancelado` / `expirado`) é **derivada** das datas (view ou coluna gerada na consulta), para não depender de job que marque expiração.
- Unicidade de convite em aberto por `email` (RF-14) e por `matricula` (RN-05) é checada **na RPC**, não por índice: "em aberto" depende de `now()` (expiração), o que não cabe num índice parcial — um convite expirado bloquearia o novo. Para evitar corrida entre dois admins, `convidar_usuario` serializa por e-mail/matrícula com `pg_advisory_xact_lock(hashtext(...))` (P-04). A checagem de "já tem conta" também fica na RPC.
- RLS: só admin ativo faz `select`; ninguém faz `insert/update/delete` direto — só pelas RPCs.

### Fluxo

1. **Admin cria o convite** → RPC `convidar_usuario(email, nome, matricula, perfil)` (`SECURITY DEFINER`, checa admin ativo; valida RF-14 e RN-05).
2. **Envio do e-mail** → em seguida o front do admin chama `supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: true, emailRedirectTo: <origin>/primeiro-acesso } })`. Isso só envia o link para o e-mail do convidado; a sessão do admin não muda. **Reenviar** (RF-13) é a mesma chamada.
3. **Barreira no Auth** → hook `before_user_created` (função Postgres, `[auth.hook.before_user_created]` no `config.toml`): rejeita a criação de qualquer usuário cujo e-mail não tenha convite em aberto (RF-03, CA-01). Vale para `signUp`, `signInWithOtp` e qualquer outra via.
4. **Aceite** → o convidado abre o link (fica autenticado), a tela `/primeiro-acesso` pede a senha (`auth.updateUser({ password })`) e chama a RPC `aceitar_convite()`, que:
   - busca o convite em aberto de `auth.email()` com `FOR UPDATE`;
   - rejeita se expirado ("Convite expirado", CA-10) ou cancelado (CA-11);
   - cria `profiles` com `email`, `nome`, `matricula`, `perfil` do convite e `status = pendente` (RN-04);
   - marca `aceito_em`.
5. **Cancelar** → RPC `cancelar_convite(id)`.

Sem `profiles`, o usuário autenticado não vê nada (RLS), então um usuário criado no passo 2 mas que nunca aceitou o convite não tem acesso.

### Achados do spike T-01 (2026-10-23, Supabase CLI 2.121, supabase-js 2.117)

Confirmado localmente; o fluxo acima se mantém, com estes ajustes:

- **Hook bloqueia `signUp` e `signInWithOtp`:** o front recebe `AuthApiError` com `status 403` e `message` igual à mensagem devolvida pelo hook; nenhuma linha em `auth.users`. O front exibe `error.message`.
- **Hook roda como `supabase_auth_admin`, sujeito a RLS.** A função do hook deve ser `SECURITY DEFINER` com `search_path` fixo (lê `convite`, que tem RLS) e **nunca lançar exceção**: qualquer erro interno vira `500 AuthRetryableFetchError` genérico ("Error running hook URI") no front. Grants: `execute` só para `supabase_auth_admin`, revogado de `anon`/`authenticated`/`public`.
- **`signInWithOtp` cria a linha em `auth.users` no envio**, não no clique, já com `email_confirmed_at` preenchido (local com `enable_confirmations = false`). Consequências:
  - "já tem conta" (RF-14, em `convidar_usuario`) é checado em **`profiles`**, não em `auth.users` — um convidado que recebeu o e-mail mas não aceitou já está em `auth.users`;
  - o hook só roda na **primeira** criação: reenvio, novo convite após expiração e OTP depois de cancelar não passam pelo hook. A barreira de cancelado/expirado é `aceitar_convite()` + RLS, como já previsto.
- **Link do e-mail:** `GET /auth/v1/verify` → `303` para `emailRedirectTo` (`/primeiro-acesso`) com `access_token`/`refresh_token` no fragmento (fluxo `implicit`, padrão do supabase-js). **Não usar `flowType: 'pkce'`**: o `code_verifier` ficaria no navegador do admin e o convidado não conseguiria trocar o código. `/primeiro-acesso` é aceito pela allow-list por estar sob o `site_url`.
- **Sessão do admin não muda** ao chamar `signInWithOtp` para outro e-mail (mesmo `access_token` antes e depois).
- Com a sessão do link, o convidado define a senha com `auth.updateUser({ password })` sem reautenticar (`secure_password_change = false`).
- O Auth grava o e-mail em minúsculas antes de chamar o hook; ainda assim, comparar via `citext` (RN-03).
- Reenvio por não-admin via API não é barrável no banco (OPEN-04, resolvido): o efeito é só um novo link no e-mail do convidado; acesso continua dependendo de `aceitar_convite()`.
- Reenvio em sequência rápida para o mesmo e-mail → `429 over_email_send_rate_limit` (`max_frequency`); a tela de convites deve tratar com mensagem amigável.
- O e-mail sai com o template padrão em inglês ("Your sign-in link"). Ver pendência em **E-mail**.
- Payload do hook: `event->'user'->>'email'` (também `id`, `app_metadata.provider`, `metadata.name = 'before-user-created'`).

### E-mail

- Local: os e-mails caem no Mailpit (http://127.0.0.1:54324).
- Remoto (staging/produção): o SMTP padrão do Supabase tem limite de poucos e-mails por hora; configurar SMTP próprio antes de usar com a escola.
- O link do e-mail expira em `otp_expiry` (1 h no `config.toml`); se vencer dentro dos 7 dias do convite, o admin reenvia.
- **Recuperação de senha em pt-BR (tarefa T-18b):** o template *recovery* (RF-01) também é em inglês por padrão; mesmo tratamento do convite, em `supabase/templates/recuperacao.html`.
- **Template em pt-BR (achado do T-01, tarefa T-18a):** o convite usa o template *magic link* do Auth, que por padrão é em inglês. Local: `[auth.email.template.magic_link]` no `config.toml` apontando para `supabase/templates/convite.html`; remoto: mesmo conteúdo no painel de cada projeto. Como o *magic link* também é o e-mail de qualquer login por OTP, e o sistema só usa OTP para convite, o texto pode falar diretamente do convite.

### Primeiro admin (RN-01)

Criado no `seed.sql`/SQL manual: usuário em `auth.users` + `profiles` com `perfil = admin`, `status = ativo`, sem passar por convite.

## Matrícula e edição de perfil (RF-15, RF-16, RN-05)

- Coluna `profiles.matricula text null`, com valor vazio normalizado para `null` (trim) nas RPCs.
- Unicidade (RN-05): índice único parcial em `profiles(matricula) where matricula is not null`. Entre convites em aberto e no cruzamento convite × `profiles`, a checagem fica em `convidar_usuario` e `aceitar_convite` (ver acima), com a mensagem "Matrícula já cadastrada".
- Edição: sem `update` direto em `profiles` pelo front. RPCs:
  - `atualizar_meu_perfil(nome, matricula)` — só usuário `ativo`, só a própria linha (RF-15);
  - `atualizar_usuario(id, nome, matricula)` — só admin ativo (RF-16).
  Assim, `email`, `perfil` e `status` não podem ser alterados por essas vias (RF-06, CA-16).

## Auditoria (RN-02, constituição P-06)

O modelo da auditoria é da **spec 006** (RF-01 a RF-12, RF-17). O **registro** é implementado nesta spec (T-03 a T-05), porque CA-03 e CA-06 daqui dependem dele; a spec 002 liga o mesmo trigger em `item`, `tipo_item` e `local`; a spec 006 entrega a consulta (RF-13 a RF-16).

- Tabela `auditoria` (spec-006/RF-01): `id bigint identity`, `tabela text`, `registro_id uuid`, `acao text` (`INSERT`/`UPDATE`/`DELETE`), `usuario_id uuid null` (`auth.uid()`; nulo = "Sistema"), `dados_antes jsonb`, `dados_depois jsonb`, `campos_alterados text[]`, `motivo text null`, `criado_em timestamptz default now()`. Índices em `(tabela, registro_id, criado_em desc)`, `usuario_id`, `criado_em`.
- Segurança (RF-10 a RF-12): RLS com `select` só para `eh_admin_ativo()`; `revoke insert, update, delete, truncate` de `anon` e `authenticated`; trigger `before update or delete` e `before truncate` em `auditoria` que sempre levanta erro (vale também para `service_role`).
- Trigger genérico `auditar()` (`after insert or update or delete`, `SECURITY DEFINER`, `search_path` fixo), na mesma transação (RF-08):
  - recebe por argumento as colunas **auditáveis** em update: em `profiles`, só `perfil` e `status` (spec-006/RF-06; `insert` sempre auditado);
  - calcula `campos_alterados`; se vazio, não grava (RF-07);
  - em `item`: se só mudaram contadores/`atualizado_em` e `current_setting('app.origem', true) = 'movimentacao'`, não grava (RF-05);
  - grava `motivo = nullif(current_setting('app.motivo', true), '')` (RF-17);
  - nunca copia colunas fora da tabela auditada (RF-09).
