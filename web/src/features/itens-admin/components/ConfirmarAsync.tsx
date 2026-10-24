import { useState } from 'react'
import { erroRpc } from '@/shared/lib/erroRpc'
import { Confirmar } from '@/shared/ui/confirmar'

export interface AcaoConfirmavel {
  titulo: string
  descricao: string
  rotulo: string
  destrutivo?: boolean
  /** Executa e devolve a mensagem de sucesso. */
  executar: () => Promise<string>
  /**
   * CA-08: se a ação falhar por histórico (FK, 23503), oferece esta no lugar —
   * por exemplo, desativar em vez de excluir.
   */
  alternativa?: Omit<AcaoConfirmavel, 'alternativa'>
}

const temHistorico = (e: unknown) =>
  typeof e === 'object' && e !== null && (e as { code?: unknown }).code === '23503'

/** Confirmação de uma ação assíncrona, com erro do banco e alternativa em caso de histórico. */
export function ConfirmarAsync({
  aberto,
  acao,
  aoFechar,
  aoConcluir,
}: {
  aberto: boolean
  acao: AcaoConfirmavel | null
  aoFechar: () => void
  aoConcluir: (mensagem: string) => void
}) {
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [usarAlternativa, setUsarAlternativa] = useState(false)
  const atual = usarAlternativa && acao?.alternativa ? acao.alternativa : acao

  const fechar = () => {
    setErro(null)
    setUsarAlternativa(false)
    aoFechar()
  }

  const confirmar = async () => {
    if (!atual) return
    setEnviando(true)
    setErro(null)
    try {
      aoConcluir(await atual.executar())
      fechar()
    } catch (e) {
      setErro(erroRpc(e).mensagem)
      if (!usarAlternativa && acao?.alternativa && temHistorico(e)) setUsarAlternativa(true)
    } finally {
      setEnviando(false)
    }
  }

  return (
    <Confirmar
      aberto={aberto}
      titulo={atual?.titulo ?? ''}
      descricao={atual?.descricao ?? ''}
      rotuloConfirmar={atual?.rotulo ?? ''}
      destrutivo={atual?.destrutivo}
      enviando={enviando}
      erro={erro}
      aoConfirmar={() => void confirmar()}
      aoFechar={fechar}
    />
  )
}
