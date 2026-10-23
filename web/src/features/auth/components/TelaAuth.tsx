import type { ReactNode } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/ui/card'

/** Moldura das telas fora da área logada (login, senha, avisos de status). */
export function TelaAuth({
  titulo,
  descricao,
  children,
}: {
  titulo: string
  descricao?: ReactNode
  children?: ReactNode
}) {
  return (
    <div className="mx-auto mt-12 w-full max-w-sm">
      <Card>
        <CardHeader>
          <CardTitle>
            <h2>{titulo}</h2>
          </CardTitle>
          {descricao && <CardDescription>{descricao}</CardDescription>}
        </CardHeader>
        {children && <CardContent className="grid gap-4">{children}</CardContent>}
      </Card>
    </div>
  )
}
