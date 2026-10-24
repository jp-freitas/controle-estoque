import { supabase } from '@/lib/supabase'

/**
 * spec-003/RF-05: envia o carrinho. O banco valida tudo de novo e, se algum item
 * falhar, não cria nada e devolve a lista em `details` (RF-07).
 */
export async function enviarSolicitacao(
  itens: { item_id: string; quantidade: number }[],
  justificativa: string,
): Promise<string> {
  const { data, error } = await supabase.rpc('enviar_solicitacao', {
    p_itens: itens,
    p_justificativa: justificativa,
  })
  if (error) throw error
  return data
}
