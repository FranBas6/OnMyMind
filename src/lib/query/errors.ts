/** Mensajes genéricos de error para la interfaz, en la voz de la marca y sin jerga técnica. */
export const OFFLINE_MESSAGE = 'No hay conexión. Prueba otra vez cuando vuelva.'
export const FALLBACK_MESSAGE = 'Algo ha fallado. Prueba otra vez.'

/**
 * `true` si el error es de red. supabase-js no lanza al fallar la conexión: devuelve un error cuyo
 * mensaje contiene el `TypeError: Failed to fetch` (o `Load failed` en Safari) del navegador.
 */
export function isNetworkError(error: unknown): boolean {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return true
  const message = error instanceof Error ? error.message : readMessage(error)
  return /failed to fetch|load failed|networkerror|network request failed/i.test(message)
}

/** Frase para la interfaz a partir de cualquier error de datos. */
export function errorMessage(error: unknown): string {
  return isNetworkError(error) ? OFFLINE_MESSAGE : FALLBACK_MESSAGE
}

function readMessage(error: unknown): string {
  if (typeof error === 'object' && error !== null && 'message' in error) {
    const { message } = error
    if (typeof message === 'string') return message
  }
  return ''
}
