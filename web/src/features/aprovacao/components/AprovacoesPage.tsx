import { useState } from 'react'
import { useDialogo } from '@/shared/hooks/useDialogo'
import { erroRpc } from '@/shared/lib/erroRpc'
import { formatarDataHora } from '@/shared/lib/formato'
import { Alert, AlertDescription } from '@/shared/ui/alert'
import { Button } from '@/shared/ui/button'
import { ConfirmarComMotivo } from '@/shared/ui/confirmar-motivo'
import { MensagemErro } from '@/shared/ui/mensagem-erro'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/ui/table'
import type { SolicitacaoAprovada } from '../api/aprovacaoApi'
import { useAguardandoRetirada, useCancelarAprovada, useFila } from '../hooks/useAprovacao'
import { DecidirSolicitacao } from './DecidirSolicitacao'

type Aba = 'pendentes' | 'aguardando'

/** spec-004/RF-03, RF-10, RF-13: fila de pendentes e aprovadas aguardando retirada. */
export function AprovacoesPage() {
  const [aba, setAba] = useState<Aba>('pendentes')
  const [aviso, setAviso] = useState<string | null>(null)
  const fila = useFila()
  const aguardando = useAguardandoRetirada()

  const botaoAba = (valor: Aba, rotulo: string) => (
    <Button
      variant={aba === valor ? 'default' : 'outline'}
      aria-pressed={aba === valor}
      onClick={() => {
        setAba(valor)
        setAviso(null)
      }}
    >
      {rotulo}
    </Button>
  )

  return (
    <div className="grid max-w-5xl gap-6">
      <h2 className="text-xl font-semibold">Aprovações</h2>
      <div className="flex flex-wrap gap-2">
        {botaoAba('pendentes', `Pendentes${fila.data ? ` (${fila.data.length})` : ''}`)}
        {botaoAba(
          'aguardando',
          `Aguardando retirada${aguardando.data ? ` (${aguardando.data.length})` : ''}`,
        )}
      </div>
      {aviso && (
        <Alert role="status">
          <AlertDescription>{aviso}</AlertDescription>
        </Alert>
      )}

      {aba === 'pendentes' ? (
        fila.isPending ? (
          <p role="status">Carregando pendentes…</p>
        ) : fila.isError ? (
          <MensagemErro erro={erroRpc(fila.error)} />
        ) : fila.data.length === 0 ? (
          <p className="text-muted-foreground">Nenhuma solicitação pendente.</p>
        ) : (
          <ul className="grid gap-4" aria-label="Solicitações pendentes">
            {fila.data.map((s) => (
              <li key={s.id}>
                <DecidirSolicitacao solicitacao={s} aoConcluir={setAviso} />
              </li>
            ))}
          </ul>
        )
      ) : aguardando.isPending ? (
        <p role="status">Carregando aprovadas…</p>
      ) : aguardando.isError ? (
        <MensagemErro erro={erroRpc(aguardando.error)} />
      ) : aguardando.data.length === 0 ? (
        <p className="text-muted-foreground">Nenhuma solicitação aguardando retirada.</p>
      ) : (
        <ListaAguardando solicitacoes={aguardando.data} aoConcluir={setAviso} />
      )}
    </div>
  )
}

const dias = (n: number) => (n === 0 ? 'hoje' : n === 1 ? 'há 1 dia' : `há ${n} dias`)

/** RF-13 / CA-12 e RF-10 / CA-08. */
function ListaAguardando({
  solicitacoes,
  aoConcluir,
}: {
  solicitacoes: SolicitacaoAprovada[]
  aoConcluir: (aviso: string) => void
}) {
  const cancelamento = useDialogo<SolicitacaoAprovada>()
  const cancelar = useCancelarAprovada()
  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Solicitante</TableHead>
            <TableHead>Itens aprovados</TableHead>
            <TableHead>Aprovada</TableHead>
            <TableHead>
              <span className="sr-only">Ações</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {solicitacoes.map((s) => (
            <TableRow key={s.id}>
              <TableCell>
                {s.solicitante_nome}
                <p className="text-muted-foreground text-sm">{s.justificativa}</p>
              </TableCell>
              <TableCell>
                <ul>
                  {(s.itens ?? []).map((l) => (
                    <li key={l.solicitacao_item_id}>
                      {l.quantidade_aprovada} × {l.item_nome}
                    </li>
                  ))}
                </ul>
              </TableCell>
              <TableCell>
                <span className="font-medium">{dias(s.dias_aguardando)}</span>
                <p className="text-muted-foreground text-sm">
                  {formatarDataHora(s.data_decisao)}
                  {s.aprovador_nome && ` por ${s.aprovador_nome}`}
                </p>
              </TableCell>
              <TableCell className="text-right">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    cancelar.reset()
                    cancelamento.abrir(s)
                  }}
                >
                  Cancelar
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <ConfirmarComMotivo
        aberto={cancelamento.aberto}
        titulo="Cancelar solicitação aprovada"
        descricao="A reserva volta para o estoque disponível."
        rotuloConfirmar="Cancelar solicitação"
        mensagemSemMotivo="Informe o motivo do cancelamento."
        enviando={cancelar.isPending}
        erro={cancelar.isError ? erroRpc(cancelar.error).mensagem : null}
        aoFechar={cancelamento.fechar}
        aoConfirmar={(motivo) => {
          const s = cancelamento.dados
          if (!s) return
          cancelar.mutate(
            { id: s.id, motivo },
            {
              onSuccess: () => {
                cancelamento.fechar()
                aoConcluir(
                  `Solicitação de ${s.solicitante_nome} cancelada; a reserva foi liberada.`,
                )
              },
            },
          )
        }}
      />
    </>
  )
}
