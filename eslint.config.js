import { readdirSync } from 'node:fs'

import js from '@eslint/js'
import prettier from 'eslint-config-prettier/flat'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'
import globals from 'globals'
import tseslint from 'typescript-eslint'

// Las fronteras entre carpetas (6.10, docs/plans/06b-organizar-carpetas.md). Lo que vive en
// `components/`, `lib/` y `hooks/` es genérico: no conoce las features ni la app. Una feature no
// conoce la app. Y la interfaz de una feature (sus componentes y sus hooks) entra en otra solo por
// su índice: la lógica pura (api, esquemas, cálculos) sí va directa a la lógica de otra, porque el
// índice arrastra toda la interfaz y, con ella, los ciclos al cargar (`items` ↔ `profile`…).
const FEATURES = readdirSync(new URL('./src/features', import.meta.url))
const APP = {
  group: ['@/app', '@/app/**', '@/routes', '@/routes/**'],
  message: 'La app compone las features, no al revés: esto no se importa desde aquí.',
}
const restrict = (patterns) => ({ 'no-restricted-imports': ['error', { patterns }] })
const boundaries = [
  {
    files: ['src/{components,lib,hooks}/**/*.{ts,tsx}'],
    rules: restrict([
      {
        group: ['@/features', '@/features/**'],
        message: 'components, lib y hooks son genéricos: no importan features.',
      },
      APP,
    ]),
  },
  { files: ['src/features/**/*.{ts,tsx}'], rules: restrict([APP]) },
  ...FEATURES.map((feature) => ({
    files: [
      `src/features/${feature}/**/*.tsx`,
      `src/features/${feature}/**/hooks/**/*.ts`,
      `src/features/${feature}/**/use*.ts`,
    ],
    rules: restrict([
      APP,
      ...FEATURES.filter((other) => other !== feature).map((other) => ({
        group: [`@/features/${other}/**`],
        message: `Se entra en «${other}» por su índice: import { … } from '@/features/${other}'.`,
      })),
    ]),
  })),
  // Los tests sí entran donde haga falta: simulan módulos concretos (`vi.mock`).
  {
    files: ['**/*.test.{ts,tsx}', 'src/test/**/*.{ts,tsx}'],
    rules: { 'no-restricted-imports': 'off' },
  },
]

export default defineConfig([
  globalIgnores([
    'dist',
    'dev-dist',
    'coverage',
    'docs',
    'supabase',
    'src/app/routeTree.gen.ts',
    'src/lib/supabase/database.types.ts',
  ]),
  {
    files: ['**/*.js'],
    extends: [js.configs.recommended],
    languageOptions: { globals: globals.node },
  },
  // Lo que se sirve tal cual al navegador (el tema antes de pintar, 5.6).
  {
    files: ['public/**/*.js'],
    languageOptions: { globals: globals.browser },
  },
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.strictTypeChecked,
      tseslint.configs.stylisticTypeChecked,
      reactHooks.configs.flat['recommended-latest'],
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/consistent-type-imports': ['error', { fixStyle: 'inline-type-imports' }],
      '@typescript-eslint/restrict-template-expressions': ['error', { allowNumber: true }],
      // TanStack Router redirige lanzando `redirect()`, que es un `Response` y no un `Error`.
      '@typescript-eslint/only-throw-error': [
        'error',
        { allow: [{ from: 'package', package: '@tanstack/router-core', name: 'Redirect' }] },
      ],
    },
  },
  {
    // Las rutas file-based exportan `Route` con el componente declarado en el mismo archivo.
    // El plugin de TanStack Router (autoCodeSplitting) separa el componente y gestiona su HMR.
    files: ['src/routes/**/*.tsx'],
    rules: {
      'react-refresh/only-export-components': 'off',
    },
  },
  {
    // Código generado por shadcn: exporta variantes (cva) junto a los componentes.
    files: ['src/components/ui/**/*.tsx'],
    rules: {
      'react-refresh/only-export-components': 'off',
    },
  },
  ...boundaries,
  prettier,
])
