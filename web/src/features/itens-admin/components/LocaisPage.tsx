import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useDialogo } from '@/shared/hooks/useDialogo'
import { erroRpc } from '@/shared/lib/erroRpc'
import { Alert, AlertDescription } from '@/shared/ui/alert'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { Campo } from '@/shared/ui/campo'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/shared/ui/dialog'
import { MensagemErro } from '@/shared/ui/mensagem-erro'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/ui/table'
import type { Local } from '../api/itensAdminApi'
import {
  useAtualizarLocal,
  useCriarLocal,
  useExcluirLocal,
  useLocais,
} from '../hooks/useItensAdmin'
import { localSchema, type LocalForm } from '../schemas/itensAdminSchemas'
import { ConfirmarAsync, type AcaoConfirmavel } from './ConfirmarAsync'

/** spec-002/RF-04, CA-12, CA-13: locais. */
export function LocaisPage() {
  const locais = useLocais()
  const [aviso, setAviso] = useState<string | null>(null)
  const edicao = useDialogo<Local>()
  const confirmacao = useDialogo<AcaoConfirmavel>()
  const atualizar = useAtualizarLocal()
  const excluir = useExcluirLocal()

  const alternarAtivo = (l: Local): AcaoConfirmavel =>
    l.ativo
      ? {
          titulo: 'Desativar local',
          descricao: `Não será possível guardar itens em ${l.nome}. Só é possível desativar quando não há itens ativos no local.`,
          rotulo: 'Desativar',
          destrutivo: true,
          executar: async () => {
            await atualizar.mutateAsync({ id: l.id, dados: { ativo: false } })
            return `Local ${l.nome} desativado.`
          },
        }
      : {
          titulo: 'Reativar local',
          descricao: `${l.nome} volta a poder receber itens.`,
          rotulo: 'Reativar',
          executar: async () => {
            await atualizar.mutateAsync({ id: l.id, dados: { ativo: true } })
            return `Local ${l.nome} reativado.`
          },
        }

  const acaoExcluir = (l: Local): AcaoConfirmavel => ({
    titulo: 'Excluir local',
    descricao: `O local ${l.nome} será excluído.`,
    rotulo: 'Excluir',
    destrutivo: true,
    executar: async () => {
      await excluir.mutateAsync(l.id)
      return `Local ${l.nome} excluído.`
    },
    // local em uso não é excluído, só desativado
    alternativa: l.ativo ? { ...alternarAtivo(l), titulo: 'Local em uso' } : undefined,
  })

  const abrir = (a: AcaoConfirmavel) => {
    setAviso(null)
    confirmacao.abrir(a)
  }

  return (
    <div className="grid max-w-4xl gap-6">
      <h2 className="text-xl font-semibold">Locais</h2>
      <NovoLocal aoConcluir={setAviso} />
      {aviso && (
        <Alert role="status">
          <AlertDescription>{aviso}</AlertDescription>
        </Alert>
      )}

      {locais.isPending ? (
        <p role="status">Carregando locais…</p>
      ) : locais.isError ? (
        <MensagemErro erro={erroRpc(locais.error)} />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Descrição</TableHead>
              <TableHead>Situação</TableHead>
              <TableHead>
                <span className="sr-only">Ações</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {locais.data.map((l) => (
              <TableRow key={l.id}>
                <TableCell>{l.nome}</TableCell>
                <TableCell>{l.descricao}</TableCell>
                <TableCell>
                  <Badge variant={l.ativo ? 'default' : 'secondary'}>
                    {l.ativo ? 'Ativo' : 'Desativado'}
                  </Badge>
                </TableCell>
                <TableCell className="space-x-2 text-right whitespace-nowrap">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setAviso(null)
                      edicao.abrir(l)
                    }}
                  >
                    Editar
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => abrir(alternarAtivo(l))}>
                    {l.ativo ? 'Desativar' : 'Reativar'}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => abrir(acaoExcluir(l))}>
                    Excluir
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <Dialog open={edicao.aberto} onOpenChange={(a) => !a && edicao.fechar()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar local</DialogTitle>
          </DialogHeader>
          {edicao.dados && (
            <EditarLocal
              key={edicao.dados.id}
              local={edicao.dados}
              aoFechar={edicao.fechar}
              aoConcluir={setAviso}
            />
          )}
        </DialogContent>
      </Dialog>
      <ConfirmarAsync
        aberto={confirmacao.aberto}
        acao={confirmacao.dados}
        aoFechar={confirmacao.fechar}
        aoConcluir={setAviso}
      />
    </div>
  )
}

function NovoLocal({ aoConcluir }: { aoConcluir: (aviso: string | null) => void }) {
  const criar = useCriarLocal()
  const form = useForm<LocalForm>({
    resolver: zodResolver(localSchema),
    defaultValues: { nome: '', descricao: '' },
  })
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h3>Novo local</h3>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form
          className="grid gap-4 sm:grid-cols-2"
          noValidate
          onSubmit={form.handleSubmit((v) => {
            aoConcluir(null)
            criar.mutate(
              { nome: v.nome, descricao: v.descricao || null },
              {
                onSuccess: () => {
                  form.reset()
                  aoConcluir(`Local ${v.nome} criado.`)
                },
              },
            )
          })}
        >
          <Campo
            rotulo="Nome"
            erro={form.formState.errors.nome?.message}
            {...form.register('nome')}
          />
          <Campo rotulo="Descrição (opcional)" {...form.register('descricao')} />
          <div className="grid gap-3 sm:col-span-2">
            <MensagemErro erro={criar.isError ? erroRpc(criar.error) : null} />
            <Button type="submit" className="justify-self-start" disabled={criar.isPending}>
              {criar.isPending ? 'Salvando…' : 'Criar local'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}

function EditarLocal({
  local,
  aoFechar,
  aoConcluir,
}: {
  local: Local
  aoFechar: () => void
  aoConcluir: (aviso: string) => void
}) {
  const atualizar = useAtualizarLocal()
  const form = useForm<LocalForm>({
    resolver: zodResolver(localSchema),
    defaultValues: { nome: local.nome, descricao: local.descricao ?? '' },
  })
  return (
    <form
      className="grid gap-4"
      noValidate
      onSubmit={form.handleSubmit((v) =>
        atualizar.mutate(
          { id: local.id, dados: { nome: v.nome, descricao: v.descricao || null } },
          {
            onSuccess: () => {
              aoConcluir(`Local ${v.nome} atualizado.`)
              aoFechar()
            },
          },
        ),
      )}
    >
      <Campo rotulo="Nome" erro={form.formState.errors.nome?.message} {...form.register('nome')} />
      <Campo rotulo="Descrição (opcional)" {...form.register('descricao')} />
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
