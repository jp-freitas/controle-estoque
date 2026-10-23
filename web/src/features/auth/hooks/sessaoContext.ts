import type { Session } from '@supabase/supabase-js'
import { createContext, use } from 'react'
import type { Perfil } from '../api/sessaoApi'

export interface SessaoValor {
  sessao: Session | null
  /** `null` sem sessão ou quando o convite ainda não foi aceito. */
  perfil: Perfil | null
  carregando: boolean
  erroPerfil: boolean
  sair: () => Promise<void>
  recarregarPerfil: () => Promise<void>
}

export const chavePerfil = (id: string | undefined) => ['perfil', id] as const

export const SessaoContext = createContext<SessaoValor | null>(null)

export function useSessao(): SessaoValor {
  const valor = use(SessaoContext)
  if (!valor) throw new Error('useSessao precisa estar dentro de <SessaoProvider>')
  return valor
}
