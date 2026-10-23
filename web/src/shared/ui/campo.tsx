import { useId, type ComponentProps } from 'react'
import { Input } from './input'
import { Label } from './label'

/** Rótulo + input + mensagem de erro, ligados por id para leitores de tela. */
export function Campo({
  rotulo,
  erro,
  ...props
}: ComponentProps<typeof Input> & { rotulo: string; erro?: string }) {
  const id = useId()
  const idErro = `${id}-erro`
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{rotulo}</Label>
      <Input
        id={id}
        aria-invalid={erro ? true : undefined}
        aria-describedby={erro ? idErro : undefined}
        {...props}
      />
      {erro && (
        <p id={idErro} className="text-destructive text-sm">
          {erro}
        </p>
      )}
    </div>
  )
}
