// spec-004/T-05: CA-03 e RN-03 com sessões reais — decisões simultâneas sobre o mesmo estoque.
import { randomUUID } from 'node:crypto'
import type pg from 'pg'
import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import {
  abrirSessao,
  abrirSistema,
  criarUsuario,
  esperarBloqueio,
  limparComTriggersDesligados,
  removerUsuarios,
  type Sessao,
} from './helpers/db'

describe('CA-03 / RN-03: decisões simultâneas', () => {
  let sistema: pg.Client
  let idA: string
  let idB: string
  let idProf: string
  let a: Sessao
  let b: Sessao
  let prof: Sessao
  let itemId: string
  let localId: string

  beforeEach(async () => {
    sistema = await abrirSistema()
    idA = await criarUsuario(sistema, { perfil: 'admin' })
    idB = await criarUsuario(sistema, { perfil: 'admin' })
    idProf = await criarUsuario(sistema)
    a = await abrirSessao(idA)
    b = await abrirSessao(idB)
    prof = await abrirSessao(idProf)
    localId = randomUUID()
    itemId = randomUUID()
    await sistema.query('insert into public.local (id, nome) values ($1, $2)', [
      localId,
      `conc-local-${localId}`,
    ])
    // uma unidade só: estoque para apenas uma das solicitações
    await sistema.query(
      `insert into public.item (id, nome, tipo_id, local_id, quantidade_total)
       values ($1, 'Projetor concorrência', (select id from public.tipo_item where nome = 'Máquina'), $2, 1)`,
      [itemId, localId],
    )
  })

  afterEach(async () => {
    await a.fechar()
    await b.fechar()
    await prof.fechar()
    await limparComTriggersDesligados(sistema, [
      ['delete from public.movimentacao where item_id = $1', [itemId]],
      ['delete from public.solicitacao_item where item_id = $1', [itemId]],
      ['delete from public.solicitacao where solicitante_id = $1', [idProf]],
      ['delete from public.item where id = $1', [itemId]],
      ['delete from public.local where id = $1', [localId]],
    ])
    await removerUsuarios(sistema, [idA, idB, idProf])
    await sistema.end()
  })

  const enviar = async () => {
    await prof.iniciar()
    const { rows } = await prof.query<{ id: string }>(
      'select public.enviar_solicitacao($1, $2) as id',
      [JSON.stringify([{ item_id: itemId, quantidade: 1 }]), 'Concorrência'],
    )
    await prof.commit()
    return rows[0]!.id
  }

  const aprovar = (s: Sessao, solicitacaoId: string) =>
    s
      .query(
        `select public.aprovar_solicitacao($1, (
           select jsonb_agg(jsonb_build_object('solicitacao_item_id', id, 'quantidade_aprovada', 1))
             from public.solicitacao_item where solicitacao_id = $1))`,
        [solicitacaoId],
      )
      .then(
        () => null,
        (e: Error & { detail?: string }) => ({ mensagem: e.message, detalhe: e.detail }),
      )

  const reservada = async () => {
    const { rows } = await sistema.query<{ n: number }>(
      'select quantidade_reservada as n from public.item where id = $1',
      [itemId],
    )
    return rows[0]?.n
  }

  test('CA-03: duas aprovações do mesmo item com estoque para uma → exatamente uma conclui', async () => {
    const s1 = await enviar()
    const s2 = await enviar()
    await a.iniciar()
    await b.iniciar()
    expect(await aprovar(a, s1)).toBeNull()

    const tentativaB = aprovar(b, s2)
    await esperarBloqueio(sistema, b.pid)
    await a.commit()

    const erro = await tentativaB
    expect(erro?.mensagem).toBe('Não foi possível aprovar. Confira os itens indicados.')
    expect(JSON.parse(erro?.detalhe ?? '[]')[0].motivo).toBe('Estoque insuficiente: disponível 0.')
    await b.rollback()
    expect(await reservada()).toBe(1)
    const { rows } = await sistema.query<{ status: string }>(
      'select status from public.solicitacao where id = any($1::uuid[]) order by criado_em',
      [[s1, s2]],
    )
    expect(rows.map((r) => r.status)).toEqual(['aprovada', 'pendente'])
  })

  test('RN-03: professor cancela enquanto o admin aprova → sem reserva de solicitação cancelada', async () => {
    const s1 = await enviar()
    await prof.iniciar()
    await a.iniciar()
    await prof.query('select public.cancelar_solicitacao($1)', [s1])

    const tentativa = aprovar(a, s1)
    await esperarBloqueio(sistema, a.pid)
    await prof.commit()

    expect((await tentativa)?.mensagem).toBe('Só solicitações pendentes podem ser aprovadas.')
    await a.rollback()
    expect(await reservada()).toBe(0)
  })

  test('RN-03: admin aprova enquanto o professor cancela → o cancelamento é recusado', async () => {
    const s1 = await enviar()
    await a.iniciar()
    await prof.iniciar()
    expect(await aprovar(a, s1)).toBeNull()

    const cancelar = prof.query('select public.cancelar_solicitacao($1)', [s1]).then(
      () => null,
      (e: Error) => e.message,
    )
    await esperarBloqueio(sistema, prof.pid)
    await a.commit()

    expect(await cancelar).toBe('Solicitação já aprovada; peça ao administrador para cancelar.')
    await prof.rollback()
    expect(await reservada()).toBe(1)
  })
})
