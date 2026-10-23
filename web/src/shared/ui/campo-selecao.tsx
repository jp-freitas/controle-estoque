import { useId, type ComponentProps } from 'react'
import { cn } from '@/shared/lib/utils'
import { Label } from './label'

export const classeSelecao =
  'border-input bg-background h-9 w-full rounded-md border px-3 text-sm shadow-xs focus-visible:ring-ring/50 focus-visible:outline-none focus-visible:ring-[3px]'

/** Rótulo + <select> nativo (acessível e simples de testar). */
export function CampoSelecao({
  rotulo,
  opcoes,
  className,
  ...props
}: ComponentProps<'select'> & { rotulo: string; opcoes: { valor: string; rotulo: string }[] }) {
  const id = useId()
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{rotulo}</Label>
      <select id={id} className={cn(classeSelecao, className)} {...props}>
        {opcoes.map((o) => (
          <option key={o.valor} value={o.valor}>
            {o.rotulo}
          </option>
        ))}
      </select>
    </div>
  )
}
