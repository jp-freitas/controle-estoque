import { useMutation, useQueryClient } from '@tanstack/react-query'
import { chaveCatalogo } from '@/features/catalogo'
import { chaveMinhasSolicitacoes } from '@/features/solicitacoes'
import { enviarSolicitacao } from '../api/carrinhoApi'

export function useEnviarSolicitacao() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (v: { itens: { item_id: string; quantidade: number }[]; justificativa: string }) =>
      enviarSolicitacao(v.itens, v.justificativa),
    onSuccess: () => qc.invalidateQueries({ queryKey: chaveMinhasSolicitacoes }),
    // erro por disponibilidade: o catálogo mudou, recarrega para conferir de novo
    onError: () => qc.invalidateQueries({ queryKey: chaveCatalogo }),
  })
}
