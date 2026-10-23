import { useState } from 'react'
import { useSessao } from '@/features/auth'
import { erroRpc } from '@/shared/lib/erroRpc'
import { Badge } from '@/shared/ui/badge'
import { Campo } from '@/shared/ui/campo'
import { CampoMarcacao } from '@/shared/ui/campo-marcacao'
import { CampoSelecao } from '@/shared/ui/campo-selecao'
import { MensagemErro } from '@/shared/ui/mensagem-erro'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/ui/table'
import type { ItemCatalogo } from '../api/catalogoApi'
import { useCatalogo } from '../hooks/useCatalogo'
import { FILTROS_INICIAIS, filtrarCatalogo, opcoesDe, type FiltrosCatalogo } from './filtros'
import { ROTULO_ESTADO } from './rotulos'

const TODOS = { valor: '', rotulo: 'Todos' }

/** spec-002/RF-10, RF-11, CA-05, CA-10: catálogo com busca e filtros. */
export function CatalogoPage() {
  const { perfil } = useSessao()
  const ehAdmin = perfil?.perfil === 'admin'
  const catalogo = useCatalogo()
  const [filtros, setFiltros] = useState<FiltrosCatalogo>(FILTROS_INICIAIS)
  const mudar = (parcial: Partial<FiltrosCatalogo>) => setFiltros((f) => ({ ...f, ...parcial }))

  const itens = catalogo.data ?? []
  const lista = filtrarCatalogo(itens, filtros)

  return (
    <div className="grid max-w-6xl gap-6">
      <h2 className="text-xl font-semibold">Catálogo</h2>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Campo
          rotulo="Buscar por nome"
          type="search"
          value={filtros.busca}
          onChange={(e) => mudar({ busca: e.target.value })}
        />
        <CampoSelecao
          rotulo="Tipo"
          value={filtros.tipoId}
          onChange={(e) => mudar({ tipoId: e.target.value })}
          opcoes={[TODOS, ...opcoesDe(itens, 'tipo_id', 'tipo_nome')]}
        />
        <CampoSelecao
          rotulo="Local"
          value={filtros.localId}
          onChange={(e) => mudar({ localId: e.target.value })}
          opcoes={[TODOS, ...opcoesDe(itens, 'local_id', 'local_nome')]}
        />
        <CampoSelecao
          rotulo="Situação"
          value={filtros.operante}
          onChange={(e) => mudar({ operante: e.target.value as FiltrosCatalogo['operante'] })}
          opcoes={[
            TODOS,
            { valor: 'sim', rotulo: 'Operantes' },
            { valor: 'nao', rotulo: 'Inoperantes' },
          ]}
        />
        <CampoSelecao
          rotulo="Disponibilidade"
          value={filtros.disponibilidade}
          onChange={(e) =>
            mudar({ disponibilidade: e.target.value as FiltrosCatalogo['disponibilidade'] })
          }
          opcoes={[
            TODOS,
            { valor: 'com', rotulo: 'Com disponível' },
            { valor: 'sem', rotulo: 'Sem disponível' },
          ]}
        />
        {ehAdmin && (
          <CampoMarcacao
            rotulo="Incluir desativados"
            checked={filtros.incluirDesativados}
            onChange={(e) => mudar({ incluirDesativados: e.target.checked })}
          />
        )}
      </div>

      {catalogo.isPending ? (
        <p role="status">Carregando catálogo…</p>
      ) : catalogo.isError ? (
        <MensagemErro erro={erroRpc(catalogo.error)} />
      ) : lista.length === 0 ? (
        <p className="text-muted-foreground">Nenhum item encontrado.</p>
      ) : (
        <TabelaCatalogo itens={lista} />
      )}
    </div>
  )
}

function TabelaCatalogo({ itens }: { itens: ItemCatalogo[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Item</TableHead>
          <TableHead>Tipo</TableHead>
          <TableHead>Local</TableHead>
          <TableHead>Estado</TableHead>
          <TableHead className="text-right">Disponível</TableHead>
          <TableHead>Situação</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {itens.map((i) => (
          <TableRow key={i.id}>
            <TableCell>
              <span className="font-medium">{i.nome}</span>
              {i.numero_patrimonio && (
                <span className="text-muted-foreground"> · Patrimônio {i.numero_patrimonio}</span>
              )}
              {i.descricao && <p className="text-muted-foreground text-sm">{i.descricao}</p>}
            </TableCell>
            <TableCell>{i.tipo_nome}</TableCell>
            <TableCell>{i.local_nome}</TableCell>
            <TableCell>{i.estado ? ROTULO_ESTADO[i.estado] : '—'}</TableCell>
            {/* RF-11: disponível = total − reservada − em uso */}
            <TableCell className="text-right tabular-nums">
              {i.disponivel} de {i.quantidade_total}
            </TableCell>
            <TableCell className="space-x-1">
              {/* CA-05: inoperante continua visível, sinalizado */}
              {!i.operante && <Badge variant="destructive">Inoperante</Badge>}
              {!i.ativo && <Badge variant="secondary">Desativado</Badge>}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
