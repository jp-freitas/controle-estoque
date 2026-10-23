// spec-001/RF-04, RF-08: guardas de rota por sessão, status e perfil.
// Conveniência de navegação: a proteção real dos dados é a RLS (P-02).
import { Navigate, Outlet, useLocation } from 'react-router'
import { useSessao } from '../hooks/sessaoContext'

function Carregando() {
  return (
    <p role="status" className="text-muted-foreground p-6 text-sm">
      Carregando…
    </p>
  )
}

/** Exige usuário autenticado; senão vai para o login. */
export function RequerSessao() {
  const { sessao, carregando } = useSessao()
  const local = useLocation()
  if (carregando) return <Carregando />
  if (!sessao) return <Navigate to="/entrar" replace state={{ de: local.pathname }} />
  return <Outlet />
}

/** Exige profiles ativo; pendente, inativo e convite não aceito vão para a tela própria. */
export function RequerAtivo() {
  const { perfil, carregando, erroPerfil } = useSessao()
  if (carregando) return <Carregando />
  if (erroPerfil) {
    return (
      <p role="alert" className="text-destructive p-6 text-sm">
        Não foi possível carregar seu perfil. Recarregue a página.
      </p>
    )
  }
  if (!perfil) return <Navigate to="/primeiro-acesso" replace />
  if (perfil.status === 'pendente') return <Navigate to="/aguardando" replace />
  if (perfil.status === 'inativo') return <Navigate to="/desativado" replace />
  return <Outlet />
}

/** Exige perfil admin (o status ativo já foi exigido por RequerAtivo). */
export function RequerAdmin() {
  const { perfil } = useSessao()
  if (perfil?.perfil !== 'admin') return <Navigate to="/" replace />
  return <Outlet />
}
