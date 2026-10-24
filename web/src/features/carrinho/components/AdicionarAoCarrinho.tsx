import { podeSolicitar, type ItemCatalogo } from '@/features/catalogo'
import { Button } from '@/shared/ui/button'
import { useCarrinho } from '../hooks/carrinhoContext'

/** Botão do catálogo (spec-003/RF-04, spec-002/CA-05): some para inoperante ou sem disponível. */
export function AdicionarAoCarrinho({ item }: { item: ItemCatalogo }) {
  const { linhas, executar } = useCarrinho()
  if (!podeSolicitar(item)) return null
  const noCarrinho = linhas.find((l) => l.itemId === item.id)?.quantidade ?? 0
  const esgotou = noCarrinho >= item.disponivel
  return (
    <div className="flex items-center justify-end gap-2">
      {noCarrinho > 0 && (
        <span className="text-muted-foreground text-sm whitespace-nowrap">
          {noCarrinho} no carrinho
        </span>
      )}
      <Button
        size="sm"
        variant="outline"
        disabled={esgotou}
        aria-label={`Adicionar ${item.nome} ao carrinho`}
        onClick={() => executar({ tipo: 'adicionar', itemId: item.id, nome: item.nome })}
      >
        Adicionar
      </Button>
    </div>
  )
}
