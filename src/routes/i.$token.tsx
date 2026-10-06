import { createFileRoute, redirect } from '@tanstack/react-router'

import { InviteScreen } from '@/features/sharing'

/**
 * El enlace de invitación a una lista (3.2, diseño 20): `/i/k7Q2xpA9zL3m`. Sin sesión, al acceso
 * con el rótulo de quién invita (J1), que al entrar vuelve aquí; con sesión, la invitación.
 */
export const Route = createFileRoute('/i/$token')({
  beforeLoad: async ({ context, location }) => {
    if (!(await context.getSession())) {
      throw redirect({ to: '/login', search: { redirect: location.href } })
    }
  },
  component: InvitePage,
})

function InvitePage() {
  const { token } = Route.useParams()
  return <InviteScreen token={token} />
}
