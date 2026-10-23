import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useCatalogo, type ItemCatalogo } from '@/features/catalogo'
import { useDialogo } from '@/shared/hooks/useDialogo'
import { erroRpc } from '@/shared/lib/erroRpc'
import { normalizar } from '@/shared/lib/texto'
import { Alert, AlertDescription } from '@/shared/ui/alert'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { Campo } from '@/shared/ui/campo'
import { CampoMarcacao } from '@/shared/ui/campo-marcacao'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/ui/dialog'
import { MensagemErro } from '@/shared/ui/mensagem-erro'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/ui/table'
import {
  useAjustarQuantidade,
  useAlterarOperancia,
  useAtualizarItem,
  useExcluirItem,
} from '../hooks/useItensAdmin'
import { ajusteSchema, type AjusteForm } from '../schemas/itensAdminSchemas'
import { ConfirmarAsync, type AcaoConfirmavel } from './ConfirmarAsync'
import { FormItem } from './FormItem'

type Dialogo =
  | { tipo: 'form'; item: ItemCatalogo | null }
  | { tipo: 'ajuste'; item: ItemCatalogo }
  | { tipo: 'operancia'; item: ItemCatalogo }

/** spec-002/RF-05 a RF-09, RF-14, CA-08: gestão de itens pelo admin. */
export function ItensPage() {
  const catalogo = useCatalogo()
  const [busca, setBusca] = useState('')
  const [mostrarDesativados, setMostrarDesativados] = useState(false)
  const [aviso, setAviso] = useState<string | null>(null)
  const dialogo = useDialogo<Dialogo>()
  const confirmacao = useDialogo<AcaoConfirmavel>()
  const atualizar = useAtualizarItem()
  const excluir = useExcluirItem()

  const lista = (catalogo.data ?? []).filter(
    (i) => (mostrarDesativados || i.ativo) && normalizar(i.nome).includes(normalizar(busca)),
  )
  const abrir = (d: Dialogo) => {
    setAviso(null)
    dialogo.abrir(d)
  }
  const confirmar = (a: AcaoConfirmavel) => {
    setAviso(null)
    confirmacao.abrir(a)
  }

  const alternarAtivo = (i: ItemCatalogo): AcaoConfirmavel =>
    i.ativo
      ? {
          titulo: 'Desativar item',
          descricao: `${i.nome} sai do catálogo dos professores. O histórico é mantido.`,
          rotulo: 'Desativar',
          destrutivo: true,
          executar: async () => {
            await atualizar.mutateAsync({ id: i.id, dados: { ativo: false } })
            return `${i.nome} desativado.`
          },
        }
      : {
          titulo: 'Reativar item',
          descricao: `${i.nome} volta ao catálogo. O tipo e o local precisam estar ativos.`,
          rotulo: 'Reativar',
          executar: async () => {
            await atualizar.mutateAsync({ id: i.id, dados: { ativo: true } })
            return `${i.nome} reativado.`
          },
        }

  const acaoExcluir = (i: ItemCatalogo): AcaoConfirmavel => ({
    titulo: 'Excluir item',
    descricao: `${i.nome} será excluído. Só é possível excluir item sem histórico de movimentação.`,
    rotulo: 'Excluir',
    destrutivo: true,
    executar: async () => {
      await excluir.mutateAsync(i.id)
      return `${i.nome} excluído.`
    },
    // CA-08: com histórico, oferece desativar
    alternativa: i.ativo ? { ...alternarAtivo(i), titulo: 'Item com histórico' } : undefined,
  })

  return (
    <div className="grid max-w-6xl gap-6">
      <div className="flex flex-wrap items-center gap-4">
        <h2 className="text-xl font-semibold">Itens</h2>
        <Button className="ml-auto" onClick={() => abrir({ tipo: 'form', item: null })}>
          Novo item
        </Button>
      </div>

      <div className="flex flex-wrap items-end gap-4">
        <div className="w-72">
          <Campo
            rotulo="Buscar por nome"
            type="search"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
        </div>
        <div className="pb-2">
          <CampoMarcacao
            rotulo="Mostrar desativados"
            checked={mostrarDesativados}
            onChange={(e) => setMostrarDesativados(e.target.checked)}
          />
        </div>
      </div>

      {aviso && (
        <Alert role="status">
          <AlertDescription>{aviso}</AlertDescription>
        </Alert>
      )}

      {catalogo.isPending ? (
        <p role="status">Carregando itens…</p>
      ) : catalogo.isError ? (
        <MensagemErro erro={erroRpc(catalogo.error)} />
      ) : lista.length === 0 ? (
        <p className="text-muted-foreground">Nenhum item encontrado.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Item</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Local</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead className="text-right">Reservado</TableHead>
              <TableHead className="text-right">Em uso</TableHead>
              <TableHead className="text-right">Disponível</TableHead>
              <TableHead>Situação</TableHead>
              <TableHead>
                <span className="sr-only">Ações</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {lista.map((i) => (
              <TableRow key={i.id}>
                <TableCell>
                  <span className="font-medium">{i.nome}</span>
                  {i.numero_patrimonio && (
                    <span className="text-muted-foreground"> · {i.numero_patrimonio}</span>
                  )}
                </TableCell>
                <TableCell>{i.tipo_nome}</TableCell>
                <TableCell>{i.local_nome}</TableCell>
                <TableCell className="text-right tabular-nums">{i.quantidade_total}</TableCell>
                <TableCell className="text-right tabular-nums">{i.quantidade_reservada}</TableCell>
                <TableCell className="text-right tabular-nums">{i.quantidade_em_uso}</TableCell>
                <TableCell className="text-right tabular-nums">{i.disponivel}</TableCell>
                <TableCell className="space-x-1">
                  {!i.operante && <Badge variant="destructive">Inoperante</Badge>}
                  {!i.ativo && <Badge variant="secondary">Desativado</Badge>}
                </TableCell>
                <TableCell className="space-x-1 text-right whitespace-nowrap">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => abrir({ tipo: 'form', item: i })}
                  >
                    Editar
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => abrir({ tipo: 'ajuste', item: i })}
                  >
                    Ajustar quantidade
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => abrir({ tipo: 'operancia', item: i })}
                  >
                    {i.operante ? 'Marcar inoperante' : 'Reativar uso'}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => confirmar(alternarAtivo(i))}>
                    {i.ativo ? 'Desativar' : 'Reativar'}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => confirmar(acaoExcluir(i))}>
                    Excluir
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <Dialog open={dialogo.aberto} onOpenChange={(a) => !a && dialogo.fechar()}>
        <DialogContent className="sm:max-w-2xl">
          {dialogo.dados?.tipo === 'form' && (
            <>
              <DialogHeader>
                <DialogTitle>{dialogo.dados.item ? 'Editar item' : 'Novo item'}</DialogTitle>
              </DialogHeader>
              <FormItem
                key={dialogo.dados.item?.id ?? 'novo'}
                item={dialogo.dados.item}
                aoConcluir={setAviso}
                aoFechar={dialogo.fechar}
              />
            </>
          )}
          {dialogo.dados?.tipo === 'ajuste' && (
            <AjustarQuantidade
              key={dialogo.dados.item.id}
              item={dialogo.dados.item}
              aoConcluir={setAviso}
              aoFechar={dialogo.fechar}
            />
          )}
          {dialogo.dados?.tipo === 'operancia' && (
            <AlterarOperancia
              key={dialogo.dados.item.id}
              item={dialogo.dados.item}
              aoConcluir={setAviso}
              aoFechar={dialogo.fechar}
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

/** RF-09 / CA-04: ajuste manual com motivo; o banco grava a movimentação. */
function AjustarQuantidade({
  item,
  aoConcluir,
  aoFechar,
}: {
  item: ItemCatalogo
  aoConcluir: (aviso: string) => void
  aoFechar: () => void
}) {
  const ajustar = useAjustarQuantidade()
  const form = useForm<AjusteForm>({
    resolver: zodResolver(ajusteSchema),
    defaultValues: { novaQuantidade: String(item.quantidade_total), motivo: '' },
  })
  const comprometido = item.quantidade_reservada + item.quantidade_em_uso
  return (
    <form
      className="grid gap-4"
      noValidate
      onSubmit={form.handleSubmit((v) =>
        ajustar.mutate(
          { id: item.id, novaQuantidade: Number(v.novaQuantidade), motivo: v.motivo },
          {
            onSuccess: () => {
              aoConcluir(`Quantidade de ${item.nome} ajustada para ${v.novaQuantidade}.`)
              aoFechar()
            },
          },
        ),
      )}
    >
      <DialogHeader>
        <DialogTitle>Ajustar quantidade</DialogTitle>
        <DialogDescription>
          {item.nome}: total {item.quantidade_total}
          {comprometido > 0 && `, dos quais ${comprometido} reservados ou em uso`}.
        </DialogDescription>
      </DialogHeader>
      <Campo
        rotulo="Nova quantidade total"
        inputMode="numeric"
        erro={form.formState.errors.novaQuantidade?.message}
        {...form.register('novaQuantidade')}
      />
      <Campo
        rotulo="Motivo"
        erro={form.formState.errors.motivo?.message}
        {...form.register('motivo')}
      />
      <MensagemErro erro={ajustar.isError ? erroRpc(ajustar.error) : null} />
      <DialogFooter>
        <Button type="button" variant="outline" onClick={aoFechar}>
          Voltar
        </Button>
        <Button type="submit" disabled={ajustar.isPending}>
          {ajustar.isPending ? 'Salvando…' : 'Ajustar'}
        </Button>
      </DialogFooter>
    </form>
  )
}

/** RF-14 / CA-11: marcar inoperante (motivo opcional) ou reativar (motivo obrigatório). */
function AlterarOperancia({
  item,
  aoConcluir,
  aoFechar,
}: {
  item: ItemCatalogo
  aoConcluir: (aviso: string) => void
  aoFechar: () => void
}) {
  const alterar = useAlterarOperancia()
  const [motivo, setMotivo] = useState('')
  const [erroMotivo, setErroMotivo] = useState<string | undefined>()
  const reativar = !item.operante

  const enviar = () => {
    if (reativar && !motivo.trim()) {
      setErroMotivo('Informe o motivo da reativação.')
      return
    }
    setErroMotivo(undefined)
    alterar.mutate(
      { id: item.id, operante: reativar, motivo: motivo.trim() },
      {
        onSuccess: () => {
          aoConcluir(
            reativar ? `${item.nome} voltou a operar.` : `${item.nome} marcado como inoperante.`,
          )
          aoFechar()
        },
      },
    )
  }

  return (
    <form
      className="grid gap-4"
      noValidate
      onSubmit={(e) => {
        e.preventDefault()
        enviar()
      }}
    >
      <DialogHeader>
        <DialogTitle>{reativar ? 'Reativar uso do item' : 'Marcar como inoperante'}</DialogTitle>
        <DialogDescription>
          {reativar
            ? `${item.nome} volta a poder ser solicitado.`
            : `${item.nome} continua no catálogo, sinalizado, e não pode ser solicitado.`}
        </DialogDescription>
      </DialogHeader>
      <Campo
        rotulo={reativar ? 'Motivo' : 'Motivo (opcional)'}
        value={motivo}
        erro={erroMotivo}
        onChange={(e) => setMotivo(e.target.value)}
      />
      <MensagemErro erro={alterar.isError ? erroRpc(alterar.error) : null} />
      <DialogFooter>
        <Button type="button" variant="outline" onClick={aoFechar}>
          Voltar
        </Button>
        <Button
          type="submit"
          variant={reativar ? 'default' : 'destructive'}
          disabled={alterar.isPending}
        >
          {alterar.isPending ? 'Salvando…' : reativar ? 'Reativar uso' : 'Marcar inoperante'}
        </Button>
      </DialogFooter>
    </form>
  )
}
