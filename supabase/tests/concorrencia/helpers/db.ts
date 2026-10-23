// Suíte de concorrência (spec-001/T-06a): sessões reais e simultâneas contra o
// Postgres local, para o que o pgTAP não cobre (uma transação só).
// Rodar de dentro de web/: npm run test:db:concorrencia
import { randomUUID } from 'node:crypto'
import pg from 'pg'

export const DB_URL =
  process.env.SUPABASE_DB_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'

type Perfil = 'admin' | 'solicitante'
type StatusUsuario = 'pendente' | 'ativo' | 'inativo'

export interface Sessao {
  /** pid do backend, para checar bloqueios em pg_stat_activity */
  pid: number
  /** Abre transação como `authenticated` com auth.uid() = uid, como faz o PostgREST. */
  iniciar(): Promise<void>
  query<T extends pg.QueryResultRow = pg.QueryResultRow>(
    sql: string,
    params?: unknown[],
  ): Promise<pg.QueryResult<T>>
  commit(): Promise<void>
  rollback(): Promise<void>
  fechar(): Promise<void>
}

async function conectar(): Promise<pg.Client> {
  const client = new pg.Client({ connectionString: DB_URL })
  await client.connect()
  return client
}

/** Sessão de um usuário da aplicação (role `authenticated`, RLS valendo). */
export async function abrirSessao(uid: string): Promise<Sessao> {
  const client = await conectar()
  const { rows } = await client.query<{ pid: number }>('select pg_backend_pid() as pid')
  const claims = JSON.stringify({ sub: uid, role: 'authenticated' })

  return {
    pid: rows[0]!.pid,
    async iniciar() {
      await client.query('begin')
      await client.query('set local role authenticated')
      await client.query("select set_config('request.jwt.claims', $1, true)", [claims])
    },
    query: (sql, params) => client.query(sql, params),
    async commit() {
      await client.query('commit')
    },
    async rollback() {
      await client.query('rollback')
    },
    fechar: () => client.end(),
  }
}

/** Conexão de sistema (dono do banco, sem RLS) para criar e limpar dados de teste. */
export async function abrirSistema(): Promise<pg.Client> {
  return conectar()
}

/** Cria usuário em auth.users + profiles. Retorna o id. */
export async function criarUsuario(
  sistema: pg.Client,
  dados: { perfil?: Perfil; status?: StatusUsuario; nome?: string } = {},
): Promise<string> {
  const id = randomUUID()
  const email = `conc-${id}@teste.test`
  await sistema.query('insert into auth.users (id, email) values ($1, $2)', [id, email])
  await sistema.query(
    'insert into public.profiles (id, nome, email, perfil, status) values ($1, $2, $3, $4, $5)',
    [
      id,
      dados.nome ?? 'Teste concorrência',
      email,
      dados.perfil ?? 'solicitante',
      dados.status ?? 'ativo',
    ],
  )
  return id
}

/**
 * Remove os usuários de teste. Os registros de auditoria ficam: a auditoria é
 * imutável (spec-006/RF-12) e some só com `supabase db reset`.
 */
export async function removerUsuarios(sistema: pg.Client, ids: string[]): Promise<void> {
  if (ids.length === 0) return
  await sistema.query('delete from public.profiles where id = any($1::uuid[])', [ids])
  await sistema.query('delete from auth.users where id = any($1::uuid[])', [ids])
}

/** Espera até a sessão `pid` estar parada aguardando um lock (ou estoura o prazo). */
export async function esperarBloqueio(sistema: pg.Client, pid: number, prazoMs = 5_000) {
  const limite = Date.now() + prazoMs
  while (Date.now() < limite) {
    const { rows } = await sistema.query<{ bloqueada: boolean }>(
      "select wait_event_type = 'Lock' as bloqueada from pg_stat_activity where pid = $1",
      [pid],
    )
    if (rows[0]?.bloqueada) return
    await new Promise((r) => setTimeout(r, 25))
  }
  throw new Error(`Sessão ${pid} não ficou bloqueada em ${prazoMs} ms`)
}
