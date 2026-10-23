import { Navigate } from 'react-router'
import { Button } from '@/shared/ui/button'
import { useSessao } from '../hooks/sessaoContext'
import { TelaAuth } from './TelaAuth'

/** spec-001/RF-04, CA-02: usuário pendente não acessa nada até a aprovação. */
export function AguardandoLiberacaoPage() {
  const { perfil, carregando, recarregarPerfil, sair } = useSessao()
  if (carregando) return null
  if (perfil?.status !== 'pendente') return <Navigate to="/" replace />
  return (
    <TelaAuth
      titulo="Aguardando liberação"
      descricao="Seu cadastro foi recebido. Um administrador precisa aprovar seu acesso antes que você possa usar o sistema."
    >
      <Button variant="outline" onClick={() => void recarregarPerfil()}>
        Verificar novamente
      </Button>
      <Button variant="ghost" onClick={() => void sair()}>
        Sair
      </Button>
    </TelaAuth>
  )
}

/** spec-001/RF-04, CA-07: usuário inativo autentica mas não acessa nada. */
export function AcessoDesativadoPage() {
  const { perfil, carregando, sair } = useSessao()
  if (carregando) return null
  if (perfil?.status !== 'inativo') return <Navigate to="/" replace />
  return (
    <TelaAuth
      titulo="Acesso desativado"
      descricao="Seu acesso ao sistema foi desativado. Procure a administração da escola."
    >
      <Button variant="ghost" onClick={() => void sair()}>
        Sair
      </Button>
    </TelaAuth>
  )
}
