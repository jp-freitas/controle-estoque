import { z } from 'zod'

// Mínimo igual ao do Supabase Auth (supabase/config.toml → minimum_password_length).
export const SENHA_MINIMA = 6

const email = z.string().trim().min(1, 'Informe o e-mail.').email('E-mail inválido.')

export const entrarSchema = z.object({
  email,
  senha: z.string().min(1, 'Informe a senha.'),
})
export type EntrarForm = z.infer<typeof entrarSchema>

export const recuperarSchema = z.object({ email })
export type RecuperarForm = z.infer<typeof recuperarSchema>

export const novaSenhaSchema = z
  .object({
    senha: z
      .string()
      .min(SENHA_MINIMA, `A senha precisa ter pelo menos ${SENHA_MINIMA} caracteres.`),
    confirmacao: z.string(),
  })
  .refine((v) => v.senha === v.confirmacao, {
    message: 'As senhas não conferem.',
    path: ['confirmacao'],
  })
export type NovaSenhaForm = z.infer<typeof novaSenhaSchema>
