import type { LinhaFila } from '../api/aprovacaoApi'

/** Sugestão inicial da quantidade aprovada: o que dá para atender agora (spec-004/plan, T-13). */
export function quantidadeSugerida(l: LinhaFila): number {
  if (!l.ativo || !l.operante) return 0
  return Math.max(0, Math.min(l.quantidade_solicitada, l.disponivel))
}
