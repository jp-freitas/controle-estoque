// spec-001/T-22 (RF-01) e T-24 (RF-11): telas de login, senha e primeiro acesso.
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import * as authApi from '../api/authApi'
import { perfilFalso, renderizarRotas, sessaoFalsa } from '../testing'
import { EntrarPage } from './EntrarPage'
import { PrimeiroAcessoPage } from './PrimeiroAcessoPage'
import { RecuperarSenhaPage } from './RecuperarSenhaPage'
import { RedefinirSenhaPage } from './RedefinirSenhaPage'

vi.mock('../api/authApi')

const rotas = [
  { path: '/entrar', element: <EntrarPage /> },
  { path: '/recuperar-senha', element: <RecuperarSenhaPage /> },
  { path: '/redefinir-senha', element: <RedefinirSenhaPage /> },
  { path: '/primeiro-acesso', element: <PrimeiroAcessoPage /> },
  { path: '/', element: <p>Início</p> },
]

describe('T-22 / RF-01: login', () => {
  test('valida os campos em pt-BR antes de chamar o Auth', async () => {
    renderizarRotas(rotas, '/entrar')
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }))
    expect(await screen.findByText('Informe o e-mail.')).toBeInTheDocument()
    expect(screen.getByText('Informe a senha.')).toBeInTheDocument()
    expect(authApi.entrar).not.toHaveBeenCalled()
  })

  test('envia e-mail e senha', async () => {
    vi.mocked(authApi.entrar).mockResolvedValue()
    renderizarRotas(rotas, '/entrar')
    await userEvent.type(screen.getByLabelText('E-mail'), ' prof@escola.test ')
    await userEvent.type(screen.getByLabelText('Senha'), 'Senha!123')
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }))
    expect(authApi.entrar).toHaveBeenCalledWith('prof@escola.test', 'Senha!123')
  })

  test('credenciais erradas → "E-mail ou senha incorretos."', async () => {
    vi.mocked(authApi.entrar).mockRejectedValue({ code: 'invalid_credentials', status: 400 })
    renderizarRotas(rotas, '/entrar')
    await userEvent.type(screen.getByLabelText('E-mail'), 'prof@escola.test')
    await userEvent.type(screen.getByLabelText('Senha'), 'errada')
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('E-mail ou senha incorretos.')
  })

  test('RF-03: não há link de cadastro', () => {
    renderizarRotas(rotas, '/entrar')
    expect(screen.queryByRole('link', { name: /cadastr|criar conta/i })).not.toBeInTheDocument()
  })
})

describe('T-22 / RF-01: recuperação de senha', () => {
  test('pede o link e não revela se o e-mail tem conta', async () => {
    vi.mocked(authApi.solicitarRecuperacao).mockResolvedValue()
    renderizarRotas(rotas, '/recuperar-senha')
    await userEvent.type(screen.getByLabelText('E-mail'), 'qualquer@escola.test')
    await userEvent.click(screen.getByRole('button', { name: 'Enviar link' }))
    expect(authApi.solicitarRecuperacao).toHaveBeenCalledWith('qualquer@escola.test')
    expect(
      await screen.findByText(/Se o e-mail estiver cadastrado, você vai receber um link/),
    ).toBeInTheDocument()
  })

  test('excesso de pedidos → mensagem amigável', async () => {
    vi.mocked(authApi.solicitarRecuperacao).mockRejectedValue({ status: 429 })
    renderizarRotas(rotas, '/recuperar-senha')
    await userEvent.type(screen.getByLabelText('E-mail'), 'prof@escola.test')
    await userEvent.click(screen.getByRole('button', { name: 'Enviar link' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/Aguarde um pouco/)
  })

  test('redefinir sem sessão (link vencido) orienta a pedir outro', () => {
    renderizarRotas(rotas, '/redefinir-senha')
    expect(screen.getByRole('heading', { name: 'Link inválido ou expirado' })).toBeInTheDocument()
  })

  test('redefinir com sessão do link: valida e salva a nova senha', async () => {
    vi.mocked(authApi.definirSenha).mockResolvedValue()
    renderizarRotas(rotas, '/redefinir-senha', { sessao: sessaoFalsa(), perfil: perfilFalso() })
    await userEvent.type(screen.getByLabelText('Nova senha'), '12345')
    await userEvent.type(screen.getByLabelText('Confirme a senha'), '12345')
    await userEvent.click(screen.getByRole('button', { name: 'Salvar senha' }))
    expect(
      await screen.findByText('A senha precisa ter pelo menos 6 caracteres.'),
    ).toBeInTheDocument()

    await userEvent.clear(screen.getByLabelText('Nova senha'))
    await userEvent.type(screen.getByLabelText('Nova senha'), 'NovaSenha!1')
    await userEvent.clear(screen.getByLabelText('Confirme a senha'))
    await userEvent.type(screen.getByLabelText('Confirme a senha'), 'OutraSenha!1')
    await userEvent.click(screen.getByRole('button', { name: 'Salvar senha' }))
    expect(await screen.findByText('As senhas não conferem.')).toBeInTheDocument()

    await userEvent.clear(screen.getByLabelText('Confirme a senha'))
    await userEvent.type(screen.getByLabelText('Confirme a senha'), 'NovaSenha!1')
    await userEvent.click(screen.getByRole('button', { name: 'Salvar senha' }))
    expect(await screen.findByRole('heading', { name: 'Senha alterada' })).toBeInTheDocument()
    expect(authApi.definirSenha).toHaveBeenCalledWith('NovaSenha!1')
  })
})

describe('T-24 / RF-11: primeiro acesso', () => {
  const preencher = async () => {
    await userEvent.type(screen.getByLabelText('Nova senha'), 'Convidado!1')
    await userEvent.type(screen.getByLabelText('Confirme a senha'), 'Convidado!1')
    await userEvent.click(screen.getByRole('button', { name: 'Criar senha e aceitar convite' }))
  }

  test('define a senha, aceita o convite e recarrega o perfil', async () => {
    vi.mocked(authApi.definirSenha).mockResolvedValue()
    vi.mocked(authApi.aceitarConvite).mockResolvedValue(perfilFalso({ status: 'pendente' }))
    const { valor } = renderizarRotas(rotas, '/primeiro-acesso', {
      sessao: sessaoFalsa('convidado@escola.test'),
    })
    expect(screen.getByText(/convidado@escola\.test/)).toBeInTheDocument()
    await preencher()
    expect(authApi.definirSenha).toHaveBeenCalledWith('Convidado!1')
    await vi.waitFor(() => expect(authApi.aceitarConvite).toHaveBeenCalled())
    await vi.waitFor(() => expect(valor.recarregarPerfil).toHaveBeenCalled())
  })

  test('CA-10: convite expirado mostra a mensagem do banco', async () => {
    vi.mocked(authApi.definirSenha).mockResolvedValue()
    vi.mocked(authApi.aceitarConvite).mockRejectedValue({
      code: 'P0001',
      message: 'Convite expirado. Peça um novo convite à administração da escola.',
    })
    renderizarRotas(rotas, '/primeiro-acesso', { sessao: sessaoFalsa() })
    await preencher()
    expect(await screen.findByRole('alert')).toHaveTextContent(/^Convite expirado/)
  })

  test('CA-11: convite cancelado mostra a mensagem do banco', async () => {
    vi.mocked(authApi.definirSenha).mockResolvedValue()
    vi.mocked(authApi.aceitarConvite).mockRejectedValue({
      code: 'P0001',
      message: 'Convite cancelado. Procure a administração da escola.',
    })
    renderizarRotas(rotas, '/primeiro-acesso', { sessao: sessaoFalsa() })
    await preencher()
    expect(await screen.findByRole('alert')).toHaveTextContent(/^Convite cancelado/)
  })

  test('sem sessão (link vencido) orienta a pedir reenvio', () => {
    renderizarRotas(rotas, '/primeiro-acesso')
    expect(screen.getByText(/peça à administração para reenviar/)).toBeInTheDocument()
  })

  test('convite já aceito não mostra o formulário de novo', async () => {
    const { router } = renderizarRotas(rotas, '/primeiro-acesso', {
      sessao: sessaoFalsa(),
      perfil: perfilFalso({ status: 'pendente' }),
    })
    expect(await screen.findByText('Início')).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/')
  })
})
