import { normalizar } from '@/shared/lib/texto'
import type { ItemCatalogo } from '../api/catalogoApi'

export interface FiltrosCatalogo {
  busca: string
  tipoId: string
  localId: string
  operante: '' | 'sim' | 'nao'
  disponibilidade: '' | 'com' | 'sem'
  incluirDesativados: boolean
}

export const FILTROS_INICIAIS: FiltrosCatalogo = {
  busca: '',
  tipoId: '',
  localId: '',
  operante: '',
  disponibilidade: '',
  incluirDesativados: false,
}

/** RF-10: busca por nome e filtros por tipo, local, operante e disponibilidade. */
export function filtrarCatalogo(itens: ItemCatalogo[], f: FiltrosCatalogo): ItemCatalogo[] {
  const busca = normalizar(f.busca)
  return itens.filter(
    (i) =>
      (f.incluirDesativados || i.ativo) &&
      (!busca || normalizar(i.nome).includes(busca)) &&
      (!f.tipoId || i.tipo_id === f.tipoId) &&
      (!f.localId || i.local_id === f.localId) &&
      (!f.operante || i.operante === (f.operante === 'sim')) &&
      (!f.disponibilidade || i.disponivel > 0 === (f.disponibilidade === 'com')),
  )
}

/**
 * CA-05 / spec-003/RF-02: só item ativo, operante e com disponível entra no
 * carrinho. O banco valida de novo no envio.
 */
export function podeSolicitar(item: ItemCatalogo): boolean {
  return item.ativo && item.operante && item.disponivel > 0
}

/** Opções distintas (id, nome) presentes na lista, para os filtros. */
export function opcoesDe(
  itens: ItemCatalogo[],
  id: 'tipo_id' | 'local_id',
  nome: 'tipo_nome' | 'local_nome',
): { valor: string; rotulo: string }[] {
  const mapa = new Map(itens.map((i) => [i[id], i[nome]]))
  return [...mapa]
    .map(([valor, rotulo]) => ({ valor, rotulo }))
    .sort((a, b) => a.rotulo.localeCompare(b.rotulo, 'pt-BR'))
}
