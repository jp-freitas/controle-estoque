import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useSessao } from '@/features/auth'
import { useCatalogo } from '@/features/catalogo'
import {
  aplicar,
  lerCarrinho,
  revalidar,
  salvarCarrinho,
  type AcaoCarrinho,
  type LinhaCarrinho,
  type LinhaSalva,
} from './carrinho'
import { CarrinhoContext, type CarrinhoValor } from './carrinhoContext'

/** spec-003/RF-02: carrinho só no front, um por usuário logado e ativo. */
export function CarrinhoProvider({ children }: { children: ReactNode }) {
  const { perfil } = useSessao()
  const usuarioId = perfil?.status === 'ativo' ? perfil.id : null
  // trocar de usuário recomeça o estado a partir do que ele salvou
  return (
    <CarrinhoDoUsuario key={usuarioId ?? 'ninguem'} usuarioId={usuarioId}>
      {children}
    </CarrinhoDoUsuario>
  )
}

function CarrinhoDoUsuario({
  usuarioId,
  children,
}: {
  usuarioId: string | null
  children: ReactNode
}) {
  const [salvas, setSalvas] = useState(() => (usuarioId ? lerCarrinho(usuarioId) : []))
  const catalogo = useCatalogo({ enabled: usuarioId !== null })

  // CA-09: sempre conferido contra o catálogo atual
  const conferido = useMemo(
    () => (catalogo.data ? revalidar(salvas, catalogo.data) : null),
    [salvas, catalogo.data],
  )

  // salva já conferido, para o aviso de remoção não voltar a cada recarga
  const paraSalvar = useMemo(
    () => (conferido ? conferido.linhas.map(soSalva) : salvas),
    [conferido, salvas],
  )
  useEffect(() => {
    if (usuarioId) salvarCarrinho(usuarioId, paraSalvar)
  }, [usuarioId, paraSalvar])

  const valor = useMemo<CarrinhoValor>(
    () => ({
      linhas: conferido?.linhas ?? salvas.map(semConferir),
      avisos: conferido?.avisos ?? [],
      conferindo: conferido === null,
      // a ação parte das linhas conferidas, para não ressuscitar o que a conferência tirou
      executar: (acao: AcaoCarrinho) => setSalvas(aplicar(paraSalvar, acao)),
    }),
    [conferido, salvas, paraSalvar],
  )

  return <CarrinhoContext value={valor}>{children}</CarrinhoContext>
}

const soSalva = ({ itemId, nome, quantidade }: LinhaCarrinho): LinhaSalva => ({
  itemId,
  nome,
  quantidade,
})

// antes de o catálogo chegar, não há como saber o disponível
const semConferir = (l: LinhaSalva): LinhaCarrinho => ({
  ...l,
  disponivel: l.quantidade,
  inoperante: false,
})
