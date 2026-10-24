// spec-003/T-09 (RF-02, RF-03) e T-10 (CA-09): regras puras e persistência do carrinho.
import { itemFalso } from '@/features/catalogo/testing'
import {
  aplicar,
  chaveCarrinho,
  lerCarrinho,
  revalidar,
  salvarCarrinho,
  type LinhaSalva,
} from './carrinho'

const linha = (itemId: string, quantidade = 1, nome = itemId): LinhaSalva => ({
  itemId,
  nome,
  quantidade,
})

describe('T-09: aplicar', () => {
  test('RF-03: adicionar o mesmo item soma em vez de repetir', () => {
    let l = aplicar([], { tipo: 'adicionar', itemId: 'a', nome: 'A' })
    l = aplicar(l, { tipo: 'adicionar', itemId: 'a', nome: 'A', quantidade: 2 })
    l = aplicar(l, { tipo: 'adicionar', itemId: 'b', nome: 'B' })
    expect(l).toEqual([linha('a', 3, 'A'), linha('b', 1, 'B')])
  })

  test('RF-03: alterar aceita só inteiro ≥ 1', () => {
    const l = [linha('a', 2)]
    expect(aplicar(l, { tipo: 'alterar', itemId: 'a', quantidade: 5 })).toEqual([linha('a', 5)])
    expect(aplicar(l, { tipo: 'alterar', itemId: 'a', quantidade: 0 })).toEqual(l)
    expect(aplicar(l, { tipo: 'alterar', itemId: 'a', quantidade: Number.NaN })).toEqual(l)
  })

  test('remover e limpar', () => {
    const l = [linha('a'), linha('b')]
    expect(aplicar(l, { tipo: 'remover', itemId: 'a' })).toEqual([linha('b')])
    expect(aplicar(l, { tipo: 'limpar' })).toEqual([])
  })
})

describe('T-10 / CA-09: revalidar contra o catálogo atual', () => {
  const catalogo = [
    itemFalso({ id: 'ok', nome: 'Régua', disponivel: 10 }),
    itemFalso({ id: 'pouco', nome: 'Compasso', disponivel: 2 }),
    itemFalso({ id: 'zero', nome: 'Lupa', disponivel: 0 }),
    itemFalso({ id: 'quebrado', nome: 'Serra', disponivel: 1, operante: false }),
    itemFalso({ id: 'desativado', nome: 'Velho', ativo: false }),
  ]

  test('remove o que saiu do catálogo ou ficou sem disponível, reduz e marca inoperante', () => {
    const { linhas, avisos } = revalidar(
      [
        linha('ok', 3, 'Régua'),
        linha('pouco', 5, 'Compasso'),
        linha('zero', 1, 'Lupa'),
        linha('quebrado', 1, 'Serra'),
        linha('desativado', 1, 'Velho'),
        linha('sumiu', 1, 'Fantasma'),
      ],
      catalogo,
    )
    expect(linhas.map((l) => [l.itemId, l.quantidade, l.inoperante])).toEqual([
      ['ok', 3, false],
      ['pouco', 2, false],
      ['quebrado', 1, true],
    ])
    expect(avisos).toEqual([
      'A quantidade de Compasso foi reduzida para 2 (disponível).',
      'Lupa está sem unidades disponíveis e foi removido do carrinho.',
      'Velho saiu do catálogo e foi removido do carrinho.',
      'Fantasma saiu do catálogo e foi removido do carrinho.',
    ])
  })

  test('atualiza o nome e o disponível a partir do catálogo', () => {
    const { linhas } = revalidar([linha('ok', 1, 'Nome antigo')], catalogo)
    expect(linhas[0]).toMatchObject({ nome: 'Régua', disponivel: 10 })
  })
})

describe('T-10 / RF-02: persistência no navegador', () => {
  beforeEach(() => localStorage.clear())
  afterEach(() => vi.restoreAllMocks())

  test('salva e lê por usuário', () => {
    salvarCarrinho('u1', [linha('a', 2)])
    expect(lerCarrinho('u1')).toEqual([linha('a', 2)])
    expect(lerCarrinho('u2')).toEqual([])
    expect(localStorage.getItem(chaveCarrinho('u1'))).not.toBeNull()
  })

  test('carrinho vazio apaga a chave', () => {
    salvarCarrinho('u1', [linha('a')])
    salvarCarrinho('u1', [])
    expect(localStorage.getItem(chaveCarrinho('u1'))).toBeNull()
  })

  test('conteúdo inválido vira carrinho vazio ou é filtrado', () => {
    localStorage.setItem(chaveCarrinho('u1'), '{quebrado')
    expect(lerCarrinho('u1')).toEqual([])
    localStorage.setItem(
      chaveCarrinho('u1'),
      JSON.stringify([linha('a'), { itemId: 'b', nome: 'B', quantidade: 0 }, 'lixo']),
    )
    expect(lerCarrinho('u1')).toEqual([linha('a')])
  })

  test('sem localStorage (janela privada) não quebra', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError')
    })
    expect(lerCarrinho('u1')).toEqual([])
    expect(() => salvarCarrinho('u1', [linha('a')])).not.toThrow()
  })
})
