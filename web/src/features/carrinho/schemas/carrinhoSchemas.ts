import { z } from 'zod'

// RF-06 / CA-04 (conveniência; o banco valida igual)
export const envioSchema = z.object({
  justificativa: z
    .string()
    .trim()
    .min(3, 'Informe a justificativa (aula, turma ou finalidade).')
    .max(500, 'Use no máximo 500 caracteres.'),
})
export type EnvioForm = z.infer<typeof envioSchema>
