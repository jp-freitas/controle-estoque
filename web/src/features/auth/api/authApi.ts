import { supabase } from '@/lib/supabase'
import type { Perfil } from './sessaoApi'

/** Rota que recebe o link do e-mail de recuperação (RF-01). Sob o site_url do Auth. */
export const ROTA_REDEFINIR_SENHA = '/redefinir-senha'

export async function entrar(email: string, senha: string): Promise<void> {
  const { error } = await supabase.auth.signInWithPassword({ email, password: senha })
  if (error) throw error
}

export async function solicitarRecuperacao(email: string): Promise<void> {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}${ROTA_REDEFINIR_SENHA}`,
  })
  if (error) throw error
}

export async function definirSenha(senha: string): Promise<void> {
  const { error } = await supabase.auth.updateUser({ password: senha })
  if (error) throw error
}

/** spec-001/RF-11: cria o profiles pendente a partir do convite do e-mail logado. */
export async function aceitarConvite(): Promise<Perfil> {
  const { data, error } = await supabase.rpc('aceitar_convite')
  if (error) throw error
  return data
}
