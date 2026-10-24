import type { EstadoItem } from '../api/catalogoApi'

export const ROTULO_ESTADO: Record<EstadoItem, string> = {
  novo: 'Novo',
  bom: 'Bom',
  regular: 'Regular',
  ruim: 'Ruim',
}
