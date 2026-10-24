# Sistema de Controle de Inventário

Sistema web para uma escola controlar o inventário de **insumos**, **ferramentas** e **máquinas**. Professores solicitam a retirada de itens; administradores aprovam, registram a retirada e a devolução.

## Fluxo principal

```
Professor solicita → Sistema valida disponibilidade → Admin aprova → Retirada → Devolução
```

## Perfis

| Perfil | Pode |
|---|---|
| **Administrador** | Aprovar/recusar, registrar retirada e devolução, gerir itens, tipos, locais e usuários, ver relatórios e auditoria |
| **Solicitante** (professor) | Consultar o catálogo, montar o carrinho, solicitar retiradas e acompanhar as próprias solicitações |

## Tecnologias

- **Banco e autenticação:** Supabase (Postgres, Auth, RLS)
- **Regras de negócio:** funções RPC em Postgres
- **Front-end:** React, TypeScript, Vite, TanStack Query, React Hook Form, Zod, Tailwind
- **Hospedagem:** Vercel (front estático) + Supabase (local e staging/homologação em uso; produção planejada)

## Como o projeto é conduzido

O projeto usa **Spec Driven Development**: a especificação vem antes do código.

- [`specs/constitution.md`](specs/constitution.md): princípios do projeto
- `specs/NNN-nome/spec.md`: requisitos e critérios de aceite de cada funcionalidade
- [`CLAUDE.md`](CLAUDE.md): convenções e instruções para trabalhar com o Claude Code

## Como rodar

Pré-requisitos: Node.js 24 (`nvm use`, ver `.nvmrc`) e Docker Engine (no WSL2: `sudo bash scripts/setup-docker-wsl.sh`; detalhes em `CLAUDE.md` → Ambiente local). A Supabase CLI já vem como dependência de desenvolvimento em `web/` (use `npx supabase ... --workdir ..` de dentro de `web/`, ou instale a CLI globalmente).

```bash
# Banco local
supabase start
supabase db reset        # aplica migrations e seed
supabase test db         # roda os testes do banco

# Front-end
cd web
npm install
cp .env.example .env.local   # preencha com a URL e a chave anon do Supabase local
npm run dev
```

Verificações do front (dentro de `web/`): `npm run lint`, `npm run format:check`, `npm run typecheck`, `npm run test`, `npm run test:e2e`. Tipos do banco: `npm run db:types`.

## Status

Constituição e specs 001 a 007 com `spec.md`, `plan.md` e `tasks.md`. **Specs 001 (autenticação, convites e perfis) e 002 (catálogo: itens, tipos e locais) implementadas.** Próximas: 003 em diante.

Usuários do seed (só desenvolvimento local, senha `Senha!123`): `admin@escola.test` (admin ativo), `ativo@escola.test`, `pendente@escola.test`, `inativo@escola.test`. O seed também traz 3 locais e 7 itens de exemplo (um insumo no limite do estoque mínimo, um item inoperante e um desativado).