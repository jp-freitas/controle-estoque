# Plano — 001 Auth

Decisões técnicas ("como") da spec 001. O comportamento está em `spec.md`.

## Redirect URLs do Supabase Auth (RF-01)

A recuperação de senha por e-mail envia um link que volta para o front. Cada projeto Supabase precisa aceitar o domínio do ambiente correspondente (constituição §11):

| Projeto Supabase | Site URL | Additional Redirect URLs |
|---|---|---|
| local (`supabase/config.toml`) | `http://127.0.0.1:5173` | `http://localhost:5173` |
| staging (a criar) | domínio de preview da Vercel | `https://<projeto>-*-<time>.vercel.app/**` |
| produção (planejado) | domínio de produção | — |

- No front, o `redirectTo` de `resetPasswordForEmail` usa `window.location.origin`, para funcionar em qualquer ambiente sem variável extra.
- Configurado em **Authentication → URL Configuration** de cada projeto remoto (configuração de projeto, não schema; não há migration).
- O link do convite (RF-11) também volta para essas URLs.

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

### E-mail

- Local: os e-mails caem no Mailpit (http://127.0.0.1:54324).
- Remoto (staging/produção): o SMTP padrão do Supabase tem limite de poucos e-mails por hora; configurar SMTP próprio antes de usar com a escola.
- O link do e-mail expira em `otp_expiry` (1 h no `config.toml`); se vencer dentro dos 7 dias do convite, o admin reenvia.

### Primeiro admin (RN-01)

Criado no `seed.sql`/SQL manual: usuário em `auth.users` + `profiles` com `perfil = admin`, `status = ativo`, sem passar por convite.

## Matrícula e edição de perfil (RF-15, RF-16, RN-05)

- Coluna `profiles.matricula text null`, com valor vazio normalizado para `null` (trim) nas RPCs.
- Unicidade (RN-05): índice único parcial em `profiles(matricula) where matricula is not null`. Entre convites em aberto e no cruzamento convite × `profiles`, a checagem fica em `convidar_usuario` e `aceitar_convite` (ver acima), com a mensagem "Matrícula já cadastrada".
- Edição: sem `update` direto em `profiles` pelo front. RPCs:
  - `atualizar_meu_perfil(nome, matricula)` — só usuário `ativo`, só a própria linha (RF-15);
  - `atualizar_usuario(id, nome, matricula)` — só admin ativo (RF-16).
  Assim, `email`, `perfil` e `status` não podem ser alterados por essas vias (RF-06, CA-16).
