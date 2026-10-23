import { supabase } from '@/lib/supabase'
import type { Enums } from '@/types/database'

export type EstadoItem = Enums<'estado_item'>

/**
 * Linha da view `catalogo` (spec-002/RF-10, RF-11). O gerador de tipos marca toda
 * coluna de view como anulável; aqui ficam anuláveis só as que são no banco.
 */
export interface ItemCatalogo {
  id: string
  nome: string
  descricao: string | null
  tipo_id: string
  tipo_nome: string
  consumivel: boolean
  local_id: string
  local_nome: string
  quantidade_total: number
  quantidade_reservada: number
  quantidade_em_uso: number
  disponivel: number
  operante: boolean
  estado: EstadoItem | null
  numero_patrimonio: string | null
  estoque_minimo: number | null
  ativo: boolean
  atualizado_em: string
}

/** A RLS decide o que vem: não-admin recebe só itens ativos (CA-10). */
export async function listarCatalogo(): Promise<ItemCatalogo[]> {
  const { data, error } = await supabase.from('catalogo').select('*').order('nome')
  if (error) throw error
  return data as ItemCatalogo[]
}
