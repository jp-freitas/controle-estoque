import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useNavigate } from 'react-router'
import { erroRpc, type ErroRpc } from '@/shared/lib/erroRpc'
import { Alert, AlertDescription } from '@/shared/ui/alert'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { Campo } from '@/shared/ui/campo'
import { Input } from '@/shared/ui/input'
import { MensagemErro } from '@/shared/ui/mensagem-erro'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/ui/table'
import type { LinhaCarrinho } from '../hooks/carrinho'
import { useCarrinho } from '../hooks/carrinhoContext'
import { useEnviarSolicitacao } from '../hooks/useEnviarSolicitacao'
import { envioSchema, type EnvioForm } from '../schemas/carrinhoSchemas'

/** spec-003/RF-02 a RF-07, CA-09: carrinho, justificativa e envio. */
export function CarrinhoPage() {
  const { linhas, avisos, conferindo, executar } = useCarrinho()
  const enviar = useEnviarSolicitacao()
  const navigate = useNavigate()
  const [erro, setErro] = useState<ErroRpc | null>(null)
  const form = useForm<EnvioForm>({
    resolver: zodResolver(envioSchema),
    defaultValues: { justificativa: '' },
  })

  const temInoperante = linhas.some((l) => l.inoperante)
  // RF-07: o motivo de cada item recusado aparece na linha dele
  const motivoDe = (itemId: string) => erro?.itens.find((i) => i.item_id === itemId)?.motivo

  const submeter = form.handleSubmit((v) => {
    setErro(null)
    enviar.mutate(
      {
        itens: linhas.map((l) => ({ item_id: l.itemId, quantidade: l.quantidade })),
        justificativa: v.justificativa,
      },
      {
        onSuccess: () => {
          executar({ tipo: 'limpar' })
          navigate('/minhas-solicitacoes', {
            state: { aviso: 'Solicitação enviada. Ela aguarda a análise da administração.' },
          })
        },
        onError: (e) => setErro(erroRpc(e)),
      },
    )
  })

  if (linhas.length === 0) {
    return (
      <div className="grid max-w-3xl gap-6">
        <h2 className="text-xl font-semibold">Carrinho</h2>
        <Avisos avisos={avisos} />
        <p className="text-muted-foreground">
          O carrinho está vazio.{' '}
          <Link to="/" className="underline">
            Escolha itens no catálogo.
          </Link>
        </p>
      </div>
    )
  }

  return (
    <div className="grid max-w-3xl gap-6">
      <h2 className="text-xl font-semibold">Carrinho</h2>
      <Avisos avisos={avisos} />

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Item</TableHead>
            <TableHead className="w-32">Quantidade</TableHead>
            <TableHead>
              <span className="sr-only">Ações</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {linhas.map((l) => (
            <Linha
              key={l.itemId}
              linha={l}
              motivo={motivoDe(l.itemId)}
              aoAlterar={(quantidade) =>
                executar({ tipo: 'alterar', itemId: l.itemId, quantidade })
              }
              aoRemover={() => executar({ tipo: 'remover', itemId: l.itemId })}
            />
          ))}
        </TableBody>
      </Table>

      <form className="grid gap-4" noValidate onSubmit={submeter}>
        <Campo
          rotulo="Justificativa (aula, turma ou finalidade)"
          erro={form.formState.errors.justificativa?.message}
          {...form.register('justificativa')}
        />
        {temInoperante && (
          <MensagemErro erro="Remova os itens inoperantes para enviar a solicitação." />
        )}
        {erro && <MensagemErro erro={{ mensagem: erro.mensagem, itens: [] }} />}
        <div className="flex flex-wrap gap-3">
          <Button type="submit" disabled={enviar.isPending || conferindo || temInoperante}>
            {enviar.isPending ? 'Enviando…' : 'Enviar solicitação'}
          </Button>
          <Button type="button" variant="ghost" onClick={() => executar({ tipo: 'limpar' })}>
            Esvaziar carrinho
          </Button>
        </div>
      </form>
    </div>
  )
}

function Avisos({ avisos }: { avisos: string[] }) {
  if (avisos.length === 0) return null
  return (
    <Alert role="status">
      <AlertDescription>
        <p>O carrinho foi conferido com o catálogo atual:</p>
        <ul className="mt-1 list-disc pl-5">
          {avisos.map((a) => (
            <li key={a}>{a}</li>
          ))}
        </ul>
      </AlertDescription>
    </Alert>
  )
}

function Linha({
  linha: l,
  motivo,
  aoAlterar,
  aoRemover,
}: {
  linha: LinhaCarrinho
  motivo: string | undefined
  aoAlterar: (quantidade: number) => void
  aoRemover: () => void
}) {
  return (
    <TableRow>
      <TableCell>
        <span className="font-medium">{l.nome}</span>
        {l.inoperante && (
          <Badge variant="destructive" className="ml-2">
            Inoperante
          </Badge>
        )}
        <p className="text-muted-foreground text-sm">Disponível: {l.disponivel}</p>
        {motivo && <p className="text-destructive text-sm">Recusado: {motivo}</p>}
      </TableCell>
      <TableCell>
        {/* RF-04: não passa do disponível exibido (o banco confere de novo) */}
        <Input
          type="number"
          min={1}
          max={l.disponivel}
          aria-label={`Quantidade de ${l.nome}`}
          value={l.quantidade}
          onChange={(e) => {
            const valor = Number(e.target.value)
            if (Number.isInteger(valor) && valor >= 1) aoAlterar(Math.min(valor, l.disponivel))
          }}
        />
      </TableCell>
      <TableCell className="text-right">
        <Button size="sm" variant="ghost" aria-label={`Remover ${l.nome}`} onClick={aoRemover}>
          Remover
        </Button>
      </TableCell>
    </TableRow>
  )
}
