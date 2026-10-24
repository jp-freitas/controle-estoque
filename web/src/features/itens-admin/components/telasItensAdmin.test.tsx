// spec-002/T-17 (RF-03, RF-04), T-18 (RF-05, RF-07, RF-08, CA-08) e T-19 (RF-09, RF-14).
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { perfilFalso, renderizarRotas, sessaoFalsa } from '@/features/auth/testing'
import * as catalogoApi from '@/features/catalogo/api/catalogoApi'
import { itemFalso } from '@/features/catalogo/testing'
import * as api from '../api/itensAdminApi'
import { ItensPage } from './ItensPage'
import { LocaisPage } from './LocaisPage'
import { TiposPage } from './TiposPage'

vi.mock('../api/itensAdminApi')
vi.mock('@/features/catalogo/api/catalogoApi')

const sessao = { sessao: sessaoFalsa(), perfil: perfilFalso({ perfil: 'admin' }) }
const rotas = [
  { path: '/tipos', element: <TiposPage /> },
  { path: '/locais', element: <LocaisPage /> },
  { path: '/itens', element: <ItensPage /> },
]
const linhaDe = (texto: string) => screen.getByRole('row', { name: new RegExp(texto) })
const dialogo = () => screen.findByRole('dialog')
const historico = { code: '23503', message: 'violates foreign key constraint' }

const tipos: api.Tipo[] = [
  { id: 't-ferr', nome: 'Ferramenta', consumivel: false, ativo: true },
  { id: 't-ins', nome: 'Insumo', consumivel: true, ativo: true },
  { id: 't-velho', nome: 'Velho', consumivel: false, ativo: false },
]
const locais: api.Local[] = [
  { id: 'l-alm', nome: 'Almoxarifado', descricao: 'Bloco A', ativo: true },
  { id: 'l-fech', nome: 'Sala fechada', descricao: null, ativo: false },
]

beforeEach(() => {
  vi.mocked(api.listarTipos).mockResolvedValue(tipos)
  vi.mocked(api.listarLocais).mockResolvedValue(locais)
})

describe('T-17 / RF-03: tipos', () => {
  test('RF-03: cria tipo definindo consumível', async () => {
    vi.mocked(api.criarTipo).mockResolvedValue()
    renderizarRotas(rotas, '/tipos', sessao)
    await screen.findByText('Velho')
    await userEvent.type(screen.getByLabelText('Nome'), 'Kit didático')
    await userEvent.click(screen.getByLabelText(/Consumível/))
    await userEvent.click(screen.getByRole('button', { name: 'Criar tipo' }))
    expect(api.criarTipo).toHaveBeenCalledWith({ nome: 'Kit didático', consumivel: true })
    expect(await screen.findByText('Tipo Kit didático criado.')).toBeInTheDocument()
  })

  test('CA-13: desativar tipo com itens ativos mostra a mensagem do banco', async () => {
    vi.mocked(api.atualizarTipo).mockRejectedValue({
      code: 'P0001',
      message: 'Há 2 itens ativos deste tipo. Mova ou desative esses itens antes.',
    })
    renderizarRotas(rotas, '/tipos', sessao)
    await screen.findByText('Ferramenta')
    await userEvent.click(within(linhaDe('Ferramenta')).getByRole('button', { name: 'Desativar' }))
    await userEvent.click(within(await dialogo()).getByRole('button', { name: 'Desativar' }))
    expect(api.atualizarTipo).toHaveBeenCalledWith('t-ferr', { ativo: false })
    expect(await screen.findByRole('alert')).toHaveTextContent('Há 2 itens ativos deste tipo.')
  })

  test('RF-03: tipo em uso não é excluído; o diálogo oferece desativar', async () => {
    vi.mocked(api.excluirTipo).mockRejectedValue(historico)
    vi.mocked(api.atualizarTipo).mockResolvedValue()
    renderizarRotas(rotas, '/tipos', sessao)
    await screen.findByText('Ferramenta')
    await userEvent.click(within(linhaDe('Ferramenta')).getByRole('button', { name: 'Excluir' }))
    await userEvent.click(within(await dialogo()).getByRole('button', { name: 'Excluir' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Possui histórico')
    await userEvent.click(within(await dialogo()).getByRole('button', { name: 'Desativar' }))
    expect(api.atualizarTipo).toHaveBeenCalledWith('t-ferr', { ativo: false })
    expect(await screen.findByText('Tipo Ferramenta desativado.')).toBeInTheDocument()
  })

  test('CA-14: editar consumível de tipo com itens mostra a recusa do banco', async () => {
    vi.mocked(api.atualizarTipo).mockRejectedValue({
      code: 'P0001',
      message: 'Este tipo já tem itens; não é possível mudar se é consumível.',
    })
    renderizarRotas(rotas, '/tipos', sessao)
    await screen.findByText('Ferramenta')
    await userEvent.click(within(linhaDe('Ferramenta')).getByRole('button', { name: 'Editar' }))
    const d = await dialogo()
    await userEvent.click(within(d).getByLabelText(/Consumível/))
    await userEvent.click(within(d).getByRole('button', { name: 'Salvar' }))
    expect(api.atualizarTipo).toHaveBeenCalledWith('t-ferr', {
      nome: 'Ferramenta',
      consumivel: true,
    })
    expect(await within(d).findByRole('alert')).toHaveTextContent('Este tipo já tem itens')
  })
})

describe('T-17 / RF-04: locais', () => {
  test('RF-04: cria local; descrição vazia vira nula', async () => {
    vi.mocked(api.criarLocal).mockResolvedValue()
    renderizarRotas(rotas, '/locais', sessao)
    await screen.findByText('Almoxarifado')
    await userEvent.type(screen.getByLabelText('Nome'), 'Laboratório')
    await userEvent.click(screen.getByRole('button', { name: 'Criar local' }))
    expect(api.criarLocal).toHaveBeenCalledWith({ nome: 'Laboratório', descricao: null })
  })

  test('RF-04: nome repetido mostra mensagem amigável', async () => {
    vi.mocked(api.criarLocal).mockRejectedValue({
      code: '23505',
      message: 'duplicate key value violates unique constraint "local_nome_key"',
    })
    renderizarRotas(rotas, '/locais', sessao)
    await screen.findByText('Almoxarifado')
    await userEvent.type(screen.getByLabelText('Nome'), 'almoxarifado')
    await userEvent.click(screen.getByRole('button', { name: 'Criar local' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Já existe um local com este nome.')
  })

  test('RF-04: reativa local desativado', async () => {
    vi.mocked(api.atualizarLocal).mockResolvedValue()
    renderizarRotas(rotas, '/locais', sessao)
    await screen.findByText('Sala fechada')
    await userEvent.click(within(linhaDe('Sala fechada')).getByRole('button', { name: 'Reativar' }))
    await userEvent.click(within(await dialogo()).getByRole('button', { name: 'Reativar' }))
    expect(api.atualizarLocal).toHaveBeenCalledWith('l-fech', { ativo: true })
  })
})

describe('T-18 / T-19: itens', () => {
  const itens = [
    itemFalso({ id: 'i-1', nome: 'Chave de fenda' }),
    itemFalso({
      id: 'i-2',
      nome: 'Furadeira',
      tipo_id: 't-ferr',
      quantidade_total: 1,
      quantidade_reservada: 1,
      disponivel: 0,
      numero_patrimonio: 'PAT-1',
      operante: false,
    }),
    itemFalso({ id: 'i-3', nome: 'Termômetro', ativo: false }),
  ]
  beforeEach(() => vi.mocked(catalogoApi.listarCatalogo).mockResolvedValue(itens))

  const abrirNovo = async () => {
    renderizarRotas(rotas, '/itens', sessao)
    await screen.findByText('Chave de fenda')
    await userEvent.click(screen.getByRole('button', { name: 'Novo item' }))
    return dialogo()
  }

  test('RF-08: desativados só com "Mostrar desativados"', async () => {
    renderizarRotas(rotas, '/itens', sessao)
    await screen.findByText('Chave de fenda')
    expect(screen.queryByText('Termômetro')).toBeNull()
    await userEvent.click(screen.getByLabelText('Mostrar desativados'))
    expect(screen.getByText('Termômetro')).toBeInTheDocument()
  })

  test('CA-03: cadastra item com quantidade; só tipos e locais ativos são oferecidos', async () => {
    vi.mocked(api.criarItem).mockResolvedValue()
    const d = await abrirNovo()
    await within(d).findByRole('option', { name: 'Ferramenta' })
    expect(within(d).queryByRole('option', { name: 'Velho' })).toBeNull()
    expect(within(d).queryByRole('option', { name: 'Sala fechada' })).toBeNull()

    await userEvent.type(within(d).getByLabelText('Nome'), 'Alicate')
    await userEvent.selectOptions(within(d).getByLabelText('Tipo'), 'Ferramenta')
    await userEvent.selectOptions(within(d).getByLabelText('Local'), 'Almoxarifado')
    await userEvent.type(within(d).getByLabelText('Quantidade'), '10')
    await userEvent.click(within(d).getByRole('button', { name: 'Cadastrar' }))
    expect(api.criarItem).toHaveBeenCalledWith({
      nome: 'Alicate',
      tipo_id: 't-ferr',
      local_id: 'l-alm',
      quantidade_total: 10,
      estado: null,
      numero_patrimonio: null,
      descricao: null,
      estoque_minimo: null,
    })
    expect(await screen.findByText('Item Alicate cadastrado.')).toBeInTheDocument()
  })

  test('CA-01: patrimônio com quantidade 5 é barrado já no formulário', async () => {
    const d = await abrirNovo()
    await within(d).findByRole('option', { name: 'Ferramenta' })
    await userEvent.type(within(d).getByLabelText('Nome'), 'Torno')
    await userEvent.selectOptions(within(d).getByLabelText('Tipo'), 'Ferramenta')
    await userEvent.selectOptions(within(d).getByLabelText('Local'), 'Almoxarifado')
    await userEvent.type(within(d).getByLabelText('Quantidade'), '5')
    await userEvent.type(within(d).getByLabelText('Número de patrimônio (opcional)'), 'PAT-2')
    await userEvent.click(within(d).getByRole('button', { name: 'Cadastrar' }))
    expect(
      await within(d).findByText('Item com número de patrimônio deve ter quantidade 1.'),
    ).toBeInTheDocument()
    expect(api.criarItem).not.toHaveBeenCalled()
  })

  test('CA-02: patrimônio duplicado mostra mensagem do banco', async () => {
    vi.mocked(api.criarItem).mockRejectedValue({
      code: '23505',
      message: 'duplicate key value violates unique constraint "item_numero_patrimonio_key"',
    })
    const d = await abrirNovo()
    await within(d).findByRole('option', { name: 'Ferramenta' })
    await userEvent.type(within(d).getByLabelText('Nome'), 'Torno')
    await userEvent.selectOptions(within(d).getByLabelText('Tipo'), 'Ferramenta')
    await userEvent.selectOptions(within(d).getByLabelText('Local'), 'Almoxarifado')
    await userEvent.type(within(d).getByLabelText('Quantidade'), '1')
    await userEvent.type(within(d).getByLabelText('Número de patrimônio (opcional)'), 'PAT-1')
    await userEvent.click(within(d).getByRole('button', { name: 'Cadastrar' }))
    expect(await within(d).findByRole('alert')).toHaveTextContent(
      'Número de patrimônio já cadastrado.',
    )
  })

  test('estoque mínimo só aparece para tipo consumível', async () => {
    const d = await abrirNovo()
    await within(d).findByRole('option', { name: 'Ferramenta' })
    await userEvent.selectOptions(within(d).getByLabelText('Tipo'), 'Ferramenta')
    expect(within(d).queryByLabelText('Estoque mínimo (opcional)')).toBeNull()
    await userEvent.selectOptions(within(d).getByLabelText('Tipo'), 'Insumo')
    expect(within(d).getByLabelText('Estoque mínimo (opcional)')).toBeInTheDocument()
  })

  test('RF-06 / RF-09: edição não mexe na quantidade', async () => {
    vi.mocked(api.atualizarItem).mockResolvedValue()
    renderizarRotas(rotas, '/itens', sessao)
    await screen.findByText('Chave de fenda')
    await userEvent.click(within(linhaDe('Chave de fenda')).getByRole('button', { name: 'Editar' }))
    const d = await dialogo()
    expect(within(d).queryByLabelText('Quantidade')).toBeNull()
    await within(d).findByRole('option', { name: 'Ferramenta' })
    await userEvent.clear(within(d).getByLabelText('Nome'))
    await userEvent.type(within(d).getByLabelText('Nome'), 'Chave Phillips')
    await userEvent.click(within(d).getByRole('button', { name: 'Salvar' }))
    const [id, dados] = vi.mocked(api.atualizarItem).mock.calls[0]!
    expect(id).toBe('i-1')
    expect(dados).toMatchObject({ nome: 'Chave Phillips', tipo_id: 't-ferr', local_id: 'l-alm' })
    expect(dados).not.toHaveProperty('quantidade_total')
  })

  test('RF-09: ajuste com motivo chama a RPC', async () => {
    vi.mocked(api.ajustarQuantidade).mockResolvedValue()
    renderizarRotas(rotas, '/itens', sessao)
    await screen.findByText('Chave de fenda')
    await userEvent.click(
      within(linhaDe('Chave de fenda')).getByRole('button', { name: 'Ajustar quantidade' }),
    )
    const d = await dialogo()
    await userEvent.clear(within(d).getByLabelText('Nova quantidade total'))
    await userEvent.type(within(d).getByLabelText('Nova quantidade total'), '12')
    await userEvent.click(within(d).getByRole('button', { name: 'Ajustar' }))
    expect(await within(d).findByText('Informe o motivo do ajuste.')).toBeInTheDocument()
    expect(api.ajustarQuantidade).not.toHaveBeenCalled()
    await userEvent.type(within(d).getByLabelText('Motivo'), 'Compra')
    await userEvent.click(within(d).getByRole('button', { name: 'Ajustar' }))
    expect(api.ajustarQuantidade).toHaveBeenCalledWith('i-1', 12, 'Compra')
  })

  test('CA-04: ajuste abaixo do reservado + em uso mostra a recusa do banco', async () => {
    vi.mocked(api.ajustarQuantidade).mockRejectedValue({
      code: 'P0001',
      message: 'A quantidade não pode ficar menor que o reservado mais o em uso (5).',
    })
    renderizarRotas(rotas, '/itens', sessao)
    await screen.findByText('Chave de fenda')
    await userEvent.click(
      within(linhaDe('Chave de fenda')).getByRole('button', { name: 'Ajustar quantidade' }),
    )
    const d = await dialogo()
    await userEvent.clear(within(d).getByLabelText('Nova quantidade total'))
    await userEvent.type(within(d).getByLabelText('Nova quantidade total'), '4')
    await userEvent.type(within(d).getByLabelText('Motivo'), 'Contagem')
    await userEvent.click(within(d).getByRole('button', { name: 'Ajustar' }))
    expect(await within(d).findByRole('alert')).toHaveTextContent(
      'menor que o reservado mais o em uso (5)',
    )
  })

  test('RF-14: marcar inoperante sem motivo', async () => {
    vi.mocked(api.alterarOperancia).mockResolvedValue()
    renderizarRotas(rotas, '/itens', sessao)
    await screen.findByText('Chave de fenda')
    await userEvent.click(
      within(linhaDe('Chave de fenda')).getByRole('button', { name: 'Marcar inoperante' }),
    )
    const d = await dialogo()
    await userEvent.click(within(d).getByRole('button', { name: 'Marcar inoperante' }))
    expect(api.alterarOperancia).toHaveBeenCalledWith('i-1', false, '')
  })

  test('CA-11: reativar exige motivo', async () => {
    vi.mocked(api.alterarOperancia).mockResolvedValue()
    renderizarRotas(rotas, '/itens', sessao)
    await screen.findByText('Furadeira')
    await userEvent.click(
      within(linhaDe('Furadeira')).getByRole('button', { name: 'Reativar uso' }),
    )
    const d = await dialogo()
    await userEvent.click(within(d).getByRole('button', { name: 'Reativar uso' }))
    expect(within(d).getByText('Informe o motivo da reativação.')).toBeInTheDocument()
    expect(api.alterarOperancia).not.toHaveBeenCalled()
    await userEvent.type(within(d).getByLabelText('Motivo'), 'Consertado')
    await userEvent.click(within(d).getByRole('button', { name: 'Reativar uso' }))
    expect(api.alterarOperancia).toHaveBeenCalledWith('i-2', true, 'Consertado')
    expect(await screen.findByText('Furadeira voltou a operar.')).toBeInTheDocument()
  })

  test('CA-08: excluir item com histórico oferece desativar', async () => {
    vi.mocked(api.excluirItem).mockRejectedValue(historico)
    vi.mocked(api.atualizarItem).mockResolvedValue()
    renderizarRotas(rotas, '/itens', sessao)
    await screen.findByText('Furadeira')
    await userEvent.click(within(linhaDe('Furadeira')).getByRole('button', { name: 'Excluir' }))
    await userEvent.click(within(await dialogo()).getByRole('button', { name: 'Excluir' }))
    expect(api.excluirItem).toHaveBeenCalledWith('i-2')
    const d = await dialogo()
    expect(await within(d).findByRole('alert')).toHaveTextContent(
      'Possui histórico — desative em vez de excluir.',
    )
    expect(within(d).getByRole('heading', { name: 'Item com histórico' })).toBeInTheDocument()
    await userEvent.click(within(d).getByRole('button', { name: 'Desativar' }))
    expect(api.atualizarItem).toHaveBeenCalledWith('i-2', { ativo: false })
    expect(await screen.findByText('Furadeira desativado.')).toBeInTheDocument()
  })

  test('RF-08: item sem histórico é excluído', async () => {
    vi.mocked(api.excluirItem).mockResolvedValue()
    renderizarRotas(rotas, '/itens', sessao)
    await screen.findByText('Chave de fenda')
    await userEvent.click(
      within(linhaDe('Chave de fenda')).getByRole('button', { name: 'Excluir' }),
    )
    await userEvent.click(within(await dialogo()).getByRole('button', { name: 'Excluir' }))
    expect(await screen.findByText('Chave de fenda excluído.')).toBeInTheDocument()
  })
})
