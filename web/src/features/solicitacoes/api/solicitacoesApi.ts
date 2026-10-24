import { supabase } from '@/lib/supabase'
import type { Enums, Tables } from '@/types/database'

export type StatusSolicitacao = Enums<'status_solicitacao'>
export type Solicitacao = Tables<'solicitacao'> & { solicitacao_item: Tables<'solicitacao_item'>[] }

/** RF-08 / RF-10: só as do próprio usuário (o admin também vê todas pela RLS, daí o filtro). */
export async function listarMinhasSolicitacoes(usuarioId: string): Promise<Solicitacao[]> {
  const { data, error } = await supabase
    .from('solicitacao')
    .select('*, solicitacao_item(*)')
    .eq('solicitante_id', usuarioId)
    .order('criado_em', { ascending: false })
  if (error) throw error
  return data
}

/** RF-09: só o dono, só pendente (o banco confere). */
export async function cancelarSolicitacao(id: string): Promise<void> {
  const { error } = await supabase.rpc('cancelar_solicitacao', { p_id: id })
  if (error) throw error
}
