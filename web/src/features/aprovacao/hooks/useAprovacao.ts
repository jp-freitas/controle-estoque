import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { chaveCatalogo } from '@/features/catalogo'
import {
  aprovarSolicitacao,
  cancelarSolicitacaoAprovada,
  listarAguardandoRetirada,
  listarFila,
  recusarSolicitacao,
} from '../api/aprovacaoApi'

const chaves = {
  fila: ['fila-aprovacao'] as const,
  aguardando: ['aguardando-retirada'] as const,
}

export function useFila() {
  return useQuery({ queryKey: chaves.fila, queryFn: listarFila })
}

export function useAguardandoRetirada() {
  return useQuery({ queryKey: chaves.aguardando, queryFn: listarAguardandoRetirada })
}

/** Decisões mudam a fila, as aprovadas e o disponível do catálogo. */
function useDecisao<T>(fn: (v: T) => Promise<unknown>) {
  const qc = useQueryClient()
  const atualizar = () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: chaves.fila }),
      qc.invalidateQueries({ queryKey: chaves.aguardando }),
      qc.invalidateQueries({ queryKey: chaveCatalogo }),
    ])
  return useMutation({
    mutationFn: fn,
    onSuccess: atualizar,
    // falha por estoque: a fila mostra o disponível atualizado
    onError: atualizar,
  })
}

export const useAprovar = () =>
  useDecisao(
    (v: {
      id: string
      itens: { solicitacao_item_id: string; quantidade_aprovada: number }[]
      observacao: string
    }) => aprovarSolicitacao(v.id, v.itens, v.observacao),
  )

export const useRecusar = () =>
  useDecisao((v: { id: string; motivo: string }) => recusarSolicitacao(v.id, v.motivo))

export const useCancelarAprovada = () =>
  useDecisao((v: { id: string; motivo: string }) => cancelarSolicitacaoAprovada(v.id, v.motivo))
