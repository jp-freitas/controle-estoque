import { useMutation } from '@tanstack/react-query'
import { aceitarConvite, definirSenha, entrar, solicitarRecuperacao } from '../api/authApi'
import { useSessao } from './sessaoContext'

export function useEntrar() {
  return useMutation({
    mutationFn: ({ email, senha }: { email: string; senha: string }) => entrar(email, senha),
  })
}

export function useSolicitarRecuperacao() {
  return useMutation({ mutationFn: (email: string) => solicitarRecuperacao(email) })
}

export function useDefinirSenha() {
  return useMutation({ mutationFn: (senha: string) => definirSenha(senha) })
}

/** RF-11: define a senha e aceita o convite; depois recarrega o perfil da sessão. */
export function usePrimeiroAcesso() {
  const { recarregarPerfil } = useSessao()
  return useMutation({
    mutationFn: async (senha: string) => {
      await definirSenha(senha)
      return aceitarConvite()
    },
    onSuccess: () => recarregarPerfil(),
  })
}
