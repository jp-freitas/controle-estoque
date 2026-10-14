import js from '@eslint/js'
import prettier from 'eslint-config-prettier'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'
import globals from 'globals'
import tseslint from 'typescript-eslint'

export default defineConfig([
  globalIgnores(['dist', 'playwright-report', 'test-results', 'src/types/database.ts']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat['recommended-latest'],
      reactRefresh.configs.vite,
      prettier,
    ],
    languageOptions: { globals: globals.browser },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
    },
  },
  {
    // Componentes gerados pelo shadcn/ui exportam variantes junto com o componente.
    files: ['src/shared/ui/**/*.tsx'],
    rules: { 'react-refresh/only-export-components': 'off' },
  },
])
