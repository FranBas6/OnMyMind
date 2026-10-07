import { createFileRoute, Outlet, redirect, useRouter } from '@tanstack/react-router'
import { useEffect } from 'react'

import { InstallHint } from '@/components/InstallHint'
import { AppShell } from '@/components/layout/AppShell'
import { useSession } from '@/features/auth'
import { CaptureProvider } from '@/features/capture'
import { cleanupPhotosDaily } from '@/features/items'
import { ListActionsProvider } from '@/features/lists'
import { ThemeSync } from '@/features/profile'
import { useLiveLists } from '@/features/sharing'

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

  // Una vez al día, las fotos que ya no usa nadie (2.8); no pinta nada, así que no es una consulta.
  useEffect(() => {
    if (sessionState.status === 'authenticated') cleanupPhotosDaily()
  }, [sessionState.status])

  // En directo (3.4): lo que hace otra persona en tus listas llega sin recargar.
  useLiveLists(
    sessionState.status === 'authenticated'
      ? { userId: sessionState.session.user.id, accessToken: sessionState.session.access_token }
      : undefined,
  )

  return (
    <ListActionsProvider>
      {/* El tema viaja con la cuenta: se aplica al llegar el perfil (08 B.14). */}
      <ThemeSync />
      {/* En Safari del iPhone, la primera vez: cómo instalarla (diseño 10). */}
      <InstallHint />
      <CaptureProvider>
        <AppShell>
          <Outlet />
        </AppShell>
      </CaptureProvider>
    </ListActionsProvider>
  )
}
