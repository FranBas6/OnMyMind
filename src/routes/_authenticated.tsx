import { createFileRoute, Outlet, redirect, useRouter } from '@tanstack/react-router'
import { useEffect } from 'react'

import { AppShell } from '@/components/layout/AppShell'
import { useSession } from '@/features/auth'
import { CaptureProvider } from '@/features/capture'
import { ListActionsProvider } from '@/features/lists'

/**
 * Layout de todas las rutas privadas (el `_` hace que no añada segmento a la URL).
 * `beforeLoad` se ejecuta antes de pintar cualquier hija: sin sesión, redirige a `/login`
 * recordando a dónde ibas; con sesión, la pasa al contexto de las hijas.
 */
export const Route = createFileRoute('/_authenticated')({
  beforeLoad: async ({ context, location }) => {
    const session = await context.getSession()
    if (!session) {
      throw redirect({ to: '/login', search: { redirect: location.href } })
    }
    return { session }
  },
  component: AuthenticatedLayout,
})

function AuthenticatedLayout() {
  const sessionState = useSession()
  const router = useRouter()

  // `beforeLoad` solo corre al navegar. Si la sesión termina con la pantalla abierta (salir en
  // otra pestaña, refresh token caducado), se vuelve a evaluar la guarda y te lleva a `/login`.
  useEffect(() => {
    if (sessionState.status === 'anonymous') void router.invalidate()
  }, [sessionState.status, router])

  return (
    <ListActionsProvider>
      <CaptureProvider>
        <AppShell>
          <Outlet />
        </AppShell>
      </CaptureProvider>
    </ListActionsProvider>
  )
}
