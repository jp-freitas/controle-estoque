import type { ErroRpc } from '@/shared/lib/erroRpc'
import { Alert, AlertDescription } from './alert'

/** Exibe a mensagem (e a lista por item, quando houver) de um erro já convertido. */
export function MensagemErro({ erro }: { erro: ErroRpc | string | null | undefined }) {
  if (!erro) return null
  const { mensagem, itens } = typeof erro === 'string' ? { mensagem: erro, itens: [] } : erro
  return (
    <Alert variant="destructive" role="alert">
      <AlertDescription>
        <p>{mensagem}</p>
        {itens.length > 0 && (
          <ul className="mt-1 list-disc pl-5">
            {itens.map((i) => (
              <li key={i.item_id}>
                {i.nome}: {i.motivo}
              </li>
            ))}
          </ul>
        )}
      </AlertDescription>
    </Alert>
  )
}
