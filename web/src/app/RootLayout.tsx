import { NavLink, Outlet } from 'react-router'
import { useSessao } from '@/features/auth'
import { CarrinhoProvider, useCarrinho } from '@/features/carrinho'
import { Button } from '@/shared/ui/button'

const linkClasse = ({ isActive }: { isActive: boolean }) =>
  isActive ? 'font-medium underline' : 'text-muted-foreground hover:underline'

export function RootLayout() {
  return (
    <CarrinhoProvider>
      <Layout />
    </CarrinhoProvider>
  )
}

function LinkCarrinho() {
  const { linhas } = useCarrinho()
  return (
    <NavLink to="/carrinho" className={linkClasse}>
      Carrinho{linhas.length > 0 && ` (${linhas.length})`}
    </NavLink>
  )
}

function Layout() {
  const { perfil, sair } = useSessao()
  const ativo = perfil?.status === 'ativo'

  return (
    <div className="bg-background text-foreground min-h-svh">
      <header className="flex flex-wrap items-center gap-x-6 gap-y-2 border-b px-6 py-4">
        <h1 className="text-lg font-semibold">Controle de Inventário</h1>
        {ativo && (
          <nav aria-label="Principal" className="flex flex-wrap gap-4 text-sm">
            <NavLink to="/" end className={linkClasse}>
              Catálogo
            </NavLink>
            <LinkCarrinho />
            <NavLink to="/minhas-solicitacoes" className={linkClasse}>
              Minhas solicitações
            </NavLink>
            {perfil.perfil === 'admin' && (
              <>
                <NavLink to="/admin/itens" className={linkClasse}>
                  Itens
                </NavLink>
                <NavLink to="/admin/tipos" className={linkClasse}>
                  Tipos
                </NavLink>
                <NavLink to="/admin/locais" className={linkClasse}>
                  Locais
                </NavLink>
                <NavLink to="/admin/usuarios" className={linkClasse}>
                  Usuários
                </NavLink>
                <NavLink to="/admin/convites" className={linkClasse}>
                  Convites
                </NavLink>
              </>
            )}
            <NavLink to="/meu-perfil" className={linkClasse}>
              Meu perfil
            </NavLink>
          </nav>
        )}
        {perfil && (
          <div className="ml-auto flex items-center gap-3 text-sm">
            <span className="text-muted-foreground">{perfil.nome}</span>
            <Button variant="outline" size="sm" onClick={() => void sair()}>
              Sair
            </Button>
          </div>
        )}
      </header>
      <main className="p-6">
        <Outlet />
      </main>
    </div>
  )
}
