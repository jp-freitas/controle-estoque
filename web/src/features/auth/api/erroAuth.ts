// Mensagens em pt-BR para os erros do Supabase Auth (login, recuperação, senha).
// Erros de RPC usam shared/lib/erroRpc.

const POR_CODIGO: Record<string, string> = {
  invalid_credentials: 'E-mail ou senha incorretos.',
  email_not_confirmed: 'Confirme seu e-mail antes de entrar.',
  user_banned: 'Acesso bloqueado. Procure a administração da escola.',
  over_email_send_rate_limit:
    'Muitos e-mails enviados em pouco tempo. Aguarde um pouco e tente de novo.',
  over_request_rate_limit: 'Muitas tentativas em pouco tempo. Aguarde um pouco e tente de novo.',
  weak_password: 'Senha fraca. Use pelo menos 6 caracteres.',
  same_password: 'A nova senha precisa ser diferente da atual.',
  session_not_found: 'Sua sessão expirou. Abra o link do e-mail novamente.',
}

export function mensagemErroAuth(erro: unknown): string {
  const { code, status, message } = (erro ?? {}) as {
    code?: string
    status?: number
    message?: string
  }
  if (code && POR_CODIGO[code]) return POR_CODIGO[code]
  if (status === 429) return POR_CODIGO.over_request_rate_limit!
  // O hook de cadastro (spec-001/RF-03) devolve 403 com a mensagem já em pt-BR.
  if (status === 403 && message) return message
  return 'Não foi possível concluir. Verifique sua conexão e tente novamente.'
}
