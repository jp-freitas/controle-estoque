// spec-001/T-13: RF-14 e RN-05 com duas sessões reais — dois admins convidando ao mesmo tempo.
import { randomUUID } from 'node:crypto'
import type pg from 'pg'
import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import {
  abrirSessao,
  abrirSistema,
  criarUsuario,
  esperarBloqueio,
  removerUsuarios,
  type Sessao,
} from './helpers/db'

describe('RF-14 / RN-05: dois admins convidando ao mesmo tempo', () => {
  let sistema: pg.Client
  let idA: string
  let idB: string
  let a: Sessao
  let b: Sessao
  const emails: string[] = []

  beforeEach(async () => {
    sistema = await abrirSistema()
    idA = await criarUsuario(sistema, { perfil: 'admin' })
    idB = await criarUsuario(sistema, { perfil: 'admin' })
    a = await abrirSessao(idA)
    b = await abrirSessao(idB)
  })

  afterEach(async () => {
    await a.fechar()
    await b.fechar()
    await sistema.query('delete from public.convite where email = any($1::text[])', [emails])
    await removerUsuarios(sistema, [idA, idB])
    await sistema.end()
  })

  const novoEmail = () => {
    const email = `conc-convite-${randomUUID()}@teste.test`
    emails.push(email)
    return email
  }

  const convidar = (s: Sessao, email: string, matricula: string | null) =>
    s.query("select public.convidar_usuario($1, 'Convidado', $2)", [email, matricula]).then(
      () => null,
      (e: Error) => e.message,
    )

  test('RF-14: mesmo e-mail ao mesmo tempo → só um convite', async () => {
    const email = novoEmail()
    await a.iniciar()
    await b.iniciar()
    expect(await convidar(a, email, null)).toBeNull()

    const tentativaB = convidar(b, email, null)
    await esperarBloqueio(sistema, b.pid)
    await a.commit()

    expect(await tentativaB).toBe('Já existe um convite em aberto para este e-mail.')
    await b.rollback()
    const { rows } = await sistema.query<{ n: number }>(
      'select count(*)::int as n from public.convite where email = $1',
      [email],
    )
    expect(rows[0]?.n).toBe(1)
  })

  test('RN-05: mesma matrícula em e-mails diferentes ao mesmo tempo → só um convite', async () => {
    const matricula = `CONC-${randomUUID()}`
    const [email1, email2] = [novoEmail(), novoEmail()]
    await a.iniciar()
    await b.iniciar()
    expect(await convidar(a, email1, matricula)).toBeNull()

    const tentativaB = convidar(b, email2, matricula)
    await esperarBloqueio(sistema, b.pid)
    await a.commit()

    expect(await tentativaB).toBe('Matrícula já cadastrada.')
    await b.rollback()
    const { rows } = await sistema.query<{ n: number }>(
      'select count(*)::int as n from public.convite where matricula = $1',
      [matricula],
    )
    expect(rows[0]?.n).toBe(1)
  })
})
