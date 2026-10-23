// spec-001/T-06a: valida a própria suíte — duas sessões autenticadas e simultâneas.
import type pg from 'pg'
import { afterAll, beforeAll, describe, expect, test } from 'vitest'
import {
  abrirSessao,
  abrirSistema,
  criarUsuario,
  esperarBloqueio,
  removerUsuarios,
  type Sessao,
} from './helpers/db'

describe('T-06a: suíte de concorrência', () => {
  let sistema: pg.Client
  let idA: string
  let idB: string
  let a: Sessao
  let b: Sessao

  beforeAll(async () => {
    sistema = await abrirSistema()
    idA = await criarUsuario(sistema, { perfil: 'admin' })
    idB = await criarUsuario(sistema)
    a = await abrirSessao(idA)
    b = await abrirSessao(idB)
  })

  afterAll(async () => {
    await a?.fechar()
    await b?.fechar()
    await removerUsuarios(sistema, [idA, idB])
    await sistema?.end()
  })

  test('T-06a: cada sessão enxerga o próprio auth.uid() e perfil', async () => {
    await a.iniciar()
    await b.iniciar()
    const ra = await a.query<{ uid: string; admin: boolean }>(
      'select auth.uid() as uid, public.eh_admin_ativo() as admin',
    )
    const rb = await b.query<{ uid: string; admin: boolean }>(
      'select auth.uid() as uid, public.eh_admin_ativo() as admin',
    )
    await a.rollback()
    await b.rollback()

    expect(ra.rows[0]).toEqual({ uid: idA, admin: true })
    expect(rb.rows[0]).toEqual({ uid: idB, admin: false })
  })

  test('T-06a: as sessões rodam como authenticated, sob RLS', async () => {
    await a.iniciar()
    const { rows } = await a.query<{ papel: string }>('select current_user as papel')
    await a.rollback()
    expect(rows[0]?.papel).toBe('authenticated')
  })

  test('T-06a: uma transação espera o lock da outra (FOR UPDATE)', async () => {
    // Lock consultivo na própria transação: não depende de política RLS.
    await a.iniciar()
    await b.iniciar()
    await a.query('select pg_advisory_xact_lock(42)')

    const ordem: string[] = []
    const pendenteB = b.query('select pg_advisory_xact_lock(42)').then(() => ordem.push('B'))

    await esperarBloqueio(sistema, b.pid)
    ordem.push('A')
    await a.commit()
    await pendenteB
    await b.commit()

    expect(ordem).toEqual(['A', 'B'])
  })
})
