import { supabase } from '@/lib/supabase'
import type { Enums, Tables } from '@/types/database'

export type Usuario = Tables<'profiles'>
export type Convite = Tables<'convite_situacao'>
export type PerfilUsuario = Enums<'perfil'>
export type StatusUsuario = Enums<'status_usuario'>

/** Rota que recebe o link do convite (spec-001/RF-11). Sob o site_url do Auth. */
export const ROTA_PRIMEIRO_ACESSO = '/primeiro-acesso'

// Usuários (RF-05, RF-09, RF-16) --------------------------------------------

export async function listarUsuarios(): Promise<Usuario[]> {
  const { data, error } = await supabase.from('profiles').select('*').order('nome')
  if (error) throw error
  return data
}

export async function alterarStatusUsuario(id: string, status: StatusUsuario): Promise<Usuario> {
  const { data, error } = await supabase.rpc('alterar_status_usuario', {
    p_id: id,
    p_status: status,
  })
  if (error) throw error
  return data
}

export async function alterarPerfilUsuario(id: string, perfil: PerfilUsuario): Promise<Usuario> {
  const { data, error } = await supabase.rpc('alterar_perfil_usuario', {
    p_id: id,
    p_perfil: perfil,
  })
  if (error) throw error
  return data
}

export async function atualizarUsuario(
  id: string,
  nome: string,
  matricula: string,
): Promise<Usuario> {
  const { data, error } = await supabase.rpc('atualizar_usuario', {
    p_id: id,
    p_nome: nome,
    p_matricula: matricula,
  })
  if (error) throw error
  return data
}

// Meu perfil (RF-15) ---------------------------------------------------------

export async function atualizarMeuPerfil(nome: string, matricula: string): Promise<Usuario> {
  const { data, error } = await supabase.rpc('atualizar_meu_perfil', {
    p_nome: nome,
    p_matricula: matricula,
  })
  if (error) throw error
  return data
}

// Convites (RF-10, RF-13) ------------------------------------------------------

export async function listarConvites(): Promise<Convite[]> {
  const { data, error } = await supabase
    .from('convite_situacao')
    .select('*')
    .order('criado_em', { ascending: false })
  if (error) throw error
  return data
}

export async function convidarUsuario(dados: {
  email: string
  nome: string
  matricula: string
  perfil: PerfilUsuario
}): Promise<void> {
  const { error } = await supabase.rpc('convidar_usuario', {
    p_email: dados.email,
    p_nome: dados.nome,
    p_matricula: dados.matricula,
    p_perfil: dados.perfil,
  })
  if (error) throw error
}

/**
 * Envia (ou reenvia) o link do convite. É o signInWithOtp do Auth: não altera a
 * sessão de quem chama (spike T-01) e o hook só deixa criar a conta com convite
 * em aberto (RF-03). Reenviar não renova o prazo de 7 dias (RF-12).
 */
export async function enviarEmailConvite(email: string): Promise<void> {
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: true,
      emailRedirectTo: `${window.location.origin}${ROTA_PRIMEIRO_ACESSO}`,
    },
  })
  if (error) throw error
}

export async function cancelarConvite(id: string): Promise<void> {
  const { error } = await supabase.rpc('cancelar_convite', { p_id: id })
  if (error) throw error
}
