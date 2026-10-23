// spec-001/T-23: guardas de rota por sessão, status e perfil (RF-04, RF-08).
import { screen } from '@testing-library/react'
import { perfilFalso, renderizarRotas, sessaoFalsa } from '@/features/auth/testing'
import { rotas } from './router'

import * as catalogoApi from '@/features/catalogo/api/catalogoApi'

// As telas buscam dados; aqui só importa a guarda.
vi.mock('@/features/usuarios/api/usuariosApi')
vi.mock('@/features/catalogo/api/catalogoApi')
vi.mock('@/features/itens-admin/api/itensAdminApi')
beforeEach(() => vi.mocked(catalogoApi.listarCatalogo).mockResolvedValue([]))

const inicio = () => screen.findByRole('heading', { name: 'Catálogo' })

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

  test('spec-002/RF-10: ativo acessa o catálogo como início, com o menu', async () => {
    renderizarRotas(rotas, '/', { sessao, perfil: perfilFalso() })
    expect(await inicio()).toBeInTheDocument()
    expect(screen.getByRole('navigation', { name: 'Principal' })).toBeInTheDocument()
  })

  test('ativo não fica preso na tela de pendente', async () => {
    const { router } = renderizarRotas(rotas, '/aguardando', { sessao, perfil: perfilFalso() })
    expect(await inicio()).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/')
  })

  test('RF-08: solicitante ativo não entra em rota de admin', async () => {
    const { router } = renderizarRotas(rotas, '/admin/usuarios', {
      sessao,
      perfil: perfilFalso(),
    })
    expect(await inicio()).toBeInTheDocument()
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
    for (const nome of ['Itens', 'Tipos', 'Locais'])
      expect(screen.getByRole('link', { name: nome })).toBeInTheDocument()
  })

  test('spec-002/RN-01: solicitante não vê nem entra no cadastro de itens', async () => {
    const { router } = renderizarRotas(rotas, '/admin/itens', { sessao, perfil: perfilFalso() })
    expect(await inicio()).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/')
    expect(screen.queryByRole('link', { name: 'Itens' })).not.toBeInTheDocument()
  })

  test('logado não vê a tela de login', async () => {
    const { router } = renderizarRotas(rotas, '/entrar', { sessao, perfil: perfilFalso() })
    expect(await inicio()).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/')
  })
})
