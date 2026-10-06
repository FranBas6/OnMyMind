import { QueryClient } from '@tanstack/react-query'

import { itemMutations } from '@/features/items'
import { listMutations } from '@/features/lists'
import { profileMutations } from '@/features/profile'
import { reminderMutations } from '@/features/reminders'

/**
 * Las mutaciones que se pueden enviar después de cerrar la app (2.10): su función queda registrada
 * con `setMutationDefaults` antes de restaurar la cola guardada, que es cuando se buscan.
 */
const DURABLE_MUTATIONS = [
  ...itemMutations,
  ...reminderMutations,
  ...listMutations,
  ...profileMutations,
]

export function createQueryClient() {
  const queryClient: QueryClient = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        retry: 1,
        // PWA: sirve primero la caché y no bloquea las queries cuando no hay red.
        networkMode: 'offlineFirst',
        // Con cambios por enviar no se vuelve a pedir lo que ya está en pantalla: la respuesta aún
        // no los tendría y lo optimista parpadearía (al abrir la app con la cola guardada, sobre
        // todo). Cuando terminan, cada mutación pide lo suyo. Lo que no está en caché se pide igual.
        refetchOnMount: () => queryClient.isMutating() === 0,
        refetchOnWindowFocus: () => queryClient.isMutating() === 0,
      },
      mutations: {
        networkMode: 'offlineFirst',
      },
    },
  })
  for (const mutation of DURABLE_MUTATIONS) mutation.register(queryClient)
  return queryClient
}
