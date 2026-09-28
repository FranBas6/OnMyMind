import { onlineManager, type Mutation, type QueryClient } from '@tanstack/react-query'

/** Lo que se espera como mucho a que salga lo pendiente antes de cerrar sesión. */
const FLUSH_TIMEOUT_MS = 8000

/** La clave de la mutación de cerrar sesión: no es un cambio por enviar, es quien espera. */
export const SIGN_OUT_MUTATION_KEY = ['auth', 'signOut'] as const

const isSignOut = (mutation: Mutation) =>
  mutation.options.mutationKey?.[1] === SIGN_OUT_MUTATION_KEY[1]

/**
 * Cuántos cambios hay sin enviar: en vuelo o en pausa esperando la red. No cuenta el propio
 * cerrar sesión, que está en vuelo mientras espera a los demás.
 */
export function pendingMutations(queryClient: QueryClient): number {
  return queryClient
    .getMutationCache()
    .findAll({ status: 'pending', predicate: (mutation) => !isSignOut(mutation) }).length
}

/**
 * Envía lo pendiente y espera a que termine (con un tope), para no perder cambios al cerrar
 * sesión: la caché de mutaciones se vacía al salir. Sin red no se puede enviar nada: no espera.
 */
export async function flushMutations(queryClient: QueryClient): Promise<void> {
  if (!onlineManager.isOnline() || pendingMutations(queryClient) === 0) return
  void queryClient.resumePausedMutations()
  await new Promise<void>((resolve) => {
    const timeout = window.setTimeout(done, FLUSH_TIMEOUT_MS)
    const unsubscribe = queryClient.getMutationCache().subscribe(() => {
      if (pendingMutations(queryClient) === 0) done()
    })
    function done() {
      window.clearTimeout(timeout)
      unsubscribe()
      resolve()
    }
  })
}
