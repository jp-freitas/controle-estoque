import { useState } from 'react'
import { useLocation } from 'react-router'
import { useDialogo } from '@/shared/hooks/useDialogo'
import { erroRpc } from '@/shared/lib/erroRpc'
import { formatarDataHora } from '@/shared/lib/formato'
import { Alert, AlertDescription } from '@/shared/ui/alert'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card'
import { Confirmar } from '@/shared/ui/confirmar'
import { MensagemErro } from '@/shared/ui/mensagem-erro'
import type { Solicitacao } from '../api/solicitacoesApi'
import { useCancelarSolicitacao, useMinhasSolicitacoes } from '../hooks/useSolicitacoes'
import { ROTULO_STATUS_SOLICITACAO } from './rotulos'

/** spec-003/RF-08, RF-09: minhas solicitações, com cancelamento enquanto pendente. */
export function MinhasSolicitacoesPage() {
  const solicitacoes = useMinhasSolicitacoes()
  const location = useLocation()
  // aviso vindo do envio do carrinho
  const [aviso, setAviso] = useState<string | null>(
    (location.state as { aviso?: string } | null)?.aviso ?? null,
  )
  const cancelamento = useDialogo<Solicitacao>()

  return (
    <div className="grid max-w-4xl gap-6">
      <h2 className="text-xl font-semibold">Minhas solicitações</h2>
      {aviso && (
        <Alert role="status">
          <AlertDescription>{aviso}</AlertDescription>
        </Alert>
      )}

      {solicitacoes.isPending ? (
        <p role="status">Carregando solicitações…</p>
      ) : solicitacoes.isError ? (
        <MensagemErro erro={erroRpc(solicitacoes.error)} />
      ) : solicitacoes.data.length === 0 ? (
        <p className="text-muted-foreground">Você ainda não enviou solicitações.</p>
      ) : (
        <ul className="grid gap-4" aria-label="Solicitações">
          {solicitacoes.data.map((s) => (
            <li key={s.id}>
              <CartaoSolicitacao
                solicitacao={s}
                aoCancelar={() => {
                  setAviso(null)
                  cancelamento.abrir(s)
                }}
              />
            </li>
          ))}
        </ul>
      )}

      <CancelarSolicitacao
        aberto={cancelamento.aberto}
        solicitacao={cancelamento.dados}
        aoFechar={cancelamento.fechar}
        aoConcluir={setAviso}
      />
    </div>
  )
}

function CartaoSolicitacao({
  solicitacao: s,
  aoCancelar,
}: {
  solicitacao: Solicitacao
  aoCancelar: () => void
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-3">
          <h3 className="text-base">Enviada em {formatarDataHora(s.criado_em)}</h3>
          <Badge variant={s.status === 'pendente' ? 'default' : 'secondary'}>
            {ROTULO_STATUS_SOLICITACAO[s.status]}
          </Badge>
          {/* RF-09: o solicitante só cancela enquanto pendente */}
          {s.status === 'pendente' && (
            <Button size="sm" variant="outline" className="ml-auto" onClick={aoCancelar}>
              Cancelar
            </Button>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-2 text-sm">
        <p>
          <span className="text-muted-foreground">Justificativa: </span>
          {s.justificativa}
        </p>
        <ul className="list-disc pl-5">
          {s.solicitacao_item.map((l) => (
            <li key={l.id}>
              {l.quantidade_solicitada} × {l.item_nome}
            </li>
          ))}
        </ul>
        {s.cancelado_em && (
          <p className="text-muted-foreground">Cancelada em {formatarDataHora(s.cancelado_em)}.</p>
        )}
      </CardContent>
    </Card>
  )
}

function CancelarSolicitacao({
  aberto,
  solicitacao,
  aoFechar,
  aoConcluir,
}: {
  aberto: boolean
  solicitacao: Solicitacao | null
  aoFechar: () => void
  aoConcluir: (aviso: string) => void
}) {
  const cancelar = useCancelarSolicitacao()
  const fechar = () => {
    cancelar.reset()
    aoFechar()
  }
  return (
    <Confirmar
      aberto={aberto}
      titulo="Cancelar solicitação"
      descricao="A solicitação deixa de ser analisada. Para pedir de novo, monte outro carrinho."
      rotuloConfirmar="Cancelar solicitação"
      destrutivo
      enviando={cancelar.isPending}
      erro={cancelar.isError ? erroRpc(cancelar.error).mensagem : null}
      aoFechar={fechar}
      aoConfirmar={() =>
        solicitacao &&
        cancelar.mutate(solicitacao.id, {
          onSuccess: () => {
            aoConcluir('Solicitação cancelada.')
            fechar()
          },
        })
      }
    />
  )
}
