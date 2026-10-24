import { useState, type ReactNode } from 'react'
import { Button } from './button'
import { Campo } from './campo'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './dialog'
import { MensagemErro } from './mensagem-erro'

/**
 * Confirmação que pede um motivo obrigatório (recusar, cancelar…). O motivo é
 * conferido aqui por conveniência; o banco confere de novo.
 */
export function ConfirmarComMotivo({
  aberto,
  titulo,
  descricao,
  rotuloConfirmar,
  mensagemSemMotivo,
  enviando = false,
  erro,
  aoConfirmar,
  aoFechar,
}: {
  aberto: boolean
  titulo: string
  descricao: ReactNode
  rotuloConfirmar: string
  mensagemSemMotivo: string
  enviando?: boolean
  erro?: string | null
  aoConfirmar: (motivo: string) => void
  aoFechar: () => void
}) {
  return (
    <Dialog open={aberto} onOpenChange={(abrir) => !abrir && aoFechar()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{titulo}</DialogTitle>
          <DialogDescription>{descricao}</DialogDescription>
        </DialogHeader>
        {/* remonta a cada abertura: o motivo começa vazio */}
        {aberto && (
          <FormMotivo
            rotuloConfirmar={rotuloConfirmar}
            mensagemSemMotivo={mensagemSemMotivo}
            enviando={enviando}
            erro={erro}
            aoConfirmar={aoConfirmar}
            aoFechar={aoFechar}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

function FormMotivo({
  rotuloConfirmar,
  mensagemSemMotivo,
  enviando,
  erro,
  aoConfirmar,
  aoFechar,
}: {
  rotuloConfirmar: string
  mensagemSemMotivo: string
  enviando: boolean
  erro?: string | null
  aoConfirmar: (motivo: string) => void
  aoFechar: () => void
}) {
  const [motivo, setMotivo] = useState('')
  const [semMotivo, setSemMotivo] = useState(false)
  return (
    <form
      className="grid gap-4"
      noValidate
      onSubmit={(e) => {
        e.preventDefault()
        if (!motivo.trim()) return setSemMotivo(true)
        aoConfirmar(motivo.trim())
      }}
    >
      <Campo
        rotulo="Motivo"
        value={motivo}
        erro={semMotivo ? mensagemSemMotivo : undefined}
        onChange={(e) => {
          setMotivo(e.target.value)
          setSemMotivo(false)
        }}
      />
      <MensagemErro erro={erro} />
      <DialogFooter>
        <Button type="button" variant="outline" onClick={aoFechar} disabled={enviando}>
          Voltar
        </Button>
        <Button type="submit" variant="destructive" disabled={enviando}>
          {enviando ? 'Aguarde…' : rotuloConfirmar}
        </Button>
      </DialogFooter>
    </form>
  )
}
