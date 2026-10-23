/** Minúsculas e sem acento, para busca: "maquina" encontra "Máquina". */
export function normalizar(texto: string): string {
  return texto.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim()
}
