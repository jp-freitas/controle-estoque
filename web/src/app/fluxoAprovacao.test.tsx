// spec-004/T-12 a T-15: telas de aprovação e o resultado em "Minhas solicitações"
// (RF-02 a RF-14; CA-01, CA-05, CA-06, CA-08, CA-11 a CA-13).
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import * as api from '@/features/aprovacao/api/aprovacaoApi'
import { quantidadeSugerida } from '@/features/aprovacao/components/sugestao'
import { perfilFalso, renderizarRotas, sessaoFalsa } from '@/features/auth/testing'
import * as catalogoApi from '@/features/catalogo/api/catalogoApi'
import * as solicitacoesApi from '@/features/solicitacoes/api/solicitacoesApi'
import { rotas } from './router'

vi.mock('@/features/aprovacao/api/aprovacaoApi')
vi.mock('@/features/catalogo/api/catalogoApi')
vi.mock('@/features/solicitacoes/api/solicitacoesApi')
vi.mock('@/features/carrinho/api/carrinhoApi')
vi.mock('@/features/itens-admin/api/itensAdminApi')
vi.mock('@/features/usuarios/api/usuariosApi')

const admin = perfilFalso({ id: 'admin-1', nome: 'Admin', perfil: 'admin' })
const sessaoAdmin = { sessao: sessaoFalsa(), perfil: admin }

const linha = (dados: Partial<api.LinhaFila>): api.LinhaFila => ({
  solicitacao_item_id: 'l1',
  item_id: 'i1',
  item_nome: 'Tesoura',
  quantidade_solicitada: 3,
  disponivel: 10,
  operante: true,
  ativo: true,
  ...dados,
})

const pendente = (dados: Partial<api.SolicitacaoPendente>): api.SolicitacaoPendente => ({
  id: 's1',
  criado_em: '2026-10-20T10:00:00Z',
  justificativa: 'Aula de artes',
  solicitante_id: 'prof-1',
  solicitante_nome: 'Ana',
  solicitante_status: 'ativo',
  itens: [linha({})],
  ...dados,
})

const cartaoDe = (nome: string) =>
  screen.getByRole('heading', { name: nome }).closest('li') as HTMLElement

beforeEach(() => {
  vi.mocked(catalogoApi.listarCatalogo).mockResolvedValue([])
  vi.mocked(api.listarAguardandoRetirada).mockResolvedValue([])
})

describe('T-13: sugestão de quantidade', () => {
  test('min(solicitada, disponível); 0 para inoperante, desativado ou sem estoque', () => {
    expect(quantidadeSugerida(linha({ quantidade_solicitada: 3, disponivel: 10 }))).toBe(3)
    expect(quantidadeSugerida(linha({ quantidade_solicitada: 3, disponivel: 2 }))).toBe(2)
    expect(quantidadeSugerida(linha({ disponivel: -1 }))).toBe(0)
    expect(quantidadeSugerida(linha({ operante: false }))).toBe(0)
    expect(quantidadeSugerida(linha({ ativo: false }))).toBe(0)
  })
})

describe('T-12 / T-13: fila e decisão', () => {
  test('RF-03: fila com solicitante, justificativa, solicitada e disponível; quantidade pré-preenchida', async () => {
    vi.mocked(api.listarFila).mockResolvedValue([
      pendente({
        itens: [
          linha({
            solicitacao_item_id: 'l1',
            item_nome: 'Cola',
            quantidade_solicitada: 5,
            disponivel: 2,
          }),
          linha({
            solicitacao_item_id: 'l2',
            item_nome: 'Serra',
            quantidade_solicitada: 1,
            operante: false,
          }),
        ],
      }),
    ])
    renderizarRotas(rotas, '/admin/aprovacoes', sessaoAdmin)
    const cartao = await screen.findByRole('heading', { name: 'Ana' }).then(() => cartaoDe('Ana'))
    expect(within(cartao).getByText('Aula de artes')).toBeInTheDocument()
    expect(within(cartao).getByLabelText('Quantidade aprovada de Cola')).toHaveValue(2)
    expect(within(cartao).getByLabelText('Quantidade aprovada de Serra')).toHaveValue(0)
    expect(within(cartao).getByText('Inoperante')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Pendentes (1)' })).toBeInTheDocument()
  })

  test('RF-04: aprova com as quantidades e a observação', async () => {
    vi.mocked(api.listarFila).mockResolvedValue([
      pendente({
        itens: [
          linha({ solicitacao_item_id: 'l1', item_nome: 'Cola', quantidade_solicitada: 5 }),
          linha({ solicitacao_item_id: 'l2', item_nome: 'Tesoura', quantidade_solicitada: 3 }),
        ],
      }),
    ])
    vi.mocked(api.aprovarSolicitacao).mockResolvedValue()
    renderizarRotas(rotas, '/admin/aprovacoes', sessaoAdmin)
    await screen.findByRole('heading', { name: 'Ana' })
    const cartao = cartaoDe('Ana')
    const tesoura = within(cartao).getByLabelText('Quantidade aprovada de Tesoura')
    await userEvent.clear(tesoura)
    await userEvent.type(tesoura, '2')
    await userEvent.type(within(cartao).getByLabelText(/Observação/), 'Só há 2 em estoque')
    await userEvent.click(within(cartao).getByRole('button', { name: 'Aprovar' }))
    expect(api.aprovarSolicitacao).toHaveBeenCalledWith(
      's1',
      [
        { solicitacao_item_id: 'l1', quantidade_aprovada: 5 },
        { solicitacao_item_id: 'l2', quantidade_aprovada: 2 },
      ],
      'Só há 2 em estoque',
    )
    expect(await screen.findByText('Solicitação de Ana aprovada.')).toBeInTheDocument()
  })

  test('quantidade acima da solicitada não chega a ser enviada', async () => {
    vi.mocked(api.listarFila).mockResolvedValue([pendente({})])
    renderizarRotas(rotas, '/admin/aprovacoes', sessaoAdmin)
    await screen.findByRole('heading', { name: 'Ana' })
    const campo = screen.getByLabelText('Quantidade aprovada de Tesoura')
    await userEvent.clear(campo)
    await userEvent.type(campo, '9')
    await userEvent.click(screen.getByRole('button', { name: 'Aprovar' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('entre 0 e a solicitada')
    expect(api.aprovarSolicitacao).not.toHaveBeenCalled()
  })

  test('CA-01: estoque insuficiente aparece na linha do item', async () => {
    vi.mocked(api.listarFila).mockResolvedValue([pendente({})])
    vi.mocked(api.aprovarSolicitacao).mockRejectedValue({
      code: 'P0001',
      message: 'Não foi possível aprovar. Confira os itens indicados.',
      details: JSON.stringify([
        { item_id: 'i1', nome: 'Tesoura', motivo: 'Estoque insuficiente: disponível 2.' },
      ]),
    })
    renderizarRotas(rotas, '/admin/aprovacoes', sessaoAdmin)
    await screen.findByRole('heading', { name: 'Ana' })
    await userEvent.click(screen.getByRole('button', { name: 'Aprovar' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível aprovar.')
    expect(screen.getByText('Recusado: Estoque insuficiente: disponível 2.')).toBeInTheDocument()
  })

  test('CA-05 / RF-02: a própria solicitação não tem botões de decisão', async () => {
    vi.mocked(api.listarFila).mockResolvedValue([
      pendente({ solicitante_id: 'admin-1', solicitante_nome: 'Admin' }),
    ])
    renderizarRotas(rotas, '/admin/aprovacoes', sessaoAdmin)
    await screen.findByText(/outro administrador precisa decidir/)
    expect(screen.queryByRole('button', { name: 'Aprovar' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Recusar' })).toBeNull()
  })

  test('CA-13 / RF-14: solicitante inativo é sinalizado; aprovar bloqueado, recusar não', async () => {
    vi.mocked(api.listarFila).mockResolvedValue([pendente({ solicitante_status: 'inativo' })])
    renderizarRotas(rotas, '/admin/aprovacoes', sessaoAdmin)
    await screen.findByText('Solicitante não está ativo')
    expect(screen.getByRole('button', { name: 'Aprovar' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Recusar' })).toBeEnabled()
  })

  test('CA-06 / RF-08: recusar exige motivo', async () => {
    vi.mocked(api.listarFila).mockResolvedValue([pendente({})])
    vi.mocked(api.recusarSolicitacao).mockResolvedValue()
    renderizarRotas(rotas, '/admin/aprovacoes', sessaoAdmin)
    await screen.findByRole('heading', { name: 'Ana' })
    await userEvent.click(screen.getByRole('button', { name: 'Recusar' }))
    const d = await screen.findByRole('dialog')
    await userEvent.click(within(d).getByRole('button', { name: 'Recusar' }))
    expect(within(d).getByText('Informe o motivo da recusa.')).toBeInTheDocument()
    expect(api.recusarSolicitacao).not.toHaveBeenCalled()
    await userEvent.type(within(d).getByLabelText('Motivo'), 'Item reservado para a feira')
    await userEvent.click(within(d).getByRole('button', { name: 'Recusar' }))
    expect(api.recusarSolicitacao).toHaveBeenCalledWith('s1', 'Item reservado para a feira')
    expect(await screen.findByText('Solicitação de Ana recusada.')).toBeInTheDocument()
  })
})

describe('T-14 / RF-10, RF-13: aguardando retirada', () => {
  const aprovada: api.SolicitacaoAprovada = {
    id: 's9',
    criado_em: '2026-10-10T10:00:00Z',
    data_decisao: '2026-10-14T10:00:00Z',
    dias_aguardando: 10,
    justificativa: 'Feira de ciências',
    observacao_decisao: null,
    solicitante_id: 'prof-2',
    solicitante_nome: 'Beto',
    aprovador_nome: 'Admin',
    itens: [
      {
        solicitacao_item_id: 'l9',
        item_id: 'i9',
        item_nome: 'Microscópio',
        quantidade_aprovada: 3,
      },
    ],
  }

  test('CA-12: mostra há quantos dias; CA-08: cancelar pede motivo', async () => {
    vi.mocked(api.listarFila).mockResolvedValue([])
    vi.mocked(api.listarAguardandoRetirada).mockResolvedValue([aprovada])
    vi.mocked(api.cancelarSolicitacaoAprovada).mockResolvedValue()
    renderizarRotas(rotas, '/admin/aprovacoes', sessaoAdmin)
    await userEvent.click(await screen.findByRole('button', { name: 'Aguardando retirada (1)' }))
    const linhaBeto = screen.getByRole('row', { name: /Beto/ })
    expect(within(linhaBeto).getByText('há 10 dias')).toBeInTheDocument()
    expect(within(linhaBeto).getByText('3 × Microscópio')).toBeInTheDocument()

    await userEvent.click(within(linhaBeto).getByRole('button', { name: 'Cancelar' }))
    const d = await screen.findByRole('dialog')
    await userEvent.type(within(d).getByLabelText('Motivo'), 'Não veio buscar')
    await userEvent.click(within(d).getByRole('button', { name: 'Cancelar solicitação' }))
    expect(api.cancelarSolicitacaoAprovada).toHaveBeenCalledWith('s9', 'Não veio buscar')
    expect(await screen.findByText(/a reserva foi liberada/)).toBeInTheDocument()
  })
})

describe('T-15 / RF-11, RF-12: o professor vê a decisão', () => {
  const base = {
    solicitante_id: 'prof-1',
    justificativa: 'Aula',
    criado_em: '2026-10-20T10:00:00Z',
    cancelado_em: null,
    aprovador_id: 'admin-1',
    data_decisao: '2026-10-21T10:00:00Z',
    observacao_decisao: null,
    motivo_recusa: null,
    cancelado_por_id: null,
    motivo_cancelamento: null,
  }

  test('CA-11: aprovação parcial com quantidade por item e observação; recusa com motivo', async () => {
    vi.mocked(solicitacoesApi.listarMinhasSolicitacoes).mockResolvedValue([
      {
        ...base,
        id: 's1',
        status: 'aprovada',
        observacao_decisao: 'Só há 2 em estoque',
        solicitacao_item: [
          {
            id: 'l1',
            solicitacao_id: 's1',
            item_id: 'i1',
            item_nome: 'Tesoura',
            quantidade_solicitada: 3,
            quantidade_aprovada: 2,
          },
          {
            id: 'l2',
            solicitacao_id: 's1',
            item_id: 'i2',
            item_nome: 'Serra',
            quantidade_solicitada: 1,
            quantidade_aprovada: 0,
          },
        ],
      },
      {
        ...base,
        id: 's2',
        status: 'recusada',
        motivo_recusa: 'Reservado para a feira',
        solicitacao_item: [
          {
            id: 'l3',
            solicitacao_id: 's2',
            item_id: 'i1',
            item_nome: 'Cola',
            quantidade_solicitada: 1,
            quantidade_aprovada: null,
          },
        ],
      },
    ])
    renderizarRotas(rotas, '/minhas-solicitacoes', {
      sessao: sessaoFalsa(),
      perfil: perfilFalso({ id: 'prof-1' }),
    })
    expect(await screen.findByText(/2 aprovado\(s\)/)).toBeInTheDocument()
    expect(screen.getByText(/não aprovado/)).toBeInTheDocument()
    expect(screen.getByText('Só há 2 em estoque')).toBeInTheDocument()
    expect(screen.getByText('Reservado para a feira')).toBeInTheDocument()
    expect(screen.getByText('Recusada')).toBeInTheDocument()
  })
})
