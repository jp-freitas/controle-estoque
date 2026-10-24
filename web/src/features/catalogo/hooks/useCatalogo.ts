import { useQuery } from '@tanstack/react-query'
import { listarCatalogo } from '../api/catalogoApi'

/** Chave do catálogo, para quem altera itens invalidar a lista. */
export const chaveCatalogo = ['catalogo'] as const

/** Hook público do catálogo (spec-002/RF-10): também é o que o carrinho (spec 003) usa. */
export function useCatalogo({ enabled = true }: { enabled?: boolean } = {}) {
  return useQuery({ queryKey: chaveCatalogo, queryFn: listarCatalogo, enabled })
}
