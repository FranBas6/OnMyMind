import { useSyncExternalStore } from 'react'

/**
 * Lo desbloqueado (5.6, ADR-013): la clave de la caja, solo en la memoria de esta pestaña. Nunca se
 * guarda (ni en la caché persistida, ni en `localStorage`), así que recargar o cerrar la app
 * bloquea. Además se bloquea sola a los 5 minutos, para todo a la vez, y al salir de la app
 * (diseño 26, «Desbloquear y bloquear»).
 */

/** Cuánto dura desbloqueado (diseño 26). */
export const UNLOCK_MS = 5 * 60_000

export interface Unlocked {
  /** La clave de la caja. */
  key: CryptoKey
  /** Cuál es (`private_vaults.key_id`). */
  keyId: string
  /** Cuándo se bloquea sola. */
  until: number
}

/** Por qué se bloqueó la última vez: «Pasaron 5 minutos» solo si fue eso (diseño 27, D3d). */
export type LockReason = 'timeout' | 'left' | 'manual'

let current: Unlocked | null = null
let lastReason: LockReason = 'manual'
let timer: ReturnType<typeof setTimeout> | undefined
/** Mientras se usa Face ID, salir un momento de la página no bloquea (lo pide el sistema). */
let holds = 0
let watching = false
const listeners = new Set<() => void>()

function emit() {
  for (const listener of listeners) listener()
}

/** Al salir de la app (otra app, el selector, otra pestaña) se bloquea. */
function watchLeaving() {
  if (watching || typeof document === 'undefined') return
  watching = true
  const leave = () => {
    if (holds === 0) lock('left')
  }
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') leave()
  })
  window.addEventListener('pagehide', leave)
}

export function unlock(key: CryptoKey, keyId: string, now: number = Date.now()): void {
  watchLeaving()
  clearTimeout(timer)
  current = { key, keyId, until: now + UNLOCK_MS }
  timer = setTimeout(() => {
    lock('timeout')
  }, UNLOCK_MS)
  emit()
}

export function lock(reason: LockReason = 'manual'): void {
  clearTimeout(timer)
  timer = undefined
  if (current === null) return
  current = null
  lastReason = reason
  emit()
}

/** Por qué se bloqueó la última vez. */
export function lastLockReason(): LockReason {
  return lastReason
}

export function getUnlocked(): Unlocked | null {
  return current
}

export function subscribeUnlocked(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** Lo desbloqueado ahora, o `null`. */
export function useUnlocked(): Unlocked | null {
  return useSyncExternalStore(subscribeUnlocked, getUnlocked, getUnlocked)
}

/** Ejecuta algo que muestra Face ID sin que el aviso del sistema cuente como salir de la app. */
export async function withoutAutoLock<T>(task: () => Promise<T>): Promise<T> {
  holds += 1
  try {
    return await task()
  } finally {
    holds -= 1
  }
}
