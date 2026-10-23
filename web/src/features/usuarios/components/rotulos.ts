import type { PerfilUsuario, StatusUsuario } from '../api/usuariosApi'

export const ROTULO_PERFIL: Record<PerfilUsuario, string> = {
  solicitante: 'Solicitante',
  admin: 'Administrador',
}

export const ROTULO_STATUS: Record<StatusUsuario, string> = {
  pendente: 'Pendente',
  ativo: 'Ativo',
  inativo: 'Inativo',
}

export type SituacaoConvite = 'enviado' | 'aceito' | 'cancelado' | 'expirado'

export const ROTULO_SITUACAO: Record<SituacaoConvite, string> = {
  enviado: 'Enviado',
  aceito: 'Aceito',
  cancelado: 'Cancelado',
  expirado: 'Expirado',
}

export const OPCOES_PERFIL = (Object.keys(ROTULO_PERFIL) as PerfilUsuario[]).map((valor) => ({
  valor,
  rotulo: ROTULO_PERFIL[valor],
}))
