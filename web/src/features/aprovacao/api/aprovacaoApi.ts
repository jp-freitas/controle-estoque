import { supabase } from '@/lib/supabase'
import type { Enums } from '@/types/database'

export interface LinhaFila {
  solicitacao_item_id: string
  item_id: string
  item_nome: string
  quantidade_solicitada: number
  disponivel: number
  operante: boolean
  ativo: boolean
}

/** Linha da view `fila_aprovacao` (spec-004/RF-03, RF-14). */
export interface SolicitacaoPendente {
  id: string
  criado_em: string
  justificativa: string
  solicitante_id: string
  solicitante_nome: string
  solicitante_status: Enums<'status_usuario'>
  itens: LinhaFila[]
}

export interface LinhaAprovada {
  solicitacao_item_id: string
  item_id: string
  item_nome: string
  quantidade_aprovada: number
}

/** Linha da view `aprovadas_aguardando_retirada` (spec-004/RF-13). */
export interface SolicitacaoAprovada {
  id: string
  criado_em: string
  data_decisao: string
  dias_aguardando: number
  justificativa: string
  observacao_decisao: string | null
  solicitante_id: string
  solicitante_nome: string
  aprovador_nome: string | null
  itens: LinhaAprovada[]
}

// O gerador de tipos marca toda coluna de view como anulável e jsonb como Json;
// os formatos acima são os montados pelas views (migration aprovacao_views).

export async function listarFila(): Promise<SolicitacaoPendente[]> {
  const { data, error } = await supabase
    .from('fila_aprovacao')
    .select('*')
    .order('criado_em', { ascending: true })
  if (error) throw error
  return data as unknown as SolicitacaoPendente[]
}

export async function listarAguardandoRetirada(): Promise<SolicitacaoAprovada[]> {
  const { data, error } = await supabase
    .from('aprovadas_aguardando_retirada')
    .select('*')
    .order('data_decisao', { ascending: true })
  if (error) throw error
  return data as unknown as SolicitacaoAprovada[]
}

export async function aprovarSolicitacao(
  id: string,
  itens: { solicitacao_item_id: string; quantidade_aprovada: number }[],
  observacao: string,
): Promise<void> {
  const { error } = await supabase.rpc('aprovar_solicitacao', {
    p_id: id,
    p_itens: itens,
    p_observacao: observacao,
  })
  if (error) throw error
}

export async function recusarSolicitacao(id: string, motivo: string): Promise<void> {
  const { error } = await supabase.rpc('recusar_solicitacao', { p_id: id, p_motivo: motivo })
  if (error) throw error
}

export async function cancelarSolicitacaoAprovada(id: string, motivo: string): Promise<void> {
  const { error } = await supabase.rpc('cancelar_solicitacao_aprovada', {
    p_id: id,
    p_motivo: motivo,
  })
  if (error) throw error
}
