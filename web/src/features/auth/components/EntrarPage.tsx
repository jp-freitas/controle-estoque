import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { Link, Navigate } from 'react-router'
import { Button } from '@/shared/ui/button'
import { Campo } from '@/shared/ui/campo'
import { MensagemErro } from '@/shared/ui/mensagem-erro'
import { mensagemErroAuth } from '../api/erroAuth'
import { useEntrar } from '../hooks/useAuth'
import { useSessao } from '../hooks/sessaoContext'
import { entrarSchema, type EntrarForm } from '../schemas/authSchemas'
import { TelaAuth } from './TelaAuth'

/** spec-001/RF-01: login por e-mail e senha. Não há cadastro (RF-03). */
export function EntrarPage() {
  const { sessao } = useSessao()
  const entrar = useEntrar()
  const form = useForm<EntrarForm>({ resolver: zodResolver(entrarSchema) })

  // Logado: as guardas de rota decidem para onde ir conforme o status.
  if (sessao) return <Navigate to="/" replace />

  return (
    <TelaAuth titulo="Entrar" descricao="Acesso só por convite da administração da escola.">
      <form className="grid gap-4" noValidate onSubmit={form.handleSubmit((v) => entrar.mutate(v))}>
        <Campo
          rotulo="E-mail"
          type="email"
          autoComplete="email"
          erro={form.formState.errors.email?.message}
          {...form.register('email')}
        />
        <Campo
          rotulo="Senha"
          type="password"
          autoComplete="current-password"
          erro={form.formState.errors.senha?.message}
          {...form.register('senha')}
        />
        <MensagemErro erro={entrar.isError ? mensagemErroAuth(entrar.error) : null} />
        <Button type="submit" disabled={entrar.isPending}>
          {entrar.isPending ? 'Entrando…' : 'Entrar'}
        </Button>
      </form>
      <Link to="/recuperar-senha" className="text-muted-foreground text-sm underline">
        Esqueci minha senha
      </Link>
    </TelaAuth>
  )
}
