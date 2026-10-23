import { useId, type ComponentProps } from 'react'
import { Label } from './label'

/** Caixa de marcação nativa com rótulo clicável. */
export function CampoMarcacao({
  rotulo,
  ...props
}: Omit<ComponentProps<'input'>, 'type'> & { rotulo: string }) {
  const id = useId()
  return (
    <div className="flex items-center gap-2">
      <input id={id} type="checkbox" className="accent-primary size-4" {...props} />
      <Label htmlFor={id} className="font-normal">
        {rotulo}
      </Label>
    </div>
  )
}
