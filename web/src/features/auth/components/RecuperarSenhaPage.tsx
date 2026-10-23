import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { Link } from 'react-router'
import { Button } from '@/shared/ui/button'
import { Campo } from '@/shared/ui/campo'
import { MensagemErro } from '@/shared/ui/mensagem-erro'
import { mensagemErroAuth } from '../api/erroAuth'
import { useSolicitarRecuperacao } from '../hooks/useAuth'
import { recuperarSchema, type RecuperarForm } from '../schemas/authSchemas'
import { TelaAuth } from './TelaAuth'

/** spec-001/RF-01: pede o e-mail de recuperação de senha. */
export function RecuperarSenhaPage() {
  const recuperar = useSolicitarRecuperacao()
  const form = useForm<RecuperarForm>({ resolver: zodResolver(recuperarSchema) })

  if (recuperar.isSuccess) {
    // Mesma resposta para e-mail cadastrado ou não: não revela quem tem conta.
    return (
      <TelaAuth
        titulo="Verifique seu e-mail"
        descricao="Se o e-mail estiver cadastrado, você vai receber um link para criar uma nova senha. O link vale por 1 hora."
      >
        <Link to="/entrar" className="text-sm underline">
          Voltar para o login
        </Link>
      </TelaAuth>
    )
  }

  return (
    <TelaAuth
      titulo="Recuperar senha"
      descricao="Informe seu e-mail para receber um link de redefinição."
    >
      <form
        className="grid gap-4"
        noValidate
        onSubmit={form.handleSubmit((v) => recuperar.mutate(v.email))}
      >
        <Campo
          rotulo="E-mail"
          type="email"
          autoComplete="email"
          erro={form.formState.errors.email?.message}
          {...form.register('email')}
        />
        <MensagemErro erro={recuperar.isError ? mensagemErroAuth(recuperar.error) : null} />
        <Button type="submit" disabled={recuperar.isPending}>
          {recuperar.isPending ? 'Enviando…' : 'Enviar link'}
        </Button>
      </form>
      <Link to="/entrar" className="text-muted-foreground text-sm underline">
        Voltar para o login
      </Link>
    </TelaAuth>
  )
}
