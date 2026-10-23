import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { Button } from '@/shared/ui/button'
import { Campo } from '@/shared/ui/campo'
import { MensagemErro } from '@/shared/ui/mensagem-erro'
import { novaSenhaSchema, type NovaSenhaForm } from '../schemas/authSchemas'

/** Nova senha + confirmação; usado na redefinição (RF-01) e no primeiro acesso (RF-11). */
export function FormNovaSenha({
  aoEnviar,
  enviando,
  erro,
  rotuloBotao,
}: {
  aoEnviar: (senha: string) => void
  enviando: boolean
  erro: string | null
  rotuloBotao: string
}) {
  const form = useForm<NovaSenhaForm>({ resolver: zodResolver(novaSenhaSchema) })
  return (
    <form className="grid gap-4" noValidate onSubmit={form.handleSubmit((v) => aoEnviar(v.senha))}>
      <Campo
        rotulo="Nova senha"
        type="password"
        autoComplete="new-password"
        erro={form.formState.errors.senha?.message}
        {...form.register('senha')}
      />
      <Campo
        rotulo="Confirme a senha"
        type="password"
        autoComplete="new-password"
        erro={form.formState.errors.confirmacao?.message}
        {...form.register('confirmacao')}
      />
      <MensagemErro erro={erro} />
      <Button type="submit" disabled={enviando}>
        {enviando ? 'Salvando…' : rotuloBotao}
      </Button>
    </form>
  )
}
