import type { Session } from '@supabase/supabase-js'
import type { QueryClient } from '@tanstack/react-query'
import { createMemoryHistory, RouterProvider } from '@tanstack/react-router'
import { render } from '@testing-library/react'

import { createQueryClient } from '@/app/query-client'
import { createAppRouter } from '@/app/router'
import { parseSettings, type Profile } from '@/features/profile'
import { queryKeys } from '@/lib/queryKeys'

interface RenderRouteOptions {
  /** Sesión que verán las guardas de ruta; por defecto, sin sesión. */
  session?: Session | null
  /**
   * Siembra la caché de TanStack Query antes de renderizar (`queryClient.setQueryData`). Un dato
   * sembrado está fresco durante el `staleTime`, así que loaders y hooks lo usan sin llamar a
   * Supabase. Con sesión, ya lleva un perfil por defecto (`testProfile`), que se puede pisar.
   */
  seed?: (queryClient: QueryClient) => void
  /** Para simular que la sesión cambia (cerrar sesión): por defecto, siempre `session`. */
  getSession?: () => Promise<Session | null>
}

/** Renderiza la app completa (root + providers + layouts) en la ruta indicada. */
export function renderRoute(
  path: string,
  { session = null, seed, getSession }: RenderRouteOptions = {},
) {
  const queryClient = createQueryClient()
  if (session) queryClient.setQueryData(queryKeys.profile(), testProfile(session.user.id))
  seed?.(queryClient)
  const history = createMemoryHistory({ initialEntries: [path] })
  const router = createAppRouter({
    queryClient,
    getSession: getSession ?? (() => Promise.resolve(session)),
    history,
  })

  return { router, ...render(<RouterProvider router={router} />) }
}

/** Perfil de los tests: «fran», sin ajustes guardados salvo el tema (así `ThemeSync` no escribe). */
export function testProfile(userId: string, overrides: Partial<Profile> = {}): Profile {
  return {
    id: userId,
    displayName: 'fran',
    avatarUrl: null,
    settings: parseSettings({}),
    themeStored: true,
    ...overrides,
  }
}

/** Sesión mínima válida para los tests de rutas privadas. */
export function fakeSession(userId = '00000000-0000-0000-0000-000000000001'): Session {
  return {
    access_token: 'test-access-token',
    refresh_token: 'test-refresh-token',
    expires_in: 3600,
    token_type: 'bearer',
    user: {
      id: userId,
      email: 'fran@ejemplo.com',
      aud: 'authenticated',
      app_metadata: {},
      user_metadata: {},
      created_at: '2026-01-01T00:00:00Z',
    },
  }
}
