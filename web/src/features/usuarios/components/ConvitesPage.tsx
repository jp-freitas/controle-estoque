import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useDialogo } from '@/shared/hooks/useDialogo'
import { mensagemErroAuth } from '@/features/auth'
import { erroRpc } from '@/shared/lib/erroRpc'
import { formatarDataHora } from '@/shared/lib/formato'
import { Alert, AlertDescription } from '@/shared/ui/alert'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { Campo } from '@/shared/ui/campo'
import { CampoSelecao } from '@/shared/ui/campo-selecao'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card'
import { Confirmar } from '@/shared/ui/confirmar'
import { MensagemErro } from '@/shared/ui/mensagem-erro'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/ui/table'
import type { Convite } from '../api/usuariosApi'
import {
  useCancelarConvite,
  useConvidar,
  useConvites,
  useReenviarConvite,
} from '../hooks/useUsuarios'
import { conviteSchema, type ConviteForm } from '../schemas/usuariosSchemas'
import { OPCOES_PERFIL, ROTULO_PERFIL, ROTULO_SITUACAO, type SituacaoConvite } from './rotulos'

type Aviso = { tipo: 'ok' | 'erro'; texto: string } | null

const situacaoDe = (c: Convite) => (c.situacao ?? 'expirado') as SituacaoConvite

/** spec-001/RF-10, RF-13: convidar, listar, reenviar e cancelar convites. */
export function ConvitesPage() {
  const [aviso, setAviso] = useState<Aviso>(null)
  const cancelamento = useDialogo<Convite>()

  return (
    <div className="grid max-w-5xl gap-6">
      <h2 className="text-xl font-semibold">Convites</h2>
      <NovoConvite aoConcluir={setAviso} />
      {aviso && (
        <Alert variant={aviso.tipo === 'erro' ? 'destructive' : 'default'} role="status">
          <AlertDescription>{aviso.texto}</AlertDescription>
        </Alert>
      )}
      <ListaConvites
        aoAvisar={setAviso}
        aoCancelar={(c) => {
          setAviso(null)
          cancelamento.abrir(c)
        }}
      />
      <CancelarConvite
        aberto={cancelamento.aberto}
        convite={cancelamento.dados}
        aoFechar={cancelamento.fechar}
        aoAvisar={setAviso}
      />
    </div>
  )
}

function NovoConvite({ aoConcluir }: { aoConcluir: (a: Aviso) => void }) {
  const convidar = useConvidar()
  const form = useForm<ConviteForm>({
    resolver: zodResolver(conviteSchema),
    defaultValues: { email: '', nome: '', matricula: '', perfil: 'solicitante' },
  })

  const enviar = form.handleSubmit((dados) => {
    aoConcluir(null)
    convidar.mutate(dados, {
      onSuccess: (r) => {
        form.reset()
        aoConcluir(
          r.emailEnviado
            ? { tipo: 'ok', texto: `Convite enviado para ${dados.email}. Ele vale por 7 dias.` }
            : {
                tipo: 'erro',
                texto: `Convite registrado, mas o e-mail não foi enviado (${mensagemErroAuth(r.erroEmail)}). Use "Reenviar" na lista.`,
              },
        )
      },
    })
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h3>Novo convite</h3>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form className="grid gap-4 sm:grid-cols-2" noValidate onSubmit={enviar}>
          <Campo
            rotulo="E-mail"
            type="email"
            erro={form.formState.errors.email?.message}
            {...form.register('email')}
          />
          <Campo
            rotulo="Nome"
            erro={form.formState.errors.nome?.message}
            {...form.register('nome')}
          />
          <Campo rotulo="Matrícula (opcional)" {...form.register('matricula')} />
          <CampoSelecao rotulo="Perfil" opcoes={OPCOES_PERFIL} {...form.register('perfil')} />
          <div className="grid gap-3 sm:col-span-2">
            <MensagemErro erro={convidar.isError ? erroRpc(convidar.error) : null} />
            <Button type="submit" className="justify-self-start" disabled={convidar.isPending}>
              {convidar.isPending ? 'Enviando…' : 'Enviar convite'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}

function ListaConvites({
  aoAvisar,
  aoCancelar,
}: {
  aoAvisar: (a: Aviso) => void
  aoCancelar: (c: Convite) => void
}) {
  const convites = useConvites()
  const reenviar = useReenviarConvite()

  if (convites.isPending) return <p role="status">Carregando convites…</p>
  if (convites.isError) return <MensagemErro erro={erroRpc(convites.error)} />
  if (convites.data.length === 0)
    return <p className="text-muted-foreground">Nenhum convite ainda.</p>

  const aoReenviar = (email: string) => {
    aoAvisar(null)
    reenviar.mutate(email, {
      onSuccess: () => aoAvisar({ tipo: 'ok', texto: `E-mail reenviado para ${email}.` }),
      onError: (e) => aoAvisar({ tipo: 'erro', texto: mensagemErroAuth(e) }),
    })
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>E-mail</TableHead>
          <TableHead>Nome</TableHead>
          <TableHead>Perfil</TableHead>
          <TableHead>Situação</TableHead>
          <TableHead>Válido até</TableHead>
          <TableHead>
            <span className="sr-only">Ações</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {convites.data.map((c) => {
          const situacao = situacaoDe(c)
          return (
            <TableRow key={c.id}>
              <TableCell>{c.email}</TableCell>
              <TableCell>{c.nome}</TableCell>
              <TableCell>{c.perfil ? ROTULO_PERFIL[c.perfil] : ''}</TableCell>
              <TableCell>
                <Badge variant={situacao === 'enviado' ? 'default' : 'secondary'}>
                  {ROTULO_SITUACAO[situacao]}
                </Badge>
              </TableCell>
              <TableCell>
                {situacao === 'enviado' || situacao === 'expirado'
                  ? formatarDataHora(c.expira_em)
                  : ''}
              </TableCell>
              <TableCell className="space-x-2 text-right">
                {/* RF-13: reenviar só convite válido; reenviar não renova o prazo (RF-12) */}
                {situacao === 'enviado' && c.email && (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={reenviar.isPending}
                    onClick={() => aoReenviar(c.email!)}
                  >
                    Reenviar
                  </Button>
                )}
                {(situacao === 'enviado' || situacao === 'expirado') && (
                  <Button size="sm" variant="ghost" onClick={() => aoCancelar(c)}>
                    Cancelar
                  </Button>
                )}
              </TableCell>
            </TableRow>
          )
        })}
      </TableBody>
    </Table>
  )
}

function CancelarConvite({
  aberto,
  convite,
  aoFechar,
  aoAvisar,
}: {
  aberto: boolean
  convite: Convite | null
  aoFechar: () => void
  aoAvisar: (a: Aviso) => void
}) {
  const cancelar = useCancelarConvite()
  const fechar = () => {
    cancelar.reset()
    aoFechar()
  }
  return (
    <Confirmar
      aberto={aberto}
      titulo="Cancelar convite"
      descricao={`O convite de ${convite?.email ?? ''} deixará de valer. Para convidar de novo, crie outro convite.`}
      rotuloConfirmar="Cancelar convite"
      destrutivo
      enviando={cancelar.isPending}
      erro={cancelar.isError ? erroRpc(cancelar.error).mensagem : null}
      aoFechar={fechar}
      aoConfirmar={() =>
        convite?.id &&
        cancelar.mutate(convite.id, {
          onSuccess: () => {
            aoAvisar({ tipo: 'ok', texto: `Convite de ${convite.email} cancelado.` })
            fechar()
          },
        })
      }
    />
  )
}
