import { useState } from 'react'
import { useSessao } from '@/features/auth'
import { useDialogo } from '@/shared/hooks/useDialogo'
import { erroRpc, type ErroRpc } from '@/shared/lib/erroRpc'
import { formatarDataHora } from '@/shared/lib/formato'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { Campo } from '@/shared/ui/campo'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card'
import { ConfirmarComMotivo } from '@/shared/ui/confirmar-motivo'
import { Input } from '@/shared/ui/input'
import { MensagemErro } from '@/shared/ui/mensagem-erro'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/ui/table'
import type { LinhaFila, SolicitacaoPendente } from '../api/aprovacaoApi'
import { useAprovar, useRecusar } from '../hooks/useAprovacao'
import { quantidadeSugerida } from './sugestao'

/** spec-004/RF-04 a RF-09, RF-14: decidir uma solicitação pendente. */
export function DecidirSolicitacao({
  solicitacao: s,
  aoConcluir,
}: {
  solicitacao: SolicitacaoPendente
  aoConcluir: (aviso: string) => void
}) {
  const { perfil } = useSessao()
  const aprovar = useAprovar()
  const recusar = useRecusar()
  const recusa = useDialogo<null>()
  const [qtds, setQtds] = useState(() =>
    Object.fromEntries(s.itens.map((l) => [l.solicitacao_item_id, String(quantidadeSugerida(l))])),
  )
  const [observacao, setObservacao] = useState('')
  const [erro, setErro] = useState<ErroRpc | null>(null)

  const propria = s.solicitante_id === perfil?.id
  const solicitanteFora = s.solicitante_status !== 'ativo'
  // RF-07 / CA-09: o motivo de cada item recusado aparece na linha dele
  const motivoDe = (itemId: string) => erro?.itens.find((i) => i.item_id === itemId)?.motivo
  const invalida = (l: LinhaFila) => {
    const v = qtds[l.solicitacao_item_id] ?? ''
    return !/^\d+$/.test(v) || Number(v) > l.quantidade_solicitada
  }

  const confirmarAprovacao = () => {
    setErro(null)
    if (s.itens.some(invalida)) {
      setErro({ mensagem: 'A quantidade aprovada deve ficar entre 0 e a solicitada.', itens: [] })
      return
    }
    aprovar.mutate(
      {
        id: s.id,
        itens: s.itens.map((l) => ({
          solicitacao_item_id: l.solicitacao_item_id,
          quantidade_aprovada: Number(qtds[l.solicitacao_item_id]),
        })),
        observacao,
      },
      {
        onSuccess: () => aoConcluir(`Solicitação de ${s.solicitante_nome} aprovada.`),
        onError: (e) => setErro(erroRpc(e)),
      },
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-3">
          <h3 className="text-base">{s.solicitante_nome}</h3>
          {solicitanteFora && <Badge variant="destructive">Solicitante não está ativo</Badge>}
          <span className="text-muted-foreground text-sm font-normal">
            Enviada em {formatarDataHora(s.criado_em)}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4">
        <p className="text-sm">
          <span className="text-muted-foreground">Justificativa: </span>
          {s.justificativa}
        </p>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Item</TableHead>
              <TableHead className="text-right">Solicitada</TableHead>
              <TableHead className="text-right">Disponível agora</TableHead>
              <TableHead className="w-28">Aprovar</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {s.itens.map((l) => (
              <TableRow key={l.solicitacao_item_id}>
                <TableCell>
                  {l.item_nome}
                  {!l.operante && (
                    <Badge variant="destructive" className="ml-2">
                      Inoperante
                    </Badge>
                  )}
                  {!l.ativo && (
                    <Badge variant="secondary" className="ml-2">
                      Desativado
                    </Badge>
                  )}
                  {motivoDe(l.item_id) && (
                    <p className="text-destructive text-sm">Recusado: {motivoDe(l.item_id)}</p>
                  )}
                </TableCell>
                <TableCell className="text-right tabular-nums">{l.quantidade_solicitada}</TableCell>
                <TableCell className="text-right tabular-nums">{l.disponivel}</TableCell>
                <TableCell>
                  <Input
                    type="number"
                    min={0}
                    max={l.quantidade_solicitada}
                    aria-label={`Quantidade aprovada de ${l.item_nome}`}
                    aria-invalid={invalida(l) || undefined}
                    value={qtds[l.solicitacao_item_id] ?? ''}
                    onChange={(e) =>
                      setQtds((q) => ({ ...q, [l.solicitacao_item_id]: e.target.value }))
                    }
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <Campo
          rotulo="Observação para o professor (opcional)"
          value={observacao}
          onChange={(e) => setObservacao(e.target.value)}
        />
        {erro && <MensagemErro erro={{ mensagem: erro.mensagem, itens: [] }} />}
        {propria ? (
          // RF-02 / CA-05
          <p className="text-muted-foreground text-sm">
            Esta solicitação é sua: outro administrador precisa decidir.
          </p>
        ) : (
          <div className="flex flex-wrap gap-3">
            <Button onClick={confirmarAprovacao} disabled={aprovar.isPending || solicitanteFora}>
              {aprovar.isPending ? 'Aprovando…' : 'Aprovar'}
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                recusar.reset()
                recusa.abrir(null)
              }}
            >
              Recusar
            </Button>
          </div>
        )}
      </CardContent>
      <ConfirmarComMotivo
        aberto={recusa.aberto}
        titulo="Recusar solicitação"
        descricao={`${s.solicitante_nome} verá o motivo em "Minhas solicitações".`}
        rotuloConfirmar="Recusar"
        mensagemSemMotivo="Informe o motivo da recusa."
        enviando={recusar.isPending}
        erro={recusar.isError ? erroRpc(recusar.error).mensagem : null}
        aoFechar={recusa.fechar}
        aoConfirmar={(motivo) =>
          recusar.mutate(
            { id: s.id, motivo },
            {
              onSuccess: () => {
                recusa.fechar()
                aoConcluir(`Solicitação de ${s.solicitante_nome} recusada.`)
              },
            },
          )
        }
      />
    </Card>
  )
}
