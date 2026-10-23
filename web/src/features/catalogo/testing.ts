// Utilitário de teste: linha do catálogo com valores padrão.
import type { ItemCatalogo } from './api/catalogoApi'

export function itemFalso(dados: Partial<ItemCatalogo> = {}): ItemCatalogo {
  return {
    id: 'i-1',
    nome: 'Chave de fenda',
    descricao: null,
    tipo_id: 't-ferr',
    tipo_nome: 'Ferramenta',
    consumivel: false,
    local_id: 'l-alm',
    local_nome: 'Almoxarifado',
    quantidade_total: 10,
    quantidade_reservada: 0,
    quantidade_em_uso: 0,
    disponivel: 10,
    operante: true,
    estado: 'bom',
    numero_patrimonio: null,
    estoque_minimo: null,
    ativo: true,
    atualizado_em: '2026-10-23T00:00:00Z',
    ...dados,
  }
}
