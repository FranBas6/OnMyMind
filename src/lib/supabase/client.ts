import { createClient } from '@supabase/supabase-js'

import type { Database } from './database.types'

type SupabaseEnvVar = 'VITE_SUPABASE_URL' | 'VITE_SUPABASE_ANON_KEY'

function requireEnv(name: SupabaseEnvVar): string {
  const value = import.meta.env[name]
  if (!value) {
    throw new Error(
      `[supabase] Falta la variable de entorno ${name}. ` +
        'Copia .env.example a .env.local y rellénala ' +
        '(en local, `pnpm exec supabase status` muestra la API URL y la anon key).',
    )
  }
  return value
}

/** Cliente único de Supabase, tipado con el esquema generado en database.types.ts. */
export const supabase = createClient<Database>(
  requireEnv('VITE_SUPABASE_URL'),
  requireEnv('VITE_SUPABASE_ANON_KEY'),
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  },
)
