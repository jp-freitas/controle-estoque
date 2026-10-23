// spec-001/T-09: RF-07 com duas sessões reais — dois admins se rebaixando ao mesmo tempo.
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

const RF07 = 'RF-07: dois admins se rebaixando ao mesmo tempo'

describe(RF07, () => {
  let sistema: pg.Client
  let idA: string
  let idB: string
  let a: Sessao
  let b: Sessao

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
    await removerUsuarios(sistema, [idA, idB])
    await sistema.end()
  })

  const perfis = async () => {
    const { rows } = await sistema.query<{ id: string; perfil: string }>(
      'select id, perfil from public.profiles where id = any($1::uuid[])',
      [[idA, idB]],
    )
    return Object.fromEntries(rows.map((r) => [r.id, r.perfil]))
  }

  test(`${RF07}: o segundo espera o primeiro e é negado`, async () => {
    await a.iniciar()
    await b.iniciar()
    await a.query("select public.alterar_perfil_usuario($1, 'solicitante')", [idB])

    const tentativaB = b
      .query("select public.alterar_perfil_usuario($1, 'solicitante')", [idA])
      .then(
        () => null,
        (e: Error) => e.message,
      )

    // B fica parado na trava dos admins ativos enquanto A não termina
    await esperarBloqueio(sistema, b.pid)
    await a.commit()

    expect(await tentativaB).toBe('Apenas administradores ativos podem alterar usuários.')
    await b.rollback()
    expect(await perfis()).toEqual({ [idA]: 'admin', [idB]: 'solicitante' })
  })

  test(`${RF07}: rebaixar e inativar em paralelo — só um vence`, async () => {
    await a.iniciar()
    await b.iniciar()

    const resultados = await Promise.allSettled([
      a.query("select public.alterar_status_usuario($1, 'inativo')", [idB]).then(() => a.commit()),
      b
        .query("select public.alterar_perfil_usuario($1, 'solicitante')", [idA])
        .then(() => b.commit()),
    ])
    // quem perdeu fica com a transação abortada
    await a.query('rollback')
    await b.query('rollback')

    expect(resultados.filter((r) => r.status === 'fulfilled')).toHaveLength(1)
    const { rows } = await sistema.query<{ n: number }>(
      "select count(*)::int as n from public.profiles where id = any($1::uuid[]) and perfil = 'admin' and status = 'ativo'",
      [[idA, idB]],
    )
    expect(rows[0]?.n).toBe(1)
  })
})
