import type { Session } from '@supabase/supabase-js'
import type { QueryClient } from '@tanstack/react-query'
import { createRouter, type RouterHistory } from '@tanstack/react-router'

import { routeTree } from './routeTree.gen'

export interface RouterContext {
  queryClient: QueryClient
  /** Sesión actual o `null`; la usan las guardas en `beforeLoad` (que no pueden usar hooks). */
  getSession: () => Promise<Session | null>
}

interface CreateAppRouterOptions {
  queryClient: QueryClient
  getSession: RouterContext['getSession']
  /** Solo para tests (p. ej. `createMemoryHistory`); en la app se usa el historial del navegador. */
  history?: RouterHistory
}

export function createAppRouter({ queryClient, getSession, history }: CreateAppRouterOptions) {
  return createRouter({
    routeTree,
    context: { queryClient, getSession },
    ...(history ? { history } : {}),
    defaultPreload: 'intent',
    // La caché la gestiona TanStack Query; el router no debe duplicarla.
    defaultPreloadStaleTime: 0,
    scrollRestoration: true,
  })
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof createAppRouter>
  }
}
