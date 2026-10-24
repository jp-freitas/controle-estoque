// API pública da feature catalogo (spec-002/RF-10, RF-11). O carrinho (spec 003)
// usa useCatalogo e podeSolicitar daqui.
export type { EstadoItem, ItemCatalogo } from './api/catalogoApi'
export { CatalogoPage } from './components/CatalogoPage'
export { podeSolicitar } from './components/filtros'
export { ROTULO_ESTADO } from './components/rotulos'
export { chaveCatalogo, useCatalogo } from './hooks/useCatalogo'
