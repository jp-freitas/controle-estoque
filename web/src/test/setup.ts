import '@testing-library/jest-dom/vitest'

// Testes de front não falam com o Supabase: cada teste simula a camada `api`
// da feature (vi.mock). Usar o cliente real aqui é erro do teste.
vi.mock('@/lib/supabase', () => ({
  supabase: new Proxy(
    {},
    {
      get() {
        throw new Error('Cliente Supabase usado em teste: simule a camada api com vi.mock.')
      },
    },
  ),
}))
