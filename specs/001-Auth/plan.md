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
- Se OPEN-02 (confirmação de e-mail) for adotado, o mesmo vale para o link de confirmação.
