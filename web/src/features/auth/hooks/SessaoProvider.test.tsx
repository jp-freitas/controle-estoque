import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { Session } from '@supabase/supabase-js'
import { act, render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import * as api from '../api/sessaoApi'
import { SessaoProvider } from './SessaoProvider'
import { useSessao } from './sessaoContext'

vi.mock('../api/sessaoApi')

const sessaoDe = (id: string) => ({ user: { id } }) as Session
const perfilDe = (id: string): api.Perfil => ({
  id,
  nome: 'Prof. Teste',
  email: 'prof@escola.test',
  matricula: null,
  perfil: 'solicitante',
  status: 'ativo',
  criado_em: '',
  atualizado_em: '',
})

function Mostrar() {
  const { carregando, sessao, perfil } = useSessao()
  if (carregando) return <p>carregando</p>
  return <p>{sessao ? `logado:${perfil?.nome ?? 'sem perfil'}` : 'anônimo'}</p>
}

function renderizar(ui: ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <SessaoProvider>{ui}</SessaoProvider>
    </QueryClientProvider>,
  )
}

describe('T-21: useSessao', () => {
  let notificar: (s: Session | null) => void = () => {}

  beforeEach(() => {
    vi.mocked(api.observarSessao).mockImplementation((cb) => {
      notificar = cb
      return () => {}
    })
  })

  test('sem sessão: anônimo, sem buscar perfil', async () => {
    vi.mocked(api.obterSessao).mockResolvedValue(null)
    renderizar(<Mostrar />)
    expect(await screen.findByText('anônimo')).toBeInTheDocument()
    expect(api.buscarPerfil).not.toHaveBeenCalled()
  })

  test('com sessão: carrega o profiles do usuário', async () => {
    vi.mocked(api.obterSessao).mockResolvedValue(sessaoDe('u1'))
    vi.mocked(api.buscarPerfil).mockResolvedValue(perfilDe('u1'))
    renderizar(<Mostrar />)
    expect(await screen.findByText('logado:Prof. Teste')).toBeInTheDocument()
    expect(api.buscarPerfil).toHaveBeenCalledWith('u1')
  })

  test('RF-11: autenticado sem profiles (convite não aceito) → perfil nulo', async () => {
    vi.mocked(api.obterSessao).mockResolvedValue(sessaoDe('u2'))
    vi.mocked(api.buscarPerfil).mockResolvedValue(null)
    renderizar(<Mostrar />)
    expect(await screen.findByText('logado:sem perfil')).toBeInTheDocument()
  })

  test('acompanha login e logout feitos depois de abrir a página', async () => {
    vi.mocked(api.obterSessao).mockResolvedValue(null)
    vi.mocked(api.buscarPerfil).mockResolvedValue(perfilDe('u3'))
    renderizar(<Mostrar />)
    expect(await screen.findByText('anônimo')).toBeInTheDocument()

    act(() => notificar(sessaoDe('u3')))
    expect(await screen.findByText('logado:Prof. Teste')).toBeInTheDocument()

    act(() => notificar(null))
    expect(await screen.findByText('anônimo')).toBeInTheDocument()
  })
})
