import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useSessao } from '@/features/auth'
import {
  alterarPerfilUsuario,
  alterarStatusUsuario,
  atualizarMeuPerfil,
  atualizarUsuario,
  cancelarConvite,
  convidarUsuario,
  enviarEmailConvite,
  listarConvites,
  listarUsuarios,
  type PerfilUsuario,
  type StatusUsuario,
} from '../api/usuariosApi'

const chaves = {
  usuarios: ['usuarios'] as const,
  convites: ['convites'] as const,
}

// Usuários --------------------------------------------------------------------

export function useUsuarios() {
  return useQuery({ queryKey: chaves.usuarios, queryFn: listarUsuarios })
}

function useMutacaoUsuario<T>(fn: (v: T) => Promise<unknown>) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: () => qc.invalidateQueries({ queryKey: chaves.usuarios }),
  })
}

export function useAlterarStatusUsuario() {
  return useMutacaoUsuario((v: { id: string; status: StatusUsuario }) =>
    alterarStatusUsuario(v.id, v.status),
  )
}

export function useAlterarPerfilUsuario() {
  return useMutacaoUsuario((v: { id: string; perfil: PerfilUsuario }) =>
    alterarPerfilUsuario(v.id, v.perfil),
  )
}

export function useAtualizarUsuario() {
  return useMutacaoUsuario((v: { id: string; nome: string; matricula: string }) =>
    atualizarUsuario(v.id, v.nome, v.matricula),
  )
}

// Meu perfil --------------------------------------------------------------------

export function useAtualizarMeuPerfil() {
  const { recarregarPerfil } = useSessao()
  return useMutation({
    mutationFn: (v: { nome: string; matricula: string }) => atualizarMeuPerfil(v.nome, v.matricula),
    onSuccess: () => recarregarPerfil(),
  })
}

// Convites --------------------------------------------------------------------

export function useConvites() {
  return useQuery({ queryKey: chaves.convites, queryFn: listarConvites })
}

export type ResultadoConvite = { emailEnviado: true } | { emailEnviado: false; erroEmail: unknown }

/**
 * RF-10/RF-11: registra o convite e envia o e-mail. Se o e-mail falhar, o
 * convite continua registrado e o admin pode reenviar.
 */
export function useConvidar() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (dados: {
      email: string
      nome: string
      matricula: string
      perfil: PerfilUsuario
    }): Promise<ResultadoConvite> => {
      await convidarUsuario(dados)
      try {
        await enviarEmailConvite(dados.email)
        return { emailEnviado: true }
      } catch (erroEmail) {
        return { emailEnviado: false, erroEmail }
      }
    },
    onSettled: () => qc.invalidateQueries({ queryKey: chaves.convites }),
  })
}

export function useReenviarConvite() {
  return useMutation({ mutationFn: (email: string) => enviarEmailConvite(email) })
}

export function useCancelarConvite() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => cancelarConvite(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: chaves.convites }),
  })
}
