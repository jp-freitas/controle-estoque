import { supabase } from '@/lib/supabase'
import type { Enums, Tables } from '@/types/database'

export type Tipo = Tables<'tipo_item'>
export type Local = Tables<'local'>
export type Item = Tables<'item'>
export type EstadoItem = Enums<'estado_item'>

// Cadastro direto pela API: a RLS só deixa admin ativo escrever (spec-002/RN-01)
// e o banco valida as regras (RN-03, RN-04, RF-07). Contadores e operante só por RPC.

// Tipos (RF-01 a RF-03) -------------------------------------------------------

export async function listarTipos(): Promise<Tipo[]> {
  const { data, error } = await supabase.from('tipo_item').select('*').order('nome')
  if (error) throw error
  return data
}

export async function criarTipo(dados: { nome: string; consumivel: boolean }): Promise<void> {
  const { error } = await supabase.from('tipo_item').insert(dados)
  if (error) throw error
}

export async function atualizarTipo(
  id: string,
  dados: Partial<Pick<Tipo, 'nome' | 'consumivel' | 'ativo'>>,
): Promise<void> {
  const { error } = await supabase.from('tipo_item').update(dados).eq('id', id)
  if (error) throw error
}

export async function excluirTipo(id: string): Promise<void> {
  const { error } = await supabase.from('tipo_item').delete().eq('id', id)
  if (error) throw error
}

// Locais (RF-04) ----------------------------------------------------------------

export async function listarLocais(): Promise<Local[]> {
  const { data, error } = await supabase.from('local').select('*').order('nome')
  if (error) throw error
  return data
}

export async function criarLocal(dados: { nome: string; descricao: string | null }): Promise<void> {
  const { error } = await supabase.from('local').insert(dados)
  if (error) throw error
}

export async function atualizarLocal(
  id: string,
  dados: Partial<Pick<Local, 'nome' | 'descricao' | 'ativo'>>,
): Promise<void> {
  const { error } = await supabase.from('local').update(dados).eq('id', id)
  if (error) throw error
}

export async function excluirLocal(id: string): Promise<void> {
  const { error } = await supabase.from('local').delete().eq('id', id)
  if (error) throw error
}

// Itens (RF-05 a RF-09, RF-14) -----------------------------------------------------

export interface DadosItem {
  nome: string
  tipo_id: string
  local_id: string
  estado: EstadoItem | null
  numero_patrimonio: string | null
  descricao: string | null
  estoque_minimo: number | null
}

/** quantidade_total só entra no cadastro (CA-03); depois, só por ajuste. */
export async function criarItem(dados: DadosItem & { quantidade_total: number }): Promise<void> {
  const { error } = await supabase.from('item').insert(dados)
  if (error) throw error
}

export async function atualizarItem(
  id: string,
  dados: Partial<DadosItem & { ativo: boolean }>,
): Promise<void> {
  const { error } = await supabase.from('item').update(dados).eq('id', id)
  if (error) throw error
}

/** Item com movimentação falha com 23503 (CA-08). */
export async function excluirItem(id: string): Promise<void> {
  const { error } = await supabase.from('item').delete().eq('id', id)
  if (error) throw error
}

export async function ajustarQuantidade(
  id: string,
  novaQuantidade: number,
  motivo: string,
): Promise<void> {
  const { error } = await supabase.rpc('ajustar_quantidade_item', {
    p_item_id: id,
    p_nova_quantidade: novaQuantidade,
    p_motivo: motivo,
  })
  if (error) throw error
}

export async function alterarOperancia(
  id: string,
  operante: boolean,
  motivo: string,
): Promise<void> {
  const { error } = await supabase.rpc('alterar_operancia_item', {
    p_item_id: id,
    p_operante: operante,
    p_motivo: motivo,
  })
  if (error) throw error
}
