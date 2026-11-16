import { onlineManager } from '@tanstack/react-query'

import { SUPABASE_ANON_KEY, SUPABASE_URL } from '@/lib/supabase/client'

/** Cada cuánto se vuelve a mirar mientras la app cree que no hay red y se está viendo. */
export const PROBE_INTERVAL_MS = 20_000
/** Lo que se espera al servidor antes de dar la red por caída. */
const PROBE_TIMEOUT_MS = 5_000

/**
 * Si el servidor contesta: la salud de Auth de Supabase, que es pequeña y no necesita sesión. Sin
 * respuesta (o con error) en 5 s, no hay red que sirva.
 */
export async function canReachServer(): Promise<boolean> {
  try {
    const response = await fetch(`${SUPABASE_URL}/auth/v1/health`, {
      headers: { apikey: SUPABASE_ANON_KEY },
      cache: 'no-store',
      signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
    })
    return response.ok
  } catch {
    return false
  }
}

/**
 * Que «Sin conexión» no se quede puesto con red (bug del 2026-10-28, `docs/plans/bugs.md`).
 * TanStack Query solo escucha los eventos `online` y `offline` del navegador: si llega un `offline`
 * (al despertar el portátil, al cambiar de wifi, con una VPN) y nunca el `online` de vuelta, o si
 * `navigator.onLine` se queda en `false` con red (pasa en Chrome del Mac), la app se queda sin red
 * para siempre: con el aviso puesto, sin pedir nada y con los cambios en la cola.
 *
 * Así que cuando el navegador dice que no hay red, se le pregunta al servidor: al volver a la app
 * (verla, enfocarla), con cada evento de red y, mientras siga sin red y se esté viendo, cada 20 s.
 * Si contesta, hay red. Cuando el navegador dice que sí, se le cree, como hasta ahora. Devuelve
 * cómo pararlo.
 */
export function watchConnectivity(
  probe: () => Promise<boolean> = canReachServer,
  { interval = PROBE_INTERVAL_MS }: { interval?: number } = {},
): () => void {
  let checking = false

  const check = async () => {
    if (navigator.onLine) {
      onlineManager.setOnline(true)
      return
    }
    if (checking) return
    checking = true
    try {
      onlineManager.setOnline(await probe())
    } finally {
      checking = false
    }
  }
  const recheck = () => {
    void check()
  }
  const onVisible = () => {
    if (document.visibilityState === 'visible') recheck()
  }

  window.addEventListener('online', recheck)
  window.addEventListener('offline', recheck)
  window.addEventListener('focus', recheck)
  window.addEventListener('pageshow', recheck)
  document.addEventListener('visibilitychange', onVisible)
  const timer = window.setInterval(() => {
    if (!onlineManager.isOnline() && document.visibilityState === 'visible') recheck()
  }, interval)
  recheck()

  return () => {
    window.removeEventListener('online', recheck)
    window.removeEventListener('offline', recheck)
    window.removeEventListener('focus', recheck)
    window.removeEventListener('pageshow', recheck)
    document.removeEventListener('visibilitychange', onVisible)
    window.clearInterval(timer)
  }
}
