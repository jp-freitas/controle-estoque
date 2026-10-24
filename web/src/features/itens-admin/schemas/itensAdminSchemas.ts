import { z } from 'zod'

// Conveniência: a validação real está no banco (RF-07, RN-03, RN-04, CA-01 a CA-04).
const nome = z.string().trim().min(1, 'Informe o nome.')
const inteiro = (mensagem: string) => z.string().trim().regex(/^\d+$/, mensagem)
const MSG_PATRIMONIO = 'Item com número de patrimônio deve ter quantidade 1.'

export const tipoSchema = z.object({ nome, consumivel: z.boolean() })
export type TipoForm = z.infer<typeof tipoSchema>

export const localSchema = z.object({ nome, descricao: z.string().trim() })
export type LocalForm = z.infer<typeof localSchema>

const campos = {
  nome,
  tipoId: z.string().min(1, 'Escolha o tipo.'),
  localId: z.string().min(1, 'Escolha o local.'),
  quantidade: inteiro('Informe um número inteiro, 0 ou mais.'),
  estado: z.enum(['', 'novo', 'bom', 'regular', 'ruim']),
  patrimonio: z.string().trim(),
  descricao: z.string().trim(),
  estoqueMinimo: z.union([z.literal(''), inteiro('Informe um número inteiro, 0 ou mais.')]),
}

/**
 * RF-07 / CA-01: com patrimônio, o cadastro exige quantidade 1; depois o item
 * pode estar com 0 (baixa, spec 005), nunca mais que 1. Na edição a quantidade
 * não muda (só por ajuste), mas a regra vale ao incluir um patrimônio.
 */
export const itemSchema = (novo: boolean) =>
  z
    .object(campos)
    .refine(
      (v) => !v.patrimonio || (novo ? Number(v.quantidade) === 1 : Number(v.quantidade) <= 1),
      { message: MSG_PATRIMONIO, path: ['patrimonio'] },
    )
export type ItemForm = z.infer<ReturnType<typeof itemSchema>>

export const ajusteSchema = z.object({
  novaQuantidade: inteiro('Informe um número inteiro, 0 ou mais.'),
  motivo: z.string().trim().min(1, 'Informe o motivo do ajuste.'),
})
export type AjusteForm = z.infer<typeof ajusteSchema>
