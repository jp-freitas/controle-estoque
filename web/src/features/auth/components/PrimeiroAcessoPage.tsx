import { Navigate } from 'react-router'
import { erroRpc } from '@/shared/lib/erroRpc'
import { mensagemErroAuth } from '../api/erroAuth'
import { usePrimeiroAcesso } from '../hooks/useAuth'
import { useSessao } from '../hooks/sessaoContext'
import { FormNovaSenha } from './FormNovaSenha'
import { TelaAuth } from './TelaAuth'

// Erro da RPC aceitar_convite (P0001: expirado, cancelado…) ou do Auth (senha).
function mensagem(erro: unknown): string {
  return (erro as { code?: string } | null)?.code === 'P0001'
    ? erroRpc(erro).mensagem
    : mensagemErroAuth(erro)
}

/**
 * spec-001/RF-11: destino do link do convite. O convidado já está autenticado
 * pelo link; define a senha e aceita o convite (profiles pendente).
 */
export function PrimeiroAcessoPage() {
  const { sessao, perfil, carregando } = useSessao()
  const primeiroAcesso = usePrimeiroAcesso()

  if (carregando) return null

  if (!sessao) {
    return (
      <TelaAuth
        titulo="Link inválido ou expirado"
        descricao="Abra o link do convite enviado para o seu e-mail. Se ele venceu (1 hora), peça à administração para reenviar."
      />
    )
  }

  // Convite já aceito: as guardas mandam para "aguardando liberação" ou para o início.
  if (perfil) return <Navigate to="/" replace />

  return (
    <TelaAuth
      titulo="Bem-vindo! Crie sua senha"
      descricao={`Você foi convidado com o e-mail ${sessao.user.email ?? ''}. Depois de criar a senha, um administrador vai liberar seu acesso.`}
    >
      <FormNovaSenha
        aoEnviar={(senha) => primeiroAcesso.mutate(senha)}
        enviando={primeiroAcesso.isPending}
        erro={primeiroAcesso.isError ? mensagem(primeiroAcesso.error) : null}
        rotuloBotao="Criar senha e aceitar convite"
      />
    </TelaAuth>
  )
}
