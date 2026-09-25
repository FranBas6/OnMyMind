import type { Session } from '@supabase/supabase-js'
import { useEffect, useState } from 'react'

import { onAuthStateChange } from '../api'

export type SessionState =
  { status: 'loading' } | { status: 'anonymous' } | { status: 'authenticated'; session: Session }

/**
 * Estado de la sesión para la interfaz. `onAuthStateChange` es la única fuente de verdad:
 * su primer aviso (`INITIAL_SESSION`) saca a la app de `loading`, y los siguientes reflejan
 * entrar, salir o renovar, también si ocurre en otra pestaña.
 */
export function useSession(): SessionState {
  const [state, setState] = useState<SessionState>({ status: 'loading' })

  useEffect(
    () =>
      onAuthStateChange((session) => {
        setState(session ? { status: 'authenticated', session } : { status: 'anonymous' })
      }),
    [],
  )

  return state
}
