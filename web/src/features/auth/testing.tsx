// Utilitários de teste da feature auth: sessão falsa para renderizar telas e rotas.
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { Session } from '@supabase/supabase-js'
import { render } from '@testing-library/react'
import { createMemoryRouter, RouterProvider, type RouteObject } from 'react-router'
import type { Perfil } from './api/sessaoApi'
import { SessaoContext, type SessaoValor } from './hooks/sessaoContext'

export function perfilFalso(dados: Partial<Perfil> = {}): Perfil {
  return {
    id: 'u-teste',
    nome: 'Prof. Teste',
    email: 'prof@escola.test',
    matricula: null,
    perfil: 'solicitante',
    status: 'ativo',
    criado_em: '2026-10-23T00:00:00Z',
    atualizado_em: '2026-10-23T00:00:00Z',
    ...dados,
  }
}

export function sessaoFalsa(email = 'prof@escola.test'): Session {
  return { user: { id: 'u-teste', email } } as Session
}

export function valorSessao(dados: Partial<SessaoValor> = {}): SessaoValor {
  return {
    sessao: null,
    perfil: null,
    carregando: false,
    erroPerfil: false,
    sair: vi.fn().mockResolvedValue(undefined),
    recarregarPerfil: vi.fn().mockResolvedValue(undefined),
    ...dados,
  }
}

/** Renderiza as rotas num MemoryRouter com a sessão informada. */
export function renderizarRotas(
  rotas: RouteObject[],
  caminho: string,
  sessao: Partial<SessaoValor> = {},
) {
  const router = createMemoryRouter(rotas, { initialEntries: [caminho] })
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  const valor = valorSessao(sessao)
  return {
    router,
    valor,
    ...render(
      <QueryClientProvider client={qc}>
        <SessaoContext value={valor}>
          <RouterProvider router={router} />
        </SessaoContext>
      </QueryClientProvider>,
    ),
  }
}
