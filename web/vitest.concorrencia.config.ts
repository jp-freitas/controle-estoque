// Suíte de concorrência do banco (spec-001/T-06a): `npm run test:db:concorrencia`.
// Os testes ficam em supabase/tests/concorrencia/ (fora de web/), por isso o root
// sobe um nível e `pg` é resolvido a partir de web/node_modules.
import path from 'node:path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  root: path.resolve(import.meta.dirname, '..'),
  // Sem isto o cache do Vite/Vitest iria para node_modules/ na raiz do repositório.
  cacheDir: path.resolve(import.meta.dirname, 'node_modules/.vite'),
  resolve: { alias: { pg: path.resolve(import.meta.dirname, 'node_modules/pg') } },
  test: {
    include: ['supabase/tests/concorrencia/**/*.test.ts'],
    environment: 'node',
    // Os arquivos compartilham o mesmo banco: um de cada vez.
    fileParallelism: false,
    testTimeout: 20_000,
  },
})
