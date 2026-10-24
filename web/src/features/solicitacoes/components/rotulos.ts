import type { StatusSolicitacao } from '../api/solicitacoesApi'

export const ROTULO_STATUS_SOLICITACAO: Record<StatusSolicitacao, string> = {
  pendente: 'Pendente',
  aprovada: 'Aprovada',
  retirada: 'Retirada',
  concluida: 'Concluída',
  cancelada: 'Cancelada',
  recusada: 'Recusada',
}
