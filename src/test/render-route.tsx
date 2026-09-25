import type { Session } from '@supabase/supabase-js'
import type { QueryClient } from '@tanstack/react-query'
import { createMemoryHistory, RouterProvider } from '@tanstack/react-router'
import { render } from '@testing-library/react'

import { createQueryClient } from '@/app/query-client'
import { createAppRouter } from '@/app/router'

interface RenderRouteOptions {
  /** Sesión que verán las guardas de ruta; por defecto, sin sesión. */
  session?: Session | null
  /**
   * Siembra la caché de TanStack Query antes de renderizar (`queryClient.setQueryData`). Un dato
   * sembrado está fresco durante el `staleTime`, así que loaders y hooks lo usan sin llamar a
   * Supabase.
   */
  seed?: (queryClient: QueryClient) => void
}

/** Renderiza la app completa (root + providers + layouts) en la ruta indicada. */
export function renderRoute(path: string, { session = null, seed }: RenderRouteOptions = {}) {
  const queryClient = createQueryClient()
  seed?.(queryClient)
  const history = createMemoryHistory({ initialEntries: [path] })
  const router = createAppRouter({
    queryClient,
    getSession: () => Promise.resolve(session),
    history,
  })

  return { router, ...render(<RouterProvider router={router} />) }
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
      aud: 'authenticated',
      app_metadata: {},
      user_metadata: {},
      created_at: '2026-01-01T00:00:00Z',
    },
  }
}
