import { createFileRoute } from '@tanstack/react-router'

import { Button } from '@/components/ui/button'
import { useDisplayName, useSignOut } from '@/features/auth'

export const Route = createFileRoute('/_authenticated/')({
  component: HomePage,
})

/** Provisional (1.2): saludo y cerrar sesión. Inicio con listas reales llega en 1.5. */
function HomePage() {
  const { session } = Route.useRouteContext()
  const displayName = useDisplayName(session.user.id)
  const signOut = useSignOut()

  return (
    <section className="space-y-6 pt-8">
      <h1 className="text-[32px]">Hola, {displayName.data ?? '…'}</h1>
      <Button
        variant="outline"
        disabled={signOut.isPending}
        onClick={() => {
          signOut.mutate()
        }}
      >
        Cerrar sesión
      </Button>
    </section>
  )
}
