// spec-003/T-10 a T-12: carrinho e "Minhas solicitações" pelas rotas reais da aplicação
// (RF-02 a RF-09, CA-04, CA-05, CA-09).
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { perfilFalso, renderizarRotas, sessaoFalsa } from '@/features/auth/testing'
import * as carrinhoApi from '@/features/carrinho/api/carrinhoApi'
import * as catalogoApi from '@/features/catalogo/api/catalogoApi'
import { itemFalso } from '@/features/catalogo/testing'
import * as solicitacoesApi from '@/features/solicitacoes/api/solicitacoesApi'
import { rotas } from './router'

vi.mock('@/features/catalogo/api/catalogoApi')
vi.mock('@/features/carrinho/api/carrinhoApi')
vi.mock('@/features/solicitacoes/api/solicitacoesApi')
vi.mock('@/features/itens-admin/api/itensAdminApi')
vi.mock('@/features/usuarios/api/usuariosApi')

const prof = perfilFalso({ id: 'prof-1', nome: 'Prof. Ana' })
const sessao = { sessao: sessaoFalsa(), perfil: prof }
const CHAVE = 'estoque:carrinho:prof-1'

const catalogo = [
  itemFalso({ id: 'regua', nome: 'Régua', disponivel: 3, quantidade_total: 3 }),
  itemFalso({ id: 'serra', nome: 'Serra', disponivel: 1, quantidade_total: 1, operante: false }),
  itemFalso({
    id: 'lupa',
    nome: 'Lupa',
    disponivel: 0,
    quantidade_total: 2,
    quantidade_reservada: 2,
  }),
]

const linhaDe = (texto: string) => screen.getByRole('row', { name: new RegExp(texto) })

beforeEach(() => {
  localStorage.clear()
  vi.mocked(catalogoApi.listarCatalogo).mockResolvedValue(catalogo)
  vi.mocked(solicitacoesApi.listarMinhasSolicitacoes).mockResolvedValue([])
})

describe('T-11: do catálogo ao envio', () => {
  test('CA-05 / RF-04: só aparece "Adicionar" para item que pode ser solicitado', async () => {
    renderizarRotas(rotas, '/', sessao)
    await screen.findByText('Régua')
    expect(within(linhaDe('Régua')).getByRole('button', { name: /Adicionar Régua/ })).toBeEnabled()
    expect(within(linhaDe('Serra')).queryByRole('button', { name: /Adicionar/ })).toBeNull()
    expect(within(linhaDe('Lupa')).queryByRole('button', { name: /Adicionar/ })).toBeNull()
  })

  test('RF-02 / RF-04: adiciona até o disponível, conta no menu e salva no navegador', async () => {
    renderizarRotas(rotas, '/', sessao)
    const botao = await screen.findByRole('button', { name: /Adicionar Régua/ })
    for (let i = 0; i < 3; i++) await userEvent.click(botao)
    expect(within(linhaDe('Régua')).getByText('3 no carrinho')).toBeInTheDocument()
    expect(botao).toBeDisabled()
    expect(screen.getByRole('link', { name: 'Carrinho (1)' })).toBeInTheDocument()
    expect(JSON.parse(localStorage.getItem(CHAVE)!)).toEqual([
      { itemId: 'regua', nome: 'Régua', quantidade: 3 },
    ])
  })

  test('RF-05: envia itens e justificativa, esvazia o carrinho e mostra em "Minhas solicitações"', async () => {
    localStorage.setItem(CHAVE, JSON.stringify([{ itemId: 'regua', nome: 'Régua', quantidade: 2 }]))
    vi.mocked(carrinhoApi.enviarSolicitacao).mockResolvedValue('sol-1')
    renderizarRotas(rotas, '/carrinho', sessao)
    await screen.findByText('Disponível: 3')
    await userEvent.type(screen.getByLabelText(/Justificativa/), 'Aula de geometria 6º B')
    await userEvent.click(screen.getByRole('button', { name: 'Enviar solicitação' }))

    expect(carrinhoApi.enviarSolicitacao).toHaveBeenCalledWith(
      [{ item_id: 'regua', quantidade: 2 }],
      'Aula de geometria 6º B',
    )
    expect(await screen.findByRole('heading', { name: 'Minhas solicitações' })).toBeInTheDocument()
    expect(screen.getByText(/Solicitação enviada/)).toBeInTheDocument()
    expect(localStorage.getItem(CHAVE)).toBeNull()
    expect(screen.getByRole('link', { name: 'Carrinho' })).toBeInTheDocument()
  })

  test('CA-04: sem justificativa não envia', async () => {
    localStorage.setItem(CHAVE, JSON.stringify([{ itemId: 'regua', nome: 'Régua', quantidade: 1 }]))
    renderizarRotas(rotas, '/carrinho', sessao)
    await screen.findByText('Disponível: 3')
    await userEvent.click(screen.getByRole('button', { name: 'Enviar solicitação' }))
    expect(await screen.findByText(/Informe a justificativa/)).toBeInTheDocument()
    expect(carrinhoApi.enviarSolicitacao).not.toHaveBeenCalled()
  })

  test('RF-07: o motivo de cada item recusado aparece na linha dele', async () => {
    localStorage.setItem(CHAVE, JSON.stringify([{ itemId: 'regua', nome: 'Régua', quantidade: 3 }]))
    vi.mocked(carrinhoApi.enviarSolicitacao).mockRejectedValue({
      code: 'P0001',
      message: 'Alguns itens não podem ser solicitados.',
      details: JSON.stringify([{ item_id: 'regua', nome: 'Régua', motivo: 'Disponível: 1.' }]),
    })
    renderizarRotas(rotas, '/carrinho', sessao)
    await screen.findByText('Disponível: 3')
    await userEvent.type(screen.getByLabelText(/Justificativa/), 'Aula')
    await userEvent.click(screen.getByRole('button', { name: 'Enviar solicitação' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Alguns itens não podem ser solicitados.',
    )
    expect(within(linhaDe('Régua')).getByText('Recusado: Disponível: 1.')).toBeInTheDocument()
    expect(localStorage.getItem(CHAVE)).not.toBeNull()
  })

  test('RF-04: quantidade digitada acima do disponível fica no disponível', async () => {
    localStorage.setItem(CHAVE, JSON.stringify([{ itemId: 'regua', nome: 'Régua', quantidade: 1 }]))
    renderizarRotas(rotas, '/carrinho', sessao)
    const campo = await screen.findByLabelText('Quantidade de Régua')
    await userEvent.clear(campo)
    await userEvent.type(campo, '9')
    expect(campo).toHaveValue(3)
  })
})

describe('T-10 / CA-09: recarga da página', () => {
  test('restaura o carrinho salvo e confere com o catálogo, avisando o que mudou', async () => {
    localStorage.setItem(
      CHAVE,
      JSON.stringify([
        { itemId: 'regua', nome: 'Régua', quantidade: 5 },
        { itemId: 'serra', nome: 'Serra', quantidade: 1 },
        { itemId: 'lupa', nome: 'Lupa', quantidade: 1 },
        { itemId: 'sumiu', nome: 'Fantasma', quantidade: 1 },
      ]),
    )
    renderizarRotas(rotas, '/carrinho', sessao)
    expect(await screen.findByText(/conferido com o catálogo atual/)).toBeInTheDocument()
    expect(
      screen.getByText('A quantidade de Régua foi reduzida para 3 (disponível).'),
    ).toBeInTheDocument()
    expect(screen.getByText(/Lupa está sem unidades disponíveis/)).toBeInTheDocument()
    expect(screen.getByText(/Fantasma saiu do catálogo/)).toBeInTheDocument()
    expect(screen.getByLabelText('Quantidade de Régua')).toHaveValue(3)

    // RF-04: inoperante fica marcado e bloqueia o envio até ser removido
    expect(within(linhaDe('Serra')).getByText('Inoperante')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Enviar solicitação' })).toBeDisabled()
    await userEvent.click(screen.getByRole('button', { name: 'Remover Serra' }))
    expect(screen.getByRole('button', { name: 'Enviar solicitação' })).toBeEnabled()
    expect(JSON.parse(localStorage.getItem(CHAVE)!)).toEqual([
      { itemId: 'regua', nome: 'Régua', quantidade: 3 },
    ])
  })

  test('RF-02: o carrinho é de cada usuário', async () => {
    localStorage.setItem(
      'estoque:carrinho:outro',
      JSON.stringify([{ itemId: 'regua', nome: 'Régua', quantidade: 1 }]),
    )
    renderizarRotas(rotas, '/carrinho', sessao)
    expect(await screen.findByText(/O carrinho está vazio/)).toBeInTheDocument()
  })
})

describe('T-12 / RF-08, RF-09: minhas solicitações', () => {
  const solicitacao = (
    dados: Partial<solicitacoesApi.Solicitacao>,
  ): solicitacoesApi.Solicitacao => ({
    id: 's1',
    solicitante_id: 'prof-1',
    status: 'pendente',
    justificativa: 'Aula de física',
    criado_em: '2026-10-24T13:00:00Z',
    cancelado_em: null,
    solicitacao_item: [
      {
        id: 'l1',
        solicitacao_id: 's1',
        item_id: 'regua',
        item_nome: 'Régua',
        quantidade_solicitada: 2,
      },
    ],
    ...dados,
  })

  test('RF-08: lista status, data, justificativa e itens; só pendente pode ser cancelada', async () => {
    vi.mocked(solicitacoesApi.listarMinhasSolicitacoes).mockResolvedValue([
      solicitacao({ id: 's1' }),
      solicitacao({ id: 's2', status: 'aprovada', justificativa: 'Feira de ciências' }),
    ])
    renderizarRotas(rotas, '/minhas-solicitacoes', sessao)
    const lista = await screen.findByRole('list', { name: 'Solicitações' })
    // só os cartões (cada um tem a própria lista de itens dentro)
    const cartoes = within(lista)
      .getAllByRole('listitem')
      .filter((li) => li.parentElement === lista)
    expect(cartoes).toHaveLength(2)
    expect(within(cartoes[0]!).getByText('Pendente')).toBeInTheDocument()
    expect(within(cartoes[0]!).getByText('2 × Régua')).toBeInTheDocument()
    expect(within(cartoes[0]!).getByText('Aula de física')).toBeInTheDocument()
    expect(within(cartoes[0]!).getByRole('button', { name: 'Cancelar' })).toBeInTheDocument()
    expect(within(cartoes[1]!).getByText('Aprovada')).toBeInTheDocument()
    expect(within(cartoes[1]!).queryByRole('button', { name: 'Cancelar' })).toBeNull()
    expect(solicitacoesApi.listarMinhasSolicitacoes).toHaveBeenCalledWith('prof-1')
  })

  test('RF-09: cancelar pede confirmação e chama a RPC', async () => {
    vi.mocked(solicitacoesApi.listarMinhasSolicitacoes).mockResolvedValue([solicitacao({})])
    vi.mocked(solicitacoesApi.cancelarSolicitacao).mockResolvedValue()
    renderizarRotas(rotas, '/minhas-solicitacoes', sessao)
    await userEvent.click(await screen.findByRole('button', { name: 'Cancelar' }))
    expect(solicitacoesApi.cancelarSolicitacao).not.toHaveBeenCalled()
    await userEvent.click(
      within(await screen.findByRole('dialog')).getByRole('button', {
        name: 'Cancelar solicitação',
      }),
    )
    expect(solicitacoesApi.cancelarSolicitacao).toHaveBeenCalledWith('s1')
    expect(await screen.findByText('Solicitação cancelada.')).toBeInTheDocument()
  })

  test('CA-06: recusa do banco aparece no diálogo', async () => {
    vi.mocked(solicitacoesApi.listarMinhasSolicitacoes).mockResolvedValue([solicitacao({})])
    vi.mocked(solicitacoesApi.cancelarSolicitacao).mockRejectedValue({
      code: 'P0001',
      message: 'Solicitação já aprovada; peça ao administrador para cancelar.',
    })
    renderizarRotas(rotas, '/minhas-solicitacoes', sessao)
    await userEvent.click(await screen.findByRole('button', { name: 'Cancelar' }))
    const d = await screen.findByRole('dialog')
    await userEvent.click(within(d).getByRole('button', { name: 'Cancelar solicitação' }))
    expect(await within(d).findByRole('alert')).toHaveTextContent('Solicitação já aprovada')
  })
})
