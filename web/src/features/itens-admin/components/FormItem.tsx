import { zodResolver } from '@hookform/resolvers/zod'
import { useForm, useWatch } from 'react-hook-form'
import { ROTULO_ESTADO, type ItemCatalogo } from '@/features/catalogo'
import { erroRpc } from '@/shared/lib/erroRpc'
import { Button } from '@/shared/ui/button'
import { Campo } from '@/shared/ui/campo'
import { CampoSelecao } from '@/shared/ui/campo-selecao'
import { DialogFooter } from '@/shared/ui/dialog'
import { MensagemErro } from '@/shared/ui/mensagem-erro'
import type { DadosItem, EstadoItem } from '../api/itensAdminApi'
import { useAtualizarItem, useCriarItem, useLocais, useTipos } from '../hooks/useItensAdmin'
import { itemSchema, type ItemForm } from '../schemas/itensAdminSchemas'

const ESTADOS = Object.entries(ROTULO_ESTADO).map(([valor, rotulo]) => ({ valor, rotulo }))

function valoresIniciais(item: ItemCatalogo | null): ItemForm {
  return {
    nome: item?.nome ?? '',
    tipoId: item?.tipo_id ?? '',
    localId: item?.local_id ?? '',
    quantidade: item ? String(item.quantidade_total) : '',
    estado: item?.estado ?? '',
    patrimonio: item?.numero_patrimonio ?? '',
    descricao: item?.descricao ?? '',
    estoqueMinimo: item?.estoque_minimo == null ? '' : String(item.estoque_minimo),
  }
}

/**
 * spec-002/RF-05, RF-07, T-18: cadastro (item = null) e edição de item.
 * Contadores e operante não aparecem aqui (RF-06, RF-14); quantidade só no cadastro.
 */
export function FormItem({
  item,
  aoConcluir,
  aoFechar,
}: {
  item: ItemCatalogo | null
  aoConcluir: (aviso: string) => void
  aoFechar: () => void
}) {
  const novo = item === null
  const tipos = useTipos()
  const locais = useLocais()
  const criar = useCriarItem()
  const atualizar = useAtualizarItem()
  const mutacao = novo ? criar : atualizar
  const form = useForm<ItemForm>({
    resolver: zodResolver(itemSchema(novo)),
    defaultValues: valoresIniciais(item),
  })

  // RN-03: só tipos/locais ativos são oferecidos (mais o atual, na edição)
  const opcoes = <T extends { id: string; nome: string; ativo: boolean }>(
    lista: T[] | undefined,
    atual: string | undefined,
  ) => [
    { valor: '', rotulo: 'Escolha…' },
    ...(lista ?? [])
      .filter((x) => x.ativo || x.id === atual)
      .map((x) => ({ valor: x.id, rotulo: x.nome })),
  ]
  const tipoId = useWatch({ control: form.control, name: 'tipoId' })
  const tipoEscolhido = tipos.data?.find((t) => t.id === tipoId)
  // spec-007/RF-08: estoque mínimo só para tipo consumível
  const consumivel = tipoEscolhido?.consumivel ?? false

  const enviar = form.handleSubmit((v) => {
    const dados: DadosItem = {
      nome: v.nome,
      tipo_id: v.tipoId,
      local_id: v.localId,
      estado: v.estado === '' ? null : (v.estado as EstadoItem),
      numero_patrimonio: v.patrimonio || null,
      descricao: v.descricao || null,
      estoque_minimo: consumivel && v.estoqueMinimo !== '' ? Number(v.estoqueMinimo) : null,
    }
    const sucesso = {
      onSuccess: () => {
        aoConcluir(novo ? `Item ${v.nome} cadastrado.` : `Item ${v.nome} atualizado.`)
        aoFechar()
      },
    }
    if (novo) criar.mutate({ ...dados, quantidade_total: Number(v.quantidade) }, sucesso)
    else atualizar.mutate({ id: item.id, dados }, sucesso)
  })

  const erros = form.formState.errors
  return (
    <form className="grid gap-4 sm:grid-cols-2" noValidate onSubmit={enviar}>
      <div className="sm:col-span-2">
        <Campo rotulo="Nome" erro={erros.nome?.message} {...form.register('nome')} />
      </div>
      <div>
        <CampoSelecao
          rotulo="Tipo"
          opcoes={opcoes(tipos.data, item?.tipo_id)}
          {...form.register('tipoId')}
        />
        {erros.tipoId && <p className="text-destructive text-sm">{erros.tipoId.message}</p>}
      </div>
      <div>
        <CampoSelecao
          rotulo="Local"
          opcoes={opcoes(locais.data, item?.local_id)}
          {...form.register('localId')}
        />
        {erros.localId && <p className="text-destructive text-sm">{erros.localId.message}</p>}
      </div>
      {novo && (
        <Campo
          rotulo="Quantidade"
          inputMode="numeric"
          erro={erros.quantidade?.message}
          {...form.register('quantidade')}
        />
      )}
      <CampoSelecao
        rotulo="Estado"
        opcoes={[{ valor: '', rotulo: 'Não informado' }, ...ESTADOS]}
        {...form.register('estado')}
      />
      <Campo
        rotulo="Número de patrimônio (opcional)"
        erro={erros.patrimonio?.message}
        {...form.register('patrimonio')}
      />
      {consumivel && (
        <Campo
          rotulo="Estoque mínimo (opcional)"
          inputMode="numeric"
          erro={erros.estoqueMinimo?.message}
          {...form.register('estoqueMinimo')}
        />
      )}
      <div className="sm:col-span-2">
        <Campo rotulo="Descrição (opcional)" {...form.register('descricao')} />
      </div>
      <div className="grid gap-3 sm:col-span-2">
        <MensagemErro erro={mutacao.isError ? erroRpc(mutacao.error) : null} />
        <DialogFooter>
          <Button type="button" variant="outline" onClick={aoFechar}>
            Voltar
          </Button>
          <Button type="submit" disabled={mutacao.isPending}>
            {mutacao.isPending ? 'Salvando…' : novo ? 'Cadastrar' : 'Salvar'}
          </Button>
        </DialogFooter>
      </div>
    </form>
  )
}
