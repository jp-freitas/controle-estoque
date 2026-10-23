import type { ReactNode } from 'react'
import { Button } from './button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './dialog'
import { MensagemErro } from './mensagem-erro'

/** Diálogo de confirmação controlado, para ações que mudam dados. */
export function Confirmar({
  aberto,
  titulo,
  descricao,
  rotuloConfirmar,
  destrutivo = false,
  enviando = false,
  erro,
  aoConfirmar,
  aoFechar,
}: {
  aberto: boolean
  titulo: string
  descricao: ReactNode
  rotuloConfirmar: string
  destrutivo?: boolean
  enviando?: boolean
  erro?: string | null
  aoConfirmar: () => void
  aoFechar: () => void
}) {
  return (
    <Dialog open={aberto} onOpenChange={(abrir) => !abrir && aoFechar()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{titulo}</DialogTitle>
          <DialogDescription>{descricao}</DialogDescription>
        </DialogHeader>
        <MensagemErro erro={erro} />
        <DialogFooter>
          <Button variant="outline" onClick={aoFechar} disabled={enviando}>
            Voltar
          </Button>
          <Button
            variant={destrutivo ? 'destructive' : 'default'}
            onClick={aoConfirmar}
            disabled={enviando}
          >
            {enviando ? 'Aguarde…' : rotuloConfirmar}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
