import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { Session } from '@supabase/supabase-js'
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { buscarPerfil, obterSessao, observarSessao, sair } from '../api/sessaoApi'
import { chavePerfil, SessaoContext, type SessaoValor } from './sessaoContext'

/** spec-001/T-21: sessão do Supabase Auth + `profiles` do usuário logado. */
export function SessaoProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const [sessao, setSessao] = useState<Session | null>(null)
  const [carregandoSessao, setCarregandoSessao] = useState(true)

  useEffect(() => {
    let ativo = true
    void obterSessao().then((s) => {
      if (!ativo) return
      setSessao(s)
      setCarregandoSessao(false)
    })
    const parar = observarSessao((s) => {
      setSessao(s)
      setCarregandoSessao(false)
    })
    return () => {
      ativo = false
      parar()
    }
  }, [])

  const uid = sessao?.user.id
  const perfil = useQuery({
    queryKey: chavePerfil(uid),
    queryFn: () => buscarPerfil(uid!),
    enabled: !!uid,
  })

  const recarregarPerfil = useCallback(
    () => queryClient.invalidateQueries({ queryKey: chavePerfil(uid) }),
    [queryClient, uid],
  )

  const encerrar = useCallback(async () => {
    await sair()
    queryClient.clear()
  }, [queryClient])

  const valor = useMemo<SessaoValor>(
    () => ({
      sessao,
      perfil: perfil.data ?? null,
      carregando: carregandoSessao || (!!uid && perfil.isPending),
      erroPerfil: perfil.isError,
      sair: encerrar,
      recarregarPerfil,
    }),
    [
      sessao,
      perfil.data,
      perfil.isPending,
      perfil.isError,
      carregandoSessao,
      uid,
      encerrar,
      recarregarPerfil,
    ],
  )

  return <SessaoContext value={valor}>{children}</SessaoContext>
}
