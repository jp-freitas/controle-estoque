import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useSessao } from '@/features/auth'
import { cancelarSolicitacao, listarMinhasSolicitacoes } from '../api/solicitacoesApi'

export const chaveMinhasSolicitacoes = ['minhas-solicitacoes'] as const

export function useMinhasSolicitacoes() {
  const { perfil } = useSessao()
  return useQuery({
    queryKey: [...chaveMinhasSolicitacoes, perfil?.id],
    queryFn: () => listarMinhasSolicitacoes(perfil!.id),
    enabled: !!perfil,
  })
}

export function useCancelarSolicitacao() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => cancelarSolicitacao(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: chaveMinhasSolicitacoes }),
  })
}
