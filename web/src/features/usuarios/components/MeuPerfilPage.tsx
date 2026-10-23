import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { useSessao } from '@/features/auth'
import { erroRpc } from '@/shared/lib/erroRpc'
import { Alert, AlertDescription } from '@/shared/ui/alert'
import { Button } from '@/shared/ui/button'
import { Campo } from '@/shared/ui/campo'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card'
import { MensagemErro } from '@/shared/ui/mensagem-erro'
import type { Usuario } from '../api/usuariosApi'
import { useAtualizarMeuPerfil } from '../hooks/useUsuarios'
import { dadosUsuarioSchema, type DadosUsuarioForm } from '../schemas/usuariosSchemas'
import { ROTULO_PERFIL, ROTULO_STATUS } from './rotulos'

/** spec-001/RF-15, CA-16: o usuário ativo edita nome e matrícula; o resto é só leitura. */
export function MeuPerfilPage() {
  const { perfil } = useSessao()
  if (!perfil) return null
  return <FormMeuPerfil key={perfil.id} perfil={perfil} />
}

function FormMeuPerfil({ perfil }: { perfil: Usuario }) {
  const atualizar = useAtualizarMeuPerfil()
  const form = useForm<DadosUsuarioForm>({
    resolver: zodResolver(dadosUsuarioSchema),
    defaultValues: { nome: perfil.nome, matricula: perfil.matricula ?? '' },
  })

  return (
    <Card className="max-w-lg">
      <CardHeader>
        <CardTitle>
          <h2>Meu perfil</h2>
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4">
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
          <dt className="text-muted-foreground">E-mail</dt>
          <dd>{perfil.email}</dd>
          <dt className="text-muted-foreground">Perfil</dt>
          <dd>{ROTULO_PERFIL[perfil.perfil]}</dd>
          <dt className="text-muted-foreground">Status</dt>
          <dd>{ROTULO_STATUS[perfil.status]}</dd>
        </dl>
        <form
          className="grid gap-4"
          noValidate
          onSubmit={form.handleSubmit((v) =>
            atualizar.mutate(v, {
              // valores normalizados pelo banco (trim, matrícula vazia → null)
              onSuccess: (salvo) =>
                form.reset({ nome: salvo.nome, matricula: salvo.matricula ?? '' }),
            }),
          )}
        >
          <Campo
            rotulo="Nome"
            erro={form.formState.errors.nome?.message}
            {...form.register('nome')}
          />
          <Campo rotulo="Matrícula (opcional)" {...form.register('matricula')} />
          <MensagemErro erro={atualizar.isError ? erroRpc(atualizar.error) : null} />
          {atualizar.isSuccess && (
            <Alert role="status">
              <AlertDescription>Perfil atualizado.</AlertDescription>
            </Alert>
          )}
          <Button type="submit" className="justify-self-start" disabled={atualizar.isPending}>
            {atualizar.isPending ? 'Salvando…' : 'Salvar'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
