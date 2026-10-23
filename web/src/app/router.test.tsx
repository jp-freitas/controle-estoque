// spec-001/T-23: guardas de rota por sessão, status e perfil (RF-04, RF-08).
import { screen } from '@testing-library/react'
import { perfilFalso, renderizarRotas, sessaoFalsa } from '@/features/auth/testing'
import { rotas } from './router'

// As telas de admin buscam dados; aqui só importa a guarda.
vi.mock('@/features/usuarios/api/usuariosApi')

const sessao = sessaoFalsa()

describe('T-23: guardas de rota', () => {
  test('RF-08: sem sessão, a área logada leva ao login', async () => {
    const { router } = renderizarRotas(rotas, '/')
    expect(await screen.findByRole('heading', { name: 'Entrar' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/entrar')
  })

  test('RF-11: logado sem profiles (convite não aceito) vai para o primeiro acesso', async () => {
    const { router } = renderizarRotas(rotas, '/', { sessao, perfil: null })
    expect(await screen.findByRole('heading', { name: /Crie sua senha/ })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/primeiro-acesso')
  })

  test('CA-02 / RF-04: pendente vê só "Aguardando liberação"', async () => {
    const { router } = renderizarRotas(rotas, '/', {
      sessao,
      perfil: perfilFalso({ status: 'pendente' }),
    })
    expect(await screen.findByRole('heading', { name: 'Aguardando liberação' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/aguardando')
    expect(screen.queryByRole('navigation', { name: 'Principal' })).not.toBeInTheDocument()
  })

  test('CA-02: pendente não entra em rota de admin pela URL', async () => {
    const { router } = renderizarRotas(rotas, '/admin/usuarios', {
      sessao,
      perfil: perfilFalso({ status: 'pendente', perfil: 'admin' }),
    })
    expect(await screen.findByRole('heading', { name: 'Aguardando liberação' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/aguardando')
  })

  test('RF-04: inativo vê só "Acesso desativado"', async () => {
    const { router } = renderizarRotas(rotas, '/meu-perfil', {
      sessao,
      perfil: perfilFalso({ status: 'inativo' }),
    })
    expect(await screen.findByRole('heading', { name: 'Acesso desativado' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/desativado')
  })

  test('ativo acessa o início, com o menu', async () => {
    renderizarRotas(rotas, '/', { sessao, perfil: perfilFalso() })
    expect(await screen.findByText('Em construção.')).toBeInTheDocument()
    expect(screen.getByRole('navigation', { name: 'Principal' })).toBeInTheDocument()
  })

  test('ativo não fica preso na tela de pendente', async () => {
    const { router } = renderizarRotas(rotas, '/aguardando', { sessao, perfil: perfilFalso() })
    expect(await screen.findByText('Em construção.')).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/')
  })

  test('RF-08: solicitante ativo não entra em rota de admin', async () => {
    const { router } = renderizarRotas(rotas, '/admin/usuarios', {
      sessao,
      perfil: perfilFalso(),
    })
    expect(await screen.findByText('Em construção.')).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/')
    expect(screen.queryByRole('link', { name: 'Usuários' })).not.toBeInTheDocument()
  })

  test('admin ativo entra nas rotas de admin', async () => {
    renderizarRotas(rotas, '/admin/usuarios', { sessao, perfil: perfilFalso({ perfil: 'admin' }) })
    expect(await screen.findByRole('heading', { name: 'Usuários' })).toBeInTheDocument()
  })

  test('URL desconhecida na área logada → página não encontrada', async () => {
    renderizarRotas(rotas, '/nao-existe', { sessao, perfil: perfilFalso() })
    expect(await screen.findByText('Página não encontrada.')).toBeInTheDocument()
  })

  test('admin ativo vê os links de administração', async () => {
    renderizarRotas(rotas, '/', { sessao, perfil: perfilFalso({ perfil: 'admin' }) })
    expect(await screen.findByRole('link', { name: 'Usuários' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Convites' })).toBeInTheDocument()
  })

  test('logado não vê a tela de login', async () => {
    const { router } = renderizarRotas(rotas, '/entrar', { sessao, perfil: perfilFalso() })
    expect(await screen.findByText('Em construção.')).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/')
  })
})
