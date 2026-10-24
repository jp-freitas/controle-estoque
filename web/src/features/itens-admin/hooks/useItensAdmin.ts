import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { chaveCatalogo } from '@/features/catalogo'
import {
  ajustarQuantidade,
  alterarOperancia,
  atualizarItem,
  atualizarLocal,
  atualizarTipo,
  criarItem,
  criarLocal,
  criarTipo,
  excluirItem,
  excluirLocal,
  excluirTipo,
  listarLocais,
  listarTipos,
} from '../api/itensAdminApi'

const chaves = {
  tipos: ['tipos'] as const,
  locais: ['locais'] as const,
}

export function useTipos() {
  return useQuery({ queryKey: chaves.tipos, queryFn: listarTipos })
}

export function useLocais() {
  return useQuery({ queryKey: chaves.locais, queryFn: listarLocais })
}

/** Toda escrita de cadastro pode mudar o catálogo (nomes de tipo/local, itens). */
function useMutacaoCadastro<T>(fn: (v: T) => Promise<unknown>) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: () =>
      Promise.all([
        qc.invalidateQueries({ queryKey: chaves.tipos }),
        qc.invalidateQueries({ queryKey: chaves.locais }),
        qc.invalidateQueries({ queryKey: chaveCatalogo }),
      ]),
  })
}

export const useCriarTipo = () =>
  useMutacaoCadastro((v: Parameters<typeof criarTipo>[0]) => criarTipo(v))
export const useAtualizarTipo = () =>
  useMutacaoCadastro((v: { id: string; dados: Parameters<typeof atualizarTipo>[1] }) =>
    atualizarTipo(v.id, v.dados),
  )
export const useExcluirTipo = () => useMutacaoCadastro((id: string) => excluirTipo(id))

export const useCriarLocal = () =>
  useMutacaoCadastro((v: Parameters<typeof criarLocal>[0]) => criarLocal(v))
export const useAtualizarLocal = () =>
  useMutacaoCadastro((v: { id: string; dados: Parameters<typeof atualizarLocal>[1] }) =>
    atualizarLocal(v.id, v.dados),
  )
export const useExcluirLocal = () => useMutacaoCadastro((id: string) => excluirLocal(id))

export const useCriarItem = () =>
  useMutacaoCadastro((v: Parameters<typeof criarItem>[0]) => criarItem(v))
export const useAtualizarItem = () =>
  useMutacaoCadastro((v: { id: string; dados: Parameters<typeof atualizarItem>[1] }) =>
    atualizarItem(v.id, v.dados),
  )
export const useExcluirItem = () => useMutacaoCadastro((id: string) => excluirItem(id))
export const useAjustarQuantidade = () =>
  useMutacaoCadastro((v: { id: string; novaQuantidade: number; motivo: string }) =>
    ajustarQuantidade(v.id, v.novaQuantidade, v.motivo),
  )
export const useAlterarOperancia = () =>
  useMutacaoCadastro((v: { id: string; operante: boolean; motivo: string }) =>
    alterarOperancia(v.id, v.operante, v.motivo),
  )
