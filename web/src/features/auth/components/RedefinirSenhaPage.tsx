import { Link } from 'react-router'
import { mensagemErroAuth } from '../api/erroAuth'
import { useDefinirSenha } from '../hooks/useAuth'
import { useSessao } from '../hooks/sessaoContext'
import { FormNovaSenha } from './FormNovaSenha'
import { TelaAuth } from './TelaAuth'

/**
 * spec-001/RF-01: destino do link de recuperação. O supabase-js lê o token do
 * endereço (fluxo implicit) e abre a sessão; aqui só se define a nova senha.
 */
export function RedefinirSenhaPage() {
  const { sessao, carregando } = useSessao()
  const definir = useDefinirSenha()

  if (carregando) return null

  if (!sessao) {
    return (
      <TelaAuth
        titulo="Link inválido ou expirado"
        descricao="Peça um novo link de recuperação. Ele vale por 1 hora."
      >
        <Link to="/recuperar-senha" className="text-sm underline">
          Pedir novo link
        </Link>
      </TelaAuth>
    )
  }

  if (definir.isSuccess) {
    return (
      <TelaAuth titulo="Senha alterada" descricao="Sua nova senha já está valendo.">
        <Link to="/" className="text-sm underline">
          Continuar
        </Link>
      </TelaAuth>
    )
  }

  return (
    <TelaAuth titulo="Criar nova senha">
      <FormNovaSenha
        aoEnviar={(senha) => definir.mutate(senha)}
        enviando={definir.isPending}
        erro={definir.isError ? mensagemErroAuth(definir.error) : null}
        rotuloBotao="Salvar senha"
      />
    </TelaAuth>
  )
}
