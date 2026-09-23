import { createMemoryHistory, RouterProvider } from '@tanstack/react-router'
import { render } from '@testing-library/react'

import { createQueryClient } from '@/app/query-client'
import { createAppRouter } from '@/app/router'

/** Renderiza la app completa (root + providers + AppShell) en la ruta indicada. */
export function renderRoute(path: string) {
  const queryClient = createQueryClient()
  const history = createMemoryHistory({ initialEntries: [path] })
  const router = createAppRouter({ queryClient, history })

  return { router, ...render(<RouterProvider router={router} />) }
}
