import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect } from 'react'

import { authSearchSchema, safeRedirect, useSession } from '@/features/auth'

/**
 * Vuelta de un proveedor externo (Google en 1.16). supabase-js lee los tokens de la URL al
 * arrancar (`detectSessionInUrl`); aquí solo se espera a que avise y se redirige.
 */
export const Route = createFileRoute('/auth/callback')({
  validateSearch: authSearchSchema,
  component: AuthCallbackPage,
})

function AuthCallbackPage() {
  const sessionState = useSession()
  const search = Route.useSearch()
  const navigate = useNavigate()

  useEffect(() => {
    if (sessionState.status === 'authenticated') {
      void navigate({ href: safeRedirect(search.redirect), replace: true })
    } else if (sessionState.status === 'anonymous') {
      void navigate({ to: '/login', replace: true })
    }
  }, [sessionState.status, search.redirect, navigate])

  return (
    <div className="grid min-h-dvh place-items-center bg-background text-muted-foreground">
      <p>Un momento…</p>
    </div>
  )
}
