import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useDialogo } from '@/shared/hooks/useDialogo'
import { erroRpc } from '@/shared/lib/erroRpc'
import { Alert, AlertDescription } from '@/shared/ui/alert'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { Campo } from '@/shared/ui/campo'
import { CampoMarcacao } from '@/shared/ui/campo-marcacao'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/shared/ui/dialog'
import { MensagemErro } from '@/shared/ui/mensagem-erro'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/ui/table'
import type { Tipo } from '../api/itensAdminApi'
import { useAtualizarTipo, useCriarTipo, useExcluirTipo, useTipos } from '../hooks/useItensAdmin'
import { tipoSchema, type TipoForm } from '../schemas/itensAdminSchemas'
import { ConfirmarAsync, type AcaoConfirmavel } from './ConfirmarAsync'

/** spec-002/RF-01 a RF-03, CA-13, CA-14: tipos de item. */
export function TiposPage() {
  const tipos = useTipos()
  const [aviso, setAviso] = useState<string | null>(null)
  const edicao = useDialogo<Tipo>()
  const confirmacao = useDialogo<AcaoConfirmavel>()
  const atualizar = useAtualizarTipo()
  const excluir = useExcluirTipo()

  const alternarAtivo = (t: Tipo): AcaoConfirmavel =>
    t.ativo
      ? {
          titulo: 'Desativar tipo',
          descricao: `Não será possível cadastrar itens do tipo ${t.nome}. Só é possível desativar quando nenhum item ativo usa o tipo.`,
          rotulo: 'Desativar',
          destrutivo: true,
          executar: async () => {
            await atualizar.mutateAsync({ id: t.id, dados: { ativo: false } })
            return `Tipo ${t.nome} desativado.`
          },
        }
      : {
          titulo: 'Reativar tipo',
          descricao: `${t.nome} volta a poder ser usado em itens.`,
          rotulo: 'Reativar',
          executar: async () => {
            await atualizar.mutateAsync({ id: t.id, dados: { ativo: true } })
            return `Tipo ${t.nome} reativado.`
          },
        }

  const acaoExcluir = (t: Tipo): AcaoConfirmavel => ({
    titulo: 'Excluir tipo',
    descricao: `O tipo ${t.nome} será excluído.`,
    rotulo: 'Excluir',
    destrutivo: true,
    executar: async () => {
      await excluir.mutateAsync(t.id)
      return `Tipo ${t.nome} excluído.`
    },
    // RF-03: tipo em uso não é excluído, só desativado
    alternativa: t.ativo ? { ...alternarAtivo(t), titulo: 'Tipo em uso' } : undefined,
  })

  const abrir = (a: AcaoConfirmavel) => {
    setAviso(null)
    confirmacao.abrir(a)
  }

  return (
    <div className="grid max-w-4xl gap-6">
      <h2 className="text-xl font-semibold">Tipos de item</h2>
      <NovoTipo aoConcluir={setAviso} />
      {aviso && (
        <Alert role="status">
          <AlertDescription>{aviso}</AlertDescription>
        </Alert>
      )}

      {tipos.isPending ? (
        <p role="status">Carregando tipos…</p>
      ) : tipos.isError ? (
        <MensagemErro erro={erroRpc(tipos.error)} />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Consumível</TableHead>
              <TableHead>Situação</TableHead>
              <TableHead>
                <span className="sr-only">Ações</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tipos.data.map((t) => (
              <TableRow key={t.id}>
                <TableCell>{t.nome}</TableCell>
                <TableCell>{t.consumivel ? 'Sim' : 'Não'}</TableCell>
                <TableCell>
                  <Badge variant={t.ativo ? 'default' : 'secondary'}>
                    {t.ativo ? 'Ativo' : 'Desativado'}
                  </Badge>
                </TableCell>
                <TableCell className="space-x-2 text-right whitespace-nowrap">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setAviso(null)
                      edicao.abrir(t)
                    }}
                  >
                    Editar
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => abrir(alternarAtivo(t))}>
                    {t.ativo ? 'Desativar' : 'Reativar'}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => abrir(acaoExcluir(t))}>
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
            <DialogTitle>Editar tipo</DialogTitle>
          </DialogHeader>
          {edicao.dados && (
            <EditarTipo
              key={edicao.dados.id}
              tipo={edicao.dados}
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

function NovoTipo({ aoConcluir }: { aoConcluir: (aviso: string | null) => void }) {
  const criar = useCriarTipo()
  const form = useForm<TipoForm>({
    resolver: zodResolver(tipoSchema),
    defaultValues: { nome: '', consumivel: false },
  })
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h3>Novo tipo</h3>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form
          className="grid gap-4 sm:grid-cols-2"
          noValidate
          onSubmit={form.handleSubmit((v) => {
            aoConcluir(null)
            criar.mutate(v, {
              onSuccess: () => {
                form.reset()
                aoConcluir(`Tipo ${v.nome} criado.`)
              },
            })
          })}
        >
          <Campo
            rotulo="Nome"
            erro={form.formState.errors.nome?.message}
            {...form.register('nome')}
          />
          <div className="self-end pb-2">
            {/* RF-02: consumível baixa o total na retirada; não consumível exige devolução */}
            <CampoMarcacao
              rotulo="Consumível (não volta ao estoque)"
              {...form.register('consumivel')}
            />
          </div>
          <div className="grid gap-3 sm:col-span-2">
            <MensagemErro erro={criar.isError ? erroRpc(criar.error) : null} />
            <Button type="submit" className="justify-self-start" disabled={criar.isPending}>
              {criar.isPending ? 'Salvando…' : 'Criar tipo'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}

function EditarTipo({
  tipo,
  aoFechar,
  aoConcluir,
}: {
  tipo: Tipo
  aoFechar: () => void
  aoConcluir: (aviso: string) => void
}) {
  const atualizar = useAtualizarTipo()
  const form = useForm<TipoForm>({
    resolver: zodResolver(tipoSchema),
    defaultValues: { nome: tipo.nome, consumivel: tipo.consumivel },
  })
  return (
    <form
      className="grid gap-4"
      noValidate
      onSubmit={form.handleSubmit((v) =>
        atualizar.mutate(
          { id: tipo.id, dados: v },
          {
            onSuccess: () => {
              aoConcluir(`Tipo ${v.nome} atualizado.`)
              aoFechar()
            },
          },
        ),
      )}
    >
      <Campo rotulo="Nome" erro={form.formState.errors.nome?.message} {...form.register('nome')} />
      {/* CA-14: o banco recusa mudar se o tipo já tem itens */}
      <CampoMarcacao rotulo="Consumível (não volta ao estoque)" {...form.register('consumivel')} />
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
