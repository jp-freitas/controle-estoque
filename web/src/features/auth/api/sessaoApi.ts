import type { Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import type { Tables } from '@/types/database'

export type Perfil = Tables<'profiles'>

export async function obterSessao(): Promise<Session | null> {
  const { data } = await supabase.auth.getSession()
  return data.session
}

/** Chama `aoMudar` a cada login, logout, renovação de token ou link de e-mail. */
export function observarSessao(aoMudar: (sessao: Session | null) => void): () => void {
  const { data } = supabase.auth.onAuthStateChange((_evento, sessao) => aoMudar(sessao))
  return () => data.subscription.unsubscribe()
}

/** `null` quando o usuário autenticado ainda não aceitou o convite (spec-001/RF-11). */
export async function buscarPerfil(id: string): Promise<Perfil | null> {
  const { data, error } = await supabase.from('profiles').select('*').eq('id', id).maybeSingle()
  if (error) throw error
  return data
}

export async function sair(): Promise<void> {
  await supabase.auth.signOut()
}
