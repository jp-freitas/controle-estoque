// spec-001/T-25 (RF-10, RF-13), T-26 (RF-05, RF-06, RF-09, RF-16) e T-27 (RF-15).
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { perfilFalso, renderizarRotas, sessaoFalsa } from '@/features/auth/testing'
import * as api from '../api/usuariosApi'
import { ConvitesPage } from './ConvitesPage'
import { MeuPerfilPage } from './MeuPerfilPage'
import { UsuariosPage } from './UsuariosPage'

vi.mock('../api/usuariosApi')

const admin = perfilFalso({ id: 'admin-1', nome: 'Admin', perfil: 'admin' })
const sessao = { sessao: sessaoFalsa(), perfil: admin }
const rotas = [
  { path: '/convites', element: <ConvitesPage /> },
  { path: '/usuarios', element: <UsuariosPage /> },
  { path: '/meu-perfil', element: <MeuPerfilPage /> },
]

const convite = (dados: Partial<api.Convite>): api.Convite => ({
  id: 'c1',
  email: 'prof@escola.br',
  nome: 'Prof',
  matricula: null,
  perfil: 'solicitante',
  convidado_por: 'admin-1',
  criado_em: '2026-10-23T10:00:00Z',
  expira_em: '2026-10-30T10:00:00Z',
  aceito_em: null,
  cancelado_em: null,
  situacao: 'enviado',
  ...dados,
})

const linhaDe = (texto: string) => screen.getByRole('row', { name: new RegExp(texto) })

describe('T-25 / RF-10, RF-13: convites', () => {
  beforeEach(() => {
    vi.mocked(api.listarConvites).mockResolvedValue([
      convite({ id: 'c1', email: 'enviado@escola.br', situacao: 'enviado' }),
      convite({ id: 'c2', email: 'expirado@escola.br', situacao: 'expirado' }),
      convite({ id: 'c3', email: 'aceito@escola.br', situacao: 'aceito' }),
      convite({ id: 'c4', email: 'cancelado@escola.br', situacao: 'cancelado' }),
    ])
  })

  test('RF-10: convida e envia o e-mail; perfil padrão solicitante', async () => {
    vi.mocked(api.convidarUsuario).mockResolvedValue()
    vi.mocked(api.enviarEmailConvite).mockResolvedValue()
    renderizarRotas(rotas, '/convites', sessao)
    await userEvent.type(screen.getByLabelText('E-mail'), 'novo@escola.br')
    await userEvent.type(screen.getByLabelText('Nome'), 'Prof. Novo')
    await userEvent.click(screen.getByRole('button', { name: 'Enviar convite' }))

    expect(api.convidarUsuario).toHaveBeenCalledWith({
      email: 'novo@escola.br',
      nome: 'Prof. Novo',
      matricula: '',
      perfil: 'solicitante',
    })
    expect(api.enviarEmailConvite).toHaveBeenCalledWith('novo@escola.br')
    expect(await screen.findByText(/Convite enviado para novo@escola\.br/)).toBeInTheDocument()
  })

  test('CA-13: erro da RPC aparece como vem do banco e não envia e-mail', async () => {
    vi.mocked(api.convidarUsuario).mockRejectedValue({
      code: 'P0001',
      message: 'Já existe uma conta com este e-mail.',
    })
    renderizarRotas(rotas, '/convites', sessao)
    await userEvent.type(screen.getByLabelText('E-mail'), 'ativo@escola.test')
    await userEvent.type(screen.getByLabelText('Nome'), 'X')
    await userEvent.click(screen.getByRole('button', { name: 'Enviar convite' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Já existe uma conta com este e-mail.',
    )
    expect(api.enviarEmailConvite).not.toHaveBeenCalled()
  })

  test('convite registrado mas e-mail falhou: avisa e orienta a reenviar', async () => {
    vi.mocked(api.convidarUsuario).mockResolvedValue()
    vi.mocked(api.enviarEmailConvite).mockRejectedValue({ status: 429 })
    renderizarRotas(rotas, '/convites', sessao)
    await userEvent.type(screen.getByLabelText('E-mail'), 'novo@escola.br')
    await userEvent.type(screen.getByLabelText('Nome'), 'Prof. Novo')
    await userEvent.click(screen.getByRole('button', { name: 'Enviar convite' }))
    expect(
      await screen.findByText(/Convite registrado, mas o e-mail não foi enviado/),
    ).toHaveTextContent(/Reenviar/)
  })

  test('RF-13: lista com situação; reenviar só no válido, cancelar só nos não aceitos', async () => {
    renderizarRotas(rotas, '/convites', sessao)
    await screen.findByText('enviado@escola.br')

    expect(within(linhaDe('enviado@')).getByText('Enviado')).toBeInTheDocument()
    expect(
      within(linhaDe('enviado@')).getByRole('button', { name: 'Reenviar' }),
    ).toBeInTheDocument()
    expect(
      within(linhaDe('enviado@')).getByRole('button', { name: 'Cancelar' }),
    ).toBeInTheDocument()

    expect(within(linhaDe('expirado@')).queryByRole('button', { name: 'Reenviar' })).toBeNull()
    expect(
      within(linhaDe('expirado@')).getByRole('button', { name: 'Cancelar' }),
    ).toBeInTheDocument()

    expect(within(linhaDe('aceito@')).queryByRole('button')).toBeNull()
    expect(within(linhaDe('cancelado@')).queryByRole('button')).toBeNull()
  })

  test('RF-13: reenviar chama o envio do e-mail de novo', async () => {
    vi.mocked(api.enviarEmailConvite).mockResolvedValue()
    renderizarRotas(rotas, '/convites', sessao)
    await screen.findByText('enviado@escola.br')
    await userEvent.click(within(linhaDe('enviado@')).getByRole('button', { name: 'Reenviar' }))
    expect(api.enviarEmailConvite).toHaveBeenCalledWith('enviado@escola.br')
    expect(await screen.findByText('E-mail reenviado para enviado@escola.br.')).toBeInTheDocument()
  })

  test('RF-13: cancelar pede confirmação', async () => {
    vi.mocked(api.cancelarConvite).mockResolvedValue()
    renderizarRotas(rotas, '/convites', sessao)
    await screen.findByText('enviado@escola.br')
    await userEvent.click(within(linhaDe('enviado@')).getByRole('button', { name: 'Cancelar' }))
    const dialogo = await screen.findByRole('dialog')
    expect(api.cancelarConvite).not.toHaveBeenCalled()
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Cancelar convite' }))
    expect(api.cancelarConvite).toHaveBeenCalledWith('c1')
    expect(await screen.findByText('Convite de enviado@escola.br cancelado.')).toBeInTheDocument()
  })
})

describe('T-26 / RF-05, RF-09, RF-16: usuários', () => {
  const usuarios = [
    admin,
    perfilFalso({ id: 'u-pend', nome: 'Paula Pendente', email: 'p@e.br', status: 'pendente' }),
    perfilFalso({ id: 'u-ativo', nome: 'Ana Ativa', email: 'a@e.br', status: 'ativo' }),
    perfilFalso({ id: 'u-inat', nome: 'Ivo Inativo', email: 'i@e.br', status: 'inativo' }),
    perfilFalso({ id: 'admin-2', nome: 'Beto Admin', email: 'b@e.br', perfil: 'admin' }),
  ]
  beforeEach(() => vi.mocked(api.listarUsuarios).mockResolvedValue(usuarios))

  test('RF-09: filtra por status e por perfil', async () => {
    renderizarRotas(rotas, '/usuarios', sessao)
    await screen.findByText('Paula Pendente')
    await userEvent.selectOptions(screen.getByLabelText('Status'), 'pendente')
    expect(screen.getByText('Paula Pendente')).toBeInTheDocument()
    expect(screen.queryByText('Ana Ativa')).toBeNull()

    await userEvent.selectOptions(screen.getByLabelText('Status'), '')
    await userEvent.selectOptions(screen.getByLabelText('Perfil'), 'admin')
    expect(screen.getByText('Beto Admin')).toBeInTheDocument()
    expect(screen.queryByText('Paula Pendente')).toBeNull()
  })

  test('RF-06: na própria linha não há ações de status nem de perfil', async () => {
    renderizarRotas(rotas, '/usuarios', sessao)
    await screen.findByText('Paula Pendente')
    const minha = linhaDe('\\(você\\)')
    expect(
      within(minha).queryByRole('button', { name: /Inativar|Rebaixar|Promover|Aprovar/ }),
    ).toBeNull()
    expect(within(minha).getByRole('button', { name: 'Editar' })).toBeInTheDocument()
  })

  test('ações conforme o status: aprovar pendente, reativar inativo', async () => {
    renderizarRotas(rotas, '/usuarios', sessao)
    await screen.findByText('Paula Pendente')
    expect(within(linhaDe('Paula')).getByRole('button', { name: 'Aprovar' })).toBeInTheDocument()
    expect(within(linhaDe('Ivo')).getByRole('button', { name: 'Reativar' })).toBeInTheDocument()
    expect(within(linhaDe('Ivo')).queryByRole('button', { name: 'Inativar' })).toBeNull()
    expect(within(linhaDe('Ana')).getByRole('button', { name: 'Inativar' })).toBeInTheDocument()
    expect(within(linhaDe('Beto')).getByRole('button', { name: 'Rebaixar' })).toBeInTheDocument()
  })

  test('CA-03: aprovar com confirmação chama a RPC', async () => {
    vi.mocked(api.alterarStatusUsuario).mockResolvedValue(usuarios[1]!)
    renderizarRotas(rotas, '/usuarios', sessao)
    await screen.findByText('Paula Pendente')
    await userEvent.click(within(linhaDe('Paula')).getByRole('button', { name: 'Aprovar' }))
    await userEvent.click(
      within(await screen.findByRole('dialog')).getByRole('button', { name: 'Aprovar' }),
    )
    expect(api.alterarStatusUsuario).toHaveBeenCalledWith('u-pend', 'ativo')
    expect(await screen.findByText('Acesso de Paula Pendente aprovado.')).toBeInTheDocument()
  })

  test('CA-06: rebaixar outro admin chama alterar_perfil_usuario', async () => {
    vi.mocked(api.alterarPerfilUsuario).mockResolvedValue(usuarios[4]!)
    renderizarRotas(rotas, '/usuarios', sessao)
    await screen.findByText('Beto Admin')
    await userEvent.click(within(linhaDe('Beto')).getByRole('button', { name: 'Rebaixar' }))
    await userEvent.click(
      within(await screen.findByRole('dialog')).getByRole('button', { name: 'Rebaixar' }),
    )
    expect(api.alterarPerfilUsuario).toHaveBeenCalledWith('admin-2', 'solicitante')
  })

  test('RF-07: erro do banco aparece no diálogo como vem', async () => {
    vi.mocked(api.alterarStatusUsuario).mockRejectedValue({
      code: 'P0001',
      message: 'O sistema precisa de pelo menos um administrador ativo.',
    })
    renderizarRotas(rotas, '/usuarios', sessao)
    await screen.findByText('Beto Admin')
    await userEvent.click(within(linhaDe('Beto')).getByRole('button', { name: 'Inativar' }))
    const dialogo = await screen.findByRole('dialog')
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Inativar' }))
    expect(await within(dialogo).findByRole('alert')).toHaveTextContent(
      'O sistema precisa de pelo menos um administrador ativo.',
    )
  })

  test('RF-16 / CA-17: editar nome e matrícula; duplicada mostra a mensagem do banco', async () => {
    vi.mocked(api.atualizarUsuario).mockRejectedValueOnce({
      code: 'P0001',
      message: 'Matrícula já cadastrada.',
    })
    vi.mocked(api.atualizarUsuario).mockResolvedValueOnce(usuarios[2]!)
    renderizarRotas(rotas, '/usuarios', sessao)
    await screen.findByText('Ana Ativa')
    await userEvent.click(within(linhaDe('Ana')).getByRole('button', { name: 'Editar' }))
    const dialogo = await screen.findByRole('dialog')
    await userEvent.type(within(dialogo).getByLabelText('Matrícula (opcional)'), '12345')
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Salvar' }))
    expect(await within(dialogo).findByRole('alert')).toHaveTextContent('Matrícula já cadastrada.')

    await userEvent.click(within(dialogo).getByRole('button', { name: 'Salvar' }))
    expect(api.atualizarUsuario).toHaveBeenLastCalledWith('u-ativo', 'Ana Ativa', '12345')
    expect(await screen.findByText('Dados de Ana Ativa atualizados.')).toBeInTheDocument()
  })
})

describe('T-27 / RF-15, CA-16: meu perfil', () => {
  const eu = perfilFalso({ nome: 'Prof. Ativo', matricula: 'M-1', email: 'eu@escola.test' })

  test('mostra e-mail, perfil e status só para leitura', () => {
    renderizarRotas(rotas, '/meu-perfil', { sessao: sessaoFalsa(), perfil: eu })
    expect(screen.getByText('eu@escola.test')).toBeInTheDocument()
    expect(screen.getByText('Solicitante')).toBeInTheDocument()
    expect(screen.getByText('Ativo')).toBeInTheDocument()
    expect(screen.queryByLabelText(/E-mail|Perfil|Status/)).toBeNull()
  })

  test('CA-16: salva nome e matrícula e recarrega o perfil', async () => {
    vi.mocked(api.atualizarMeuPerfil).mockResolvedValue({ ...eu, nome: 'Prof. Silva' })
    const { valor } = renderizarRotas(rotas, '/meu-perfil', { sessao: sessaoFalsa(), perfil: eu })
    const nome = screen.getByLabelText('Nome')
    await userEvent.clear(nome)
    await userEvent.type(nome, 'Prof. Silva')
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }))
    expect(api.atualizarMeuPerfil).toHaveBeenCalledWith('Prof. Silva', 'M-1')
    expect(await screen.findByText('Perfil atualizado.')).toBeInTheDocument()
    expect(valor.recarregarPerfil).toHaveBeenCalled()
    expect(screen.getByLabelText('Nome')).toHaveValue('Prof. Silva')
  })

  test('nome em branco é barrado no formulário', async () => {
    renderizarRotas(rotas, '/meu-perfil', { sessao: sessaoFalsa(), perfil: eu })
    await userEvent.clear(screen.getByLabelText('Nome'))
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }))
    expect(await screen.findByText('Informe o nome.')).toBeInTheDocument()
    expect(api.atualizarMeuPerfil).not.toHaveBeenCalled()
  })
})
