import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useDialogo } from '@/shared/hooks/useDialogo'
import { useSessao } from '@/features/auth'
import { erroRpc } from '@/shared/lib/erroRpc'
import { Alert, AlertDescription } from '@/shared/ui/alert'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { Campo } from '@/shared/ui/campo'
import { CampoSelecao } from '@/shared/ui/campo-selecao'
import { Confirmar } from '@/shared/ui/confirmar'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/shared/ui/dialog'
import { MensagemErro } from '@/shared/ui/mensagem-erro'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/ui/table'
import type { PerfilUsuario, StatusUsuario, Usuario } from '../api/usuariosApi'
import {
  useAlterarPerfilUsuario,
  useAlterarStatusUsuario,
  useAtualizarUsuario,
  useUsuarios,
} from '../hooks/useUsuarios'
import { dadosUsuarioSchema, type DadosUsuarioForm } from '../schemas/usuariosSchemas'
import { ROTULO_PERFIL, ROTULO_STATUS } from './rotulos'

type Acao =
  | { tipo: 'status'; usuario: Usuario; status: StatusUsuario }
  | { tipo: 'perfil'; usuario: Usuario; perfil: PerfilUsuario }

const TEXTO_ACAO: Record<
  'aprovar' | 'inativar' | 'reativar' | 'promover' | 'rebaixar',
  {
    titulo: string
    botao: string
    descricao: (nome: string) => string
    feito: (nome: string) => string
  }
> = {
  aprovar: {
    titulo: 'Aprovar acesso',
    botao: 'Aprovar',
    descricao: (n) => `${n} passa a usar o sistema.`,
    feito: (n) => `Acesso de ${n} aprovado.`,
  },
  inativar: {
    titulo: 'Inativar usuário',
    botao: 'Inativar',
    descricao: (n) => `${n} perde o acesso ao sistema até ser reativado.`,
    feito: (n) => `${n} foi inativado.`,
  },
  reativar: {
    titulo: 'Reativar usuário',
    botao: 'Reativar',
    descricao: (n) => `${n} volta a ter acesso ao sistema.`,
    feito: (n) => `${n} foi reativado.`,
  },
  promover: {
    titulo: 'Promover a administrador',
    botao: 'Promover',
    descricao: (n) => `${n} poderá aprovar usuários, convidar e gerir o inventário.`,
    feito: (n) => `${n} agora é administrador.`,
  },
  rebaixar: {
    titulo: 'Rebaixar a solicitante',
    botao: 'Rebaixar',
    descricao: (n) => `${n} deixa de ter poderes de administrador.`,
    feito: (n) => `${n} agora é solicitante.`,
  },
}

function chaveAcao(a: Acao): keyof typeof TEXTO_ACAO {
  if (a.tipo === 'perfil') return a.perfil === 'admin' ? 'promover' : 'rebaixar'
  if (a.status === 'inativo') return 'inativar'
  return a.usuario.status === 'pendente' ? 'aprovar' : 'reativar'
}

/** spec-001/RF-05, RF-09, RF-16: lista, filtros e gestão de usuários. */
export function UsuariosPage() {
  const { perfil: eu } = useSessao()
  const usuarios = useUsuarios()
  const [filtroStatus, setFiltroStatus] = useState<'' | StatusUsuario>('')
  const [filtroPerfil, setFiltroPerfil] = useState<'' | PerfilUsuario>('')
  const acao = useDialogo<Acao>()
  const edicao = useDialogo<Usuario>()
  const [aviso, setAviso] = useState<string | null>(null)

  const lista = (usuarios.data ?? []).filter(
    (u) =>
      (!filtroStatus || u.status === filtroStatus) && (!filtroPerfil || u.perfil === filtroPerfil),
  )
  const abrir = (a: Acao) => {
    setAviso(null)
    acao.abrir(a)
  }

  return (
    <div className="grid max-w-5xl gap-6">
      <h2 className="text-xl font-semibold">Usuários</h2>

      <div className="flex flex-wrap gap-4">
        <div className="w-48">
          <CampoSelecao
            rotulo="Status"
            value={filtroStatus}
            onChange={(e) => setFiltroStatus(e.target.value as '' | StatusUsuario)}
            opcoes={[
              { valor: '', rotulo: 'Todos' },
              ...(['pendente', 'ativo', 'inativo'] as const).map((s) => ({
                valor: s,
                rotulo: ROTULO_STATUS[s],
              })),
            ]}
          />
        </div>
        <div className="w-48">
          <CampoSelecao
            rotulo="Perfil"
            value={filtroPerfil}
            onChange={(e) => setFiltroPerfil(e.target.value as '' | PerfilUsuario)}
            opcoes={[
              { valor: '', rotulo: 'Todos' },
              ...(['solicitante', 'admin'] as const).map((p) => ({
                valor: p,
                rotulo: ROTULO_PERFIL[p],
              })),
            ]}
          />
        </div>
      </div>

      {aviso && (
        <Alert role="status">
          <AlertDescription>{aviso}</AlertDescription>
        </Alert>
      )}

      {usuarios.isPending ? (
        <p role="status">Carregando usuários…</p>
      ) : usuarios.isError ? (
        <MensagemErro erro={erroRpc(usuarios.error)} />
      ) : lista.length === 0 ? (
        <p className="text-muted-foreground">Nenhum usuário com esses filtros.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>E-mail</TableHead>
              <TableHead>Matrícula</TableHead>
              <TableHead>Perfil</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>
                <span className="sr-only">Ações</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {lista.map((u) => {
              const souEu = u.id === eu?.id
              return (
                <TableRow key={u.id}>
                  <TableCell>
                    {u.nome}
                    {souEu && <span className="text-muted-foreground"> (você)</span>}
                  </TableCell>
                  <TableCell>{u.email}</TableCell>
                  <TableCell>{u.matricula}</TableCell>
                  <TableCell>{ROTULO_PERFIL[u.perfil]}</TableCell>
                  <TableCell>
                    <Badge variant={u.status === 'ativo' ? 'default' : 'secondary'}>
                      {ROTULO_STATUS[u.status]}
                    </Badge>
                  </TableCell>
                  <TableCell className="space-x-2 text-right whitespace-nowrap">
                    {/* RF-06: ninguém altera o próprio status/perfil (o banco também recusa) */}
                    {!souEu && u.status === 'pendente' && (
                      <Button
                        size="sm"
                        onClick={() => abrir({ tipo: 'status', usuario: u, status: 'ativo' })}
                      >
                        Aprovar
                      </Button>
                    )}
                    {!souEu && u.status === 'inativo' && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => abrir({ tipo: 'status', usuario: u, status: 'ativo' })}
                      >
                        Reativar
                      </Button>
                    )}
                    {!souEu && u.status !== 'inativo' && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => abrir({ tipo: 'status', usuario: u, status: 'inativo' })}
                      >
                        Inativar
                      </Button>
                    )}
                    {!souEu && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          abrir({
                            tipo: 'perfil',
                            usuario: u,
                            perfil: u.perfil === 'admin' ? 'solicitante' : 'admin',
                          })
                        }
                      >
                        {u.perfil === 'admin' ? 'Rebaixar' : 'Promover'}
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setAviso(null)
                        edicao.abrir(u)
                      }}
                    >
                      Editar
                    </Button>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      )}

      <ConfirmarAcao
        aberto={acao.aberto}
        acao={acao.dados}
        aoFechar={acao.fechar}
        aoConcluir={setAviso}
      />
      <EditarUsuario
        aberto={edicao.aberto}
        usuario={edicao.dados}
        aoFechar={edicao.fechar}
        aoConcluir={setAviso}
      />
    </div>
  )
}

function ConfirmarAcao({
  aberto,
  acao,
  aoFechar,
  aoConcluir,
}: {
  aberto: boolean
  acao: Acao | null
  aoFechar: () => void
  aoConcluir: (texto: string) => void
}) {
  const status = useAlterarStatusUsuario()
  const perfil = useAlterarPerfilUsuario()
  const mutacao = acao?.tipo === 'perfil' ? perfil : status
  const texto = acao ? TEXTO_ACAO[chaveAcao(acao)] : null

  const fechar = () => {
    status.reset()
    perfil.reset()
    aoFechar()
  }
  const concluir = () => {
    if (acao && texto) aoConcluir(texto.feito(acao.usuario.nome))
    fechar()
  }
  const confirmar = () => {
    if (!acao) return
    if (acao.tipo === 'status') {
      status.mutate({ id: acao.usuario.id, status: acao.status }, { onSuccess: concluir })
    } else {
      perfil.mutate({ id: acao.usuario.id, perfil: acao.perfil }, { onSuccess: concluir })
    }
  }

  return (
    <Confirmar
      aberto={aberto}
      titulo={texto?.titulo ?? ''}
      descricao={acao && texto ? texto.descricao(acao.usuario.nome) : ''}
      rotuloConfirmar={texto?.botao ?? ''}
      destrutivo={acao?.tipo === 'status' && acao.status === 'inativo'}
      enviando={mutacao.isPending}
      erro={mutacao.isError ? erroRpc(mutacao.error).mensagem : null}
      aoConfirmar={confirmar}
      aoFechar={fechar}
    />
  )
}

function EditarUsuario({
  aberto,
  usuario,
  aoFechar,
  aoConcluir,
}: {
  aberto: boolean
  usuario: Usuario | null
  aoFechar: () => void
  aoConcluir: (texto: string) => void
}) {
  return (
    <Dialog open={aberto} onOpenChange={(abrir) => !abrir && aoFechar()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar usuário</DialogTitle>
        </DialogHeader>
        {usuario && (
          <FormEditarUsuario
            key={`${usuario.id}-${usuario.atualizado_em}`}
            usuario={usuario}
            aoFechar={aoFechar}
            aoConcluir={aoConcluir}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

function FormEditarUsuario({
  usuario,
  aoFechar,
  aoConcluir,
}: {
  usuario: Usuario
  aoFechar: () => void
  aoConcluir: (texto: string) => void
}) {
  const atualizar = useAtualizarUsuario()
  const form = useForm<DadosUsuarioForm>({
    resolver: zodResolver(dadosUsuarioSchema),
    defaultValues: { nome: usuario.nome, matricula: usuario.matricula ?? '' },
  })
  return (
    <form
      className="grid gap-4"
      noValidate
      onSubmit={form.handleSubmit((v) =>
        atualizar.mutate(
          { id: usuario.id, ...v },
          {
            onSuccess: () => {
              aoConcluir(`Dados de ${v.nome} atualizados.`)
              aoFechar()
            },
          },
        ),
      )}
    >
      <p className="text-muted-foreground text-sm">{usuario.email}</p>
      <Campo rotulo="Nome" erro={form.formState.errors.nome?.message} {...form.register('nome')} />
      <Campo rotulo="Matrícula (opcional)" {...form.register('matricula')} />
      <MensagemErro erro={atualizar.isError ? erroRpc(atualizar.error) : null} />
      <DialogFooter>
        <Button type="button" variant="outline" onClick={aoFechar}>
          Voltar
        </Button>
        <Button type="submit" disabled={atualizar.isPending}>
          {atualizar.isPending ? 'Salvando…' : 'Salvar'}
        </Button>
      </DialogFooter>
    </form>
  )
}
