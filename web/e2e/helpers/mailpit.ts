// Lê os e-mails do Auth local no Mailpit (http://127.0.0.1:54324).
const MAILPIT = process.env.MAILPIT_URL ?? 'http://127.0.0.1:54324'

interface Mensagem {
  ID: string
  Subject: string
  To: { Address: string }[]
}

/** Espera o e-mail chegar para `para` e devolve assunto e primeiro link do corpo. */
export async function esperarEmail(
  para: string,
  prazoMs = 10_000,
): Promise<{ assunto: string; link: string }> {
  const limite = Date.now() + prazoMs
  while (Date.now() < limite) {
    const { messages } = (await (await fetch(`${MAILPIT}/api/v1/messages`)).json()) as {
      messages: Mensagem[]
    }
    const msg = messages.find((m) => m.To.some((t) => t.Address === para))
    if (msg) {
      const corpo = (await (await fetch(`${MAILPIT}/api/v1/message/${msg.ID}`)).json()) as {
        HTML: string
      }
      const href = corpo.HTML.match(/href="([^"]+)"/)?.[1]
      if (!href) throw new Error(`E-mail para ${para} sem link`)
      return { assunto: msg.Subject, link: href.replaceAll('&amp;', '&') }
    }
    await new Promise((r) => setTimeout(r, 250))
  }
  throw new Error(`Nenhum e-mail para ${para} em ${prazoMs} ms`)
}
