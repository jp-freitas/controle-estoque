import { createContext, use } from 'react'
import type { AcaoCarrinho, LinhaCarrinho } from './carrinho'

export interface CarrinhoValor {
  /** Linhas já conferidas contra o catálogo (CA-09). */
  linhas: LinhaCarrinho[]
  /** Mudanças feitas na conferência, para avisar o usuário. */
  avisos: string[]
  /** Catálogo ainda carregando: as linhas não foram conferidas. */
  conferindo: boolean
  executar: (acao: AcaoCarrinho) => void
}

export const CarrinhoContext = createContext<CarrinhoValor | null>(null)

export function useCarrinho(): CarrinhoValor {
  const valor = use(CarrinhoContext)
  if (!valor) throw new Error('useCarrinho precisa estar dentro de <CarrinhoProvider>')
  return valor
}
