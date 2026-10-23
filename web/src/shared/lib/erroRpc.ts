// Converte erros do Supabase (PostgREST/RPC) em mensagem para o usuário.
// Convenção do banco (CLAUDE.md → Banco): regras de negócio levantam P0001 com a
// mensagem já em pt-BR; erros por item vêm em `details` como JSON.

export interface ErroItem {
  item_id: string
  nome: string
  motivo: string
}

export interface ErroRpc {
  mensagem: string
  itens: ErroItem[]
}

const MENSAGEM_GENERICA = 'Não foi possível concluir a operação. Tente novamente.'

// 23505 (unicidade) vem do CRUD direto pela API: a mensagem do Postgres traz o
// nome da constraint, que mapeamos para um texto de usuário (spec-002/plan.md).
const MENSAGEM_UNICIDADE: Record<string, string> = {
  tipo_item_nome_key: 'Já existe um tipo com este nome.',
  local_nome_key: 'Já existe um local com este nome.',
  item_numero_patrimonio_key: 'Número de patrimônio já cadastrado.',
}

function mensagemUnicidade(message: unknown): string {
  const constraint = typeof message === 'string' ? /"([^"]+)"/.exec(message)?.[1] : undefined
  return (constraint && MENSAGEM_UNICIDADE[constraint]) || 'Já existe um registro com esses dados.'
}

function lerItens(detalhes: unknown): ErroItem[] {
  if (typeof detalhes !== 'string' || detalhes === '') return []
  try {
    const valor: unknown = JSON.parse(detalhes)
    return Array.isArray(valor) ? (valor as ErroItem[]) : []
  } catch {
    return []
  }
}

export function erroRpc(erro: unknown): ErroRpc {
  if (typeof erro !== 'object' || erro === null) {
    return { mensagem: MENSAGEM_GENERICA, itens: [] }
  }
  const { code, message, details } = erro as {
    code?: unknown
    message?: unknown
    details?: unknown
  }

  switch (code) {
    case 'P0001':
      return {
        mensagem: typeof message === 'string' && message ? message : MENSAGEM_GENERICA,
        itens: lerItens(details),
      }
    case '23505':
      return { mensagem: mensagemUnicidade(message), itens: [] }
    case '23503':
      return { mensagem: 'Possui histórico — desative em vez de excluir.', itens: [] }
    case '42501':
      return { mensagem: 'Você não tem permissão para esta operação.', itens: [] }
    default:
      return { mensagem: MENSAGEM_GENERICA, itens: [] }
  }
}
