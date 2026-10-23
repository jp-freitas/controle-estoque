// spec-002/T-12a: RN-05 com duas sessões reais — regras entre item, tipo e local
// (RN-03, RN-04; CA-12, CA-13, CA-14) valem quando dois admins agem ao mesmo tempo.
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

describe('RN-05: cadastro de item × mudança no tipo ou local', () => {
  let sistema: pg.Client
  let idA: string
  let idB: string
  let a: Sessao
  let b: Sessao
  let localId: string
  let tipoId: string

  beforeEach(async () => {
    sistema = await abrirSistema()
    idA = await criarUsuario(sistema, { perfil: 'admin' })
    idB = await criarUsuario(sistema, { perfil: 'admin' })
    a = await abrirSessao(idA)
    b = await abrirSessao(idB)
    localId = randomUUID()
    tipoId = randomUUID()
    await sistema.query('insert into public.local (id, nome) values ($1, $2)', [
      localId,
      `conc-local-${localId}`,
    ])
    await sistema.query(
      'insert into public.tipo_item (id, nome, consumivel) values ($1, $2, true)',
      [tipoId, `conc-tipo-${tipoId}`],
    )
  })

  afterEach(async () => {
    await a.fechar()
    await b.fechar()
    await sistema.query('delete from public.item where local_id = $1', [localId])
    await sistema.query('delete from public.local where id = $1', [localId])
    await sistema.query('delete from public.tipo_item where id = $1', [tipoId])
    await removerUsuarios(sistema, [idA, idB])
    await sistema.end()
  })

  const cadastrar = (s: Sessao, estoqueMinimo: number | null = null) =>
    s
      .query(
        `insert into public.item (nome, tipo_id, local_id, quantidade_total, estoque_minimo)
         values ('Item concorrência', $1, $2, 1, $3)`,
        [tipoId, localId, estoqueMinimo],
      )
      .then(
        () => null,
        (e: Error) => e.message,
      )

  const executar = (s: Sessao, sql: string) =>
    s.query(sql, [localId, tipoId]).then(
      () => null,
      (e: Error) => e.message,
    )

  const contar = async (sql: string) => {
    const { rows } = await sistema.query<{ n: number }>(sql, [localId, tipoId])
    return rows[0]?.n
  }

  test('CA-13: cadastrar item no local enquanto outro admin o desativa → desativação rejeitada', async () => {
    await a.iniciar()
    await b.iniciar()
    expect(await cadastrar(a)).toBeNull()

    const desativar = executar(
      b,
      'update public.local set ativo = false where id = $1 and $2::uuid is not null',
    )
    await esperarBloqueio(sistema, b.pid)
    await a.commit()

    expect(await desativar).toBe('Há 1 item ativo neste local. Mova ou desative esse item antes.')
    await b.rollback()
    expect(
      await contar(
        'select count(*)::int as n from public.local where id = $1 and ativo and $2::uuid is not null',
      ),
    ).toBe(1)
  })

  test('CA-12: desativar o local enquanto outro admin cadastra item nele → cadastro rejeitado', async () => {
    await a.iniciar()
    await b.iniciar()
    expect(
      await executar(
        b,
        'update public.local set ativo = false where id = $1 and $2::uuid is not null',
      ),
    ).toBeNull()

    const tentativa = cadastrar(a)
    await esperarBloqueio(sistema, a.pid)
    await b.commit()

    expect(await tentativa).toBe('Local desativado.')
    await a.rollback()
    expect(
      await contar(
        'select count(*)::int as n from public.item where local_id = $1 and tipo_id = $2',
      ),
    ).toBe(0)
  })

  test('CA-14: cadastrar item do tipo enquanto outro admin muda consumível → mudança rejeitada', async () => {
    await a.iniciar()
    await b.iniciar()
    expect(await cadastrar(a)).toBeNull()

    const mudar = executar(
      b,
      'update public.tipo_item set consumivel = false where id = $2 and $1::uuid is not null',
    )
    await esperarBloqueio(sistema, b.pid)
    await a.commit()

    expect(await mudar).toBe('Este tipo já tem itens; não é possível mudar se é consumível.')
    await b.rollback()
  })

  test('RN-04: tipo deixa de ser consumível enquanto outro admin cadastra com estoque mínimo → cadastro rejeitado', async () => {
    await a.iniciar()
    await b.iniciar()
    expect(
      await executar(
        b,
        'update public.tipo_item set consumivel = false where id = $2 and $1::uuid is not null',
      ),
    ).toBeNull()

    const tentativa = cadastrar(a, 5)
    await esperarBloqueio(sistema, a.pid)
    await b.commit()

    expect(await tentativa).toBe('Estoque mínimo só vale para tipos consumíveis.')
    await a.rollback()
  })
})
