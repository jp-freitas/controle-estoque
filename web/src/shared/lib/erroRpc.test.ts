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

  test('spec-002/CA-02: 23505 vira mensagem pela constraint', () => {
    const duplicado = (constraint: string) =>
      erroRpc({
        code: '23505',
        message: `duplicate key value violates unique constraint "${constraint}"`,
      }).mensagem
    expect(duplicado('item_numero_patrimonio_key')).toBe('Número de patrimônio já cadastrado.')
    expect(duplicado('local_nome_key')).toBe('Já existe um local com este nome.')
    expect(duplicado('tipo_item_nome_key')).toBe('Já existe um tipo com este nome.')
    expect(duplicado('outra_key')).toBe('Já existe um registro com esses dados.')
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
