import { z } from 'zod'

// Conveniência: a validação real (e as mensagens de duplicidade) está nas RPCs.
const nome = z.string().trim().min(1, 'Informe o nome.')
const matricula = z.string().trim()

export const conviteSchema = z.object({
  email: z.string().trim().min(1, 'Informe o e-mail.').email('E-mail inválido.'),
  nome,
  matricula,
  perfil: z.enum(['solicitante', 'admin']),
})
export type ConviteForm = z.infer<typeof conviteSchema>

export const dadosUsuarioSchema = z.object({ nome, matricula })
export type DadosUsuarioForm = z.infer<typeof dadosUsuarioSchema>
