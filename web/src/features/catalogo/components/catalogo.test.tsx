// spec-002/T-16: catálogo (RF-10, RF-11, CA-05, CA-10).
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { perfilFalso, renderizarRotas, sessaoFalsa } from '@/features/auth/testing'
import * as api from '../api/catalogoApi'
import { itemFalso } from '../testing'
import { CatalogoPage } from './CatalogoPage'
import { FILTROS_INICIAIS, filtrarCatalogo, podeSolicitar } from './filtros'

vi.mock('../api/catalogoApi')

const itens = [
  itemFalso({ id: 'i-1', nome: 'Chave de fenda', disponivel: 7, quantidade_total: 10 }),
  itemFalso({
    id: 'i-2',
    nome: 'Máquina de solda',
    tipo_id: 't-maq',
    tipo_nome: 'Máquina',
    local_id: 'l-lab',
    local_nome: 'Laboratório',
    quantidade_total: 1,
    disponivel: 1,
    numero_patrimonio: 'PAT-9',
    operante: false,
  }),
  itemFalso({
    id: 'i-3',
    nome: 'Papel A4',
    tipo_id: 't-ins',
    tipo_nome: 'Insumo',
    consumivel: true,
    quantidade_total: 5,
    quantidade_reservada: 5,
    disponivel: 0,
  }),
  itemFalso({ id: 'i-4', nome: 'Termômetro antigo', ativo: false }),
]

const rotas = [{ path: '/', element: <CatalogoPage /> }]
const sessao = (perfil = perfilFalso()) => ({ sessao: sessaoFalsa(), perfil })
const linhaDe = (texto: string) => screen.getByRole('row', { name: new RegExp(texto) })

describe('T-16: filtros do catálogo', () => {
  const filtrar = (f: Partial<typeof FILTROS_INICIAIS>) =>
    filtrarCatalogo(itens, { ...FILTROS_INICIAIS, ...f }).map((i) => i.nome)

  test('RF-10: busca por nome sem diferenciar acento e maiúsculas', () => {
    expect(filtrar({ busca: 'maquina' })).toEqual(['Máquina de solda'])
    expect(filtrar({ busca: '  CHAVE ' })).toEqual(['Chave de fenda'])
  })

  test('RF-10: filtros por tipo, local, operante e disponibilidade', () => {
    expect(filtrar({ tipoId: 't-ins' })).toEqual(['Papel A4'])
    expect(filtrar({ localId: 'l-lab' })).toEqual(['Máquina de solda'])
    expect(filtrar({ operante: 'nao' })).toEqual(['Máquina de solda'])
    expect(filtrar({ disponibilidade: 'sem' })).toEqual(['Papel A4'])
    expect(filtrar({ disponibilidade: 'com', operante: 'sim' })).toEqual(['Chave de fenda'])
  })

  test('CA-10: desativado só com "incluir desativados"', () => {
    expect(filtrar({})).not.toContain('Termômetro antigo')
    expect(filtrar({ incluirDesativados: true })).toContain('Termômetro antigo')
  })

  test('CA-05: inoperante, sem disponível ou desativado não pode ser solicitado', () => {
    expect(itens.map(podeSolicitar)).toEqual([true, false, false, false])
  })
})

describe('T-16: tela do catálogo', () => {
  beforeEach(() => vi.mocked(api.listarCatalogo).mockResolvedValue(itens))

  test('RF-11: mostra disponível de total, tipo, local e patrimônio', async () => {
    renderizarRotas(rotas, '/', sessao())
    await screen.findByText('Chave de fenda')
    expect(within(linhaDe('Chave de fenda')).getByText('7 de 10')).toBeInTheDocument()
    expect(within(linhaDe('Máquina de solda')).getByText(/PAT-9/)).toBeInTheDocument()
    expect(within(linhaDe('Máquina de solda')).getByText('Laboratório')).toBeInTheDocument()
  })

  test('CA-05: inoperante aparece sinalizado', async () => {
    renderizarRotas(rotas, '/', sessao())
    await screen.findByText('Máquina de solda')
    expect(within(linhaDe('Máquina de solda')).getByText('Inoperante')).toBeInTheDocument()
    expect(within(linhaDe('Chave de fenda')).queryByText('Inoperante')).toBeNull()
  })

  test('RF-10: filtrar pela tela', async () => {
    renderizarRotas(rotas, '/', sessao())
    await screen.findByText('Chave de fenda')
    await userEvent.selectOptions(screen.getByLabelText('Tipo'), 'Insumo')
    expect(screen.getByText('Papel A4')).toBeInTheDocument()
    expect(screen.queryByText('Chave de fenda')).toBeNull()
    await userEvent.selectOptions(screen.getByLabelText('Tipo'), 'Todos')
    await userEvent.type(screen.getByLabelText('Buscar por nome'), 'xyz')
    expect(screen.getByText('Nenhum item encontrado.')).toBeInTheDocument()
  })

  test('CA-10: professor não tem a opção "incluir desativados"', async () => {
    renderizarRotas(rotas, '/', sessao())
    await screen.findByText('Chave de fenda')
    expect(screen.queryByLabelText('Incluir desativados')).toBeNull()
  })

  test('CA-10: admin vê desativados ao marcar o filtro', async () => {
    renderizarRotas(rotas, '/', sessao(perfilFalso({ perfil: 'admin' })))
    await screen.findByText('Chave de fenda')
    expect(screen.queryByText('Termômetro antigo')).toBeNull()
    await userEvent.click(screen.getByLabelText('Incluir desativados'))
    expect(within(linhaDe('Termômetro antigo')).getByText('Desativado')).toBeInTheDocument()
  })
})
