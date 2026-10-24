// Regras puras do carrinho (spec-003/RF-02 a RF-04, CA-09): sem React, sem rede.
import type { ItemCatalogo } from '@/features/catalogo'

/** O que fica salvo no navegador. */
export interface LinhaSalva {
  itemId: string
  nome: string
  quantidade: number
}

/** Linha conferida contra o catálogo atual. */
export interface LinhaCarrinho extends LinhaSalva {
  disponivel: number
  inoperante: boolean
}

export type AcaoCarrinho =
  | { tipo: 'adicionar'; itemId: string; nome: string; quantidade?: number }
  | { tipo: 'alterar'; itemId: string; quantidade: number }
  | { tipo: 'remover'; itemId: string }
  | { tipo: 'limpar' }

/** RF-03: item não repete (adicionar de novo soma) e quantidade é inteiro ≥ 1. */
export function aplicar(linhas: LinhaSalva[], acao: AcaoCarrinho): LinhaSalva[] {
  switch (acao.tipo) {
    case 'adicionar': {
      const somar = Math.max(1, Math.trunc(acao.quantidade ?? 1))
      const existente = linhas.find((l) => l.itemId === acao.itemId)
      return existente
        ? linhas.map((l) =>
            l.itemId === acao.itemId ? { ...l, quantidade: l.quantidade + somar } : l,
          )
        : [...linhas, { itemId: acao.itemId, nome: acao.nome, quantidade: somar }]
    }
    case 'alterar': {
      const quantidade = Math.trunc(acao.quantidade)
      if (!Number.isFinite(quantidade) || quantidade < 1) return linhas
      return linhas.map((l) => (l.itemId === acao.itemId ? { ...l, quantidade } : l))
    }
    case 'remover':
      return linhas.filter((l) => l.itemId !== acao.itemId)
    case 'limpar':
      return []
  }
}

/**
 * CA-09 / RF-04: confere o carrinho salvo contra o catálogo atual. Remove o que
 * saiu do catálogo ou ficou sem disponível, reduz quantidade acima do disponível e
 * marca inoperantes (que bloqueiam o envio). Devolve avisos para o usuário.
 */
export function revalidar(
  linhas: LinhaSalva[],
  catalogo: ItemCatalogo[],
): { linhas: LinhaCarrinho[]; avisos: string[] } {
  const porId = new Map(catalogo.map((i) => [i.id, i]))
  const avisos: string[] = []
  const resultado: LinhaCarrinho[] = []
  for (const l of linhas) {
    const item = porId.get(l.itemId)
    if (!item || !item.ativo) {
      avisos.push(`${l.nome} saiu do catálogo e foi removido do carrinho.`)
      continue
    }
    if (item.disponivel <= 0) {
      avisos.push(`${item.nome} está sem unidades disponíveis e foi removido do carrinho.`)
      continue
    }
    let quantidade = l.quantidade
    if (quantidade > item.disponivel) {
      quantidade = item.disponivel
      avisos.push(`A quantidade de ${item.nome} foi reduzida para ${quantidade} (disponível).`)
    }
    resultado.push({
      itemId: item.id,
      nome: item.nome,
      quantidade,
      disponivel: item.disponivel,
      inoperante: !item.operante,
    })
  }
  return { linhas: resultado, avisos }
}

// Persistência (RF-02): por usuário, para o carrinho não vazar entre contas no mesmo navegador.

export const chaveCarrinho = (usuarioId: string) => `estoque:carrinho:${usuarioId}`

function ehLinha(v: unknown): v is LinhaSalva {
  if (typeof v !== 'object' || v === null) return false
  const l = v as Record<string, unknown>
  return (
    typeof l.itemId === 'string' &&
    typeof l.nome === 'string' &&
    Number.isInteger(l.quantidade) &&
    (l.quantidade as number) >= 1
  )
}

/** Lê o carrinho salvo; qualquer falha (sem storage, JSON inválido) vira carrinho vazio. */
export function lerCarrinho(usuarioId: string): LinhaSalva[] {
  try {
    const bruto = localStorage.getItem(chaveCarrinho(usuarioId))
    const valor: unknown = bruto ? JSON.parse(bruto) : []
    return Array.isArray(valor) ? valor.filter(ehLinha) : []
  } catch {
    return []
  }
}

export function salvarCarrinho(usuarioId: string, linhas: LinhaSalva[]): void {
  try {
    if (linhas.length === 0) localStorage.removeItem(chaveCarrinho(usuarioId))
    else localStorage.setItem(chaveCarrinho(usuarioId), JSON.stringify(linhas))
  } catch {
    // sem storage (janela privada, bloqueio): o carrinho vale só nesta aba
  }
}
