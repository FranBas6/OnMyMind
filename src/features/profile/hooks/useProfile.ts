import { useQuery } from '@tanstack/react-query'
import { useRouteContext } from '@tanstack/react-router'

import { profileQueryOptions } from '../queries'

/** Quién tiene la sesión: sale del contexto de las rutas privadas (`_authenticated`). */
export function useCurrentUser() {
  return useRouteContext({ from: '/_authenticated', select: (context) => context.session.user })
}

/** Tu perfil y tu email (el email es de la cuenta de Supabase, no del perfil). */
export function useProfile() {
  const user = useCurrentUser()
  const profile = useQuery(profileQueryOptions(user.id))
  return { ...profile, email: user.email }
}
