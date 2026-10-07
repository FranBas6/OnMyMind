import { useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'

import { subscribeToLiveChanges } from '../api'
import { createLiveSync, liveChangeSchema, sessionIdOf, type LiveViewer } from '../live'

/** Más tiempo que esto en segundo plano y, al volver, se vuelve a pedir lo que se ve. */
const AWAY_MS = 5_000

/**
 * En directo (3.4): un canal por persona mientras hay sesión. Cada cambio de tus listas vuelve a
 * pedir lo que toca (`createLiveSync`, con la guarda de la cola de la 2.10).
 *
 * Realtime no guarda lo que pasó mientras no escuchabas, así que se vuelve a pedir lo visible al
 * reconectar el canal (tras quedarte sin red) y al volver de segundo plano: en el iPhone, una PWA
 * en segundo plano se congela y el canal puede seguir pareciendo vivo un rato al volver.
 */
export function useLiveLists(session: { userId: string; accessToken: string } | undefined) {
  const queryClient = useQueryClient()
  const userId = session?.userId
  // La sesión no cambia al renovar el token: el canal sigue, y realtime-js le pasa el token nuevo.
  const sessionId = session ? sessionIdOf(session.accessToken) : null

  useEffect(() => {
    if (!userId) return
    const viewer: LiveViewer = { userId, sessionId }
    const sync = createLiveSync(queryClient, viewer)
    let joined = false
    const unsubscribe = subscribeToLiveChanges(userId, {
      onChange: (payload) => {
        const change = liveChangeSchema.safeParse(payload)
        if (change.success) sync.receive(change.data)
      },
      onJoin: () => {
        if (joined) sync.catchUp()
        joined = true
      },
    })

    let hiddenAt: number | undefined
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        hiddenAt = Date.now()
      } else if (hiddenAt !== undefined && Date.now() - hiddenAt >= AWAY_MS) {
        hiddenAt = undefined
        sync.catchUp()
      }
    }
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      unsubscribe()
      sync.dispose()
    }
  }, [queryClient, userId, sessionId])
}
