import { erroRpc } from './erroRpc'

describe('erroRpc', () => {
  test('P0001: usa a mensagem do banco', () => {
    expect(erroRpc({ code: 'P0001', message: 'Matrícula já cadastrada.', details: null })).toEqual({
      mensagem: 'Matrícula já cadastrada.',
      itens: [],
    })
  })

  test('P0001: lê a lista de itens em details', () => {
    const itens = [{ item_id: '1', nome: 'Furadeira', motivo: 'Sem estoque' }]
    expect(
      erroRpc({ code: 'P0001', message: 'Itens indisponíveis.', details: JSON.stringify(itens) })
        .itens,
    ).toEqual(itens)
  })

  test('P0001: details que não é JSON não quebra', () => {
    expect(erroRpc({ code: 'P0001', message: 'X', details: 'texto livre' }).itens).toEqual([])
  })

  test('23503: violação de FK vira "Possui histórico — desative"', () => {
    expect(erroRpc({ code: '23503', message: 'fk' }).mensagem).toMatch(/Possui histórico/)
  })

  test('42501: sem permissão', () => {
    expect(erroRpc({ code: '42501', message: 'permission denied' }).mensagem).toBe(
      'Você não tem permissão para esta operação.',
    )
  })

  test('erro desconhecido não expõe detalhes técnicos', () => {
    expect(erroRpc({ code: 'XX000', message: 'internal' }).mensagem).toBe(
      'Não foi possível concluir a operação. Tente novamente.',
    )
    expect(erroRpc(null).mensagem).toBe('Não foi possível concluir a operação. Tente novamente.')
  })
})
