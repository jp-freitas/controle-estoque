import { useCallback, useState } from 'react'

/**
 * Estado de um diálogo com dados. Fechar só desliga `aberto` e mantém `dados`,
 * para o conteúdo não sumir durante a animação de saída.
 */
export function useDialogo<T>() {
  const [estado, setEstado] = useState<{ aberto: boolean; dados: T | null }>({
    aberto: false,
    dados: null,
  })
  const abrir = useCallback((dados: T) => setEstado({ aberto: true, dados }), [])
  const fechar = useCallback(() => setEstado((e) => ({ ...e, aberto: false })), [])
  return { aberto: estado.aberto, dados: estado.dados, abrir, fechar }
}
