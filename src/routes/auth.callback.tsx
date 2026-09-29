import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect } from 'react'

import { callbackSearchSchema, safeRedirect, SigningInScreen, useSession } from '@/features/auth'

/**
 * Vuelta de Google (1.16). supabase-js canjea el `?code=` de la URL al arrancar
 * (`detectSessionInUrl` con PKCE) y solo después avisa a `useSession`: aquí se espera a ese aviso.
 * Con sesión, a donde ibas; sin ella, al acceso con el error de Google si se volvió con `?error=`
 * o con un código que no se pudo canjear (por ejemplo, sin el verificador de este navegador).
 */
export const Route = createFileRoute('/auth/callback')({
  validateSearch: callbackSearchSchema,
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
      const failed = search.error !== undefined || search.code !== undefined
      void navigate({
        to: '/login',
        search: {
          redirect: search.redirect,
          mode: search.mode,
          error: failed ? 'google' : undefined,
        },
        replace: true,
      })
    }
  }, [sessionState.status, search, navigate])

  return <SigningInScreen />
}
