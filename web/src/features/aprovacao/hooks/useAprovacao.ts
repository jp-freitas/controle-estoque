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

// Mudam por ação de outros (professores enviando, outro admin decidindo): ao abrir a
// tela, busca de novo em vez de usar o cache.
export function useFila() {
  return useQuery({ queryKey: chaves.fila, queryFn: listarFila, staleTime: 0 })
}

export function useAguardandoRetirada() {
  return useQuery({ queryKey: chaves.aguardando, queryFn: listarAguardandoRetirada, staleTime: 0 })
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
  // Não espera o recarregamento: a decisão tira o cartão da fila, e um componente
  // desmontado não recebe o onSuccess de mutate() (a mensagem de sucesso se perderia).
  return useMutation({
    mutationFn: fn,
    onSuccess: () => void atualizar(),
    // falha por estoque: a fila mostra o disponível atualizado
    onError: () => void atualizar(),
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
