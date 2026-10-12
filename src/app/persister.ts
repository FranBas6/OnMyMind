import { onlineManager, type Mutation, type Query, type QueryClient } from '@tanstack/react-query'
import {
  persistQueryClient,
  type PersistedClient,
  type Persister,
} from '@tanstack/react-query-persist-client'
import { del, get, set } from 'idb-keyval'

import { queryKeys } from '@/lib/queryKeys'

/**
 * Cuánto vale la caché guardada: una semana sin abrir la app y se vuelve a pedir todo. La cola de
 * cambios va con ella: lo que lleve una semana sin enviarse se pierde.
 */
export const PERSIST_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000

/**
 * Versión de la forma de los datos guardados. Se sube a mano cuando cambie lo que se guarda en
 * caché (un campo nuevo en `Item`, otra clave) o en la cola de cambios (la clave de una mutación
 * o la forma de sus variables): lo anterior se descarta en vez de leerse mal, y con ello lo que
 * quedara sin enviar. No es la versión de la app, para no perder lo guardado en cada despliegue.
 */
// `datos-2` (5.6): las listas ganaron `view` y contadores por tipo (5.3) y los ítems `chooseOne` y
// `chosenId` (5.1); con lo guardado antes, la app nueva se rompía al pintar Inicio. `datos-3` (5.7):
// los ítems ganan `sealed` (notas protegidas).
export const CACHE_BUSTER = 'datos-3'

const KEY = 'onmymind-query-cache'
/** Guardar a lo sumo una vez por segundo: la caché cambia a menudo (optimistas, refrescos). */
const THROTTLE_MS = 1000

/**
 * Guarda la caché de TanStack Query en IndexedDB tal cual, sin pasar por JSON: IndexedDB copia los
 * objetos con *structured clone*, así que las fechas (`dueAt`, `createdAt`…) vuelven como `Date`.
 * Con JSON volverían como texto y romperían lo que las compara.
 */
export function createIdbPersister(): Persister {
  let pending: PersistedClient | undefined
  let timer: number | undefined
  const flush = () => {
    window.clearTimeout(timer)
    timer = undefined
    if (pending) void set(KEY, pending)
    pending = undefined
  }
  // Al cerrar o esconder la app, lo que quede pendiente se guarda ya (también el vaciado de la
  // caché al cerrar sesión: que no sobreviva en el dispositivo). En el iPhone, al pasar al
  // selector de apps llega `visibilitychange`, y al cerrarla desde ahí puede no llegar nada más.
  window.addEventListener('pagehide', flush)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flush()
  })
  return {
    persistClient: (client) => {
      pending = client
      if (timer !== undefined) return
      timer = window.setTimeout(flush, THROTTLE_MS)
    },
    restoreClient: () => get<PersistedClient>(KEY),
    removeClient: () => del(KEY),
  }
}

/**
 * Si una mutación se guarda con la caché: la que espera la red (o su turno en la fila) y se sabe
 * repetir al volver, porque su clave tiene una función registrada con `setMutationDefaults`. Una
 * en vuelo no: puede que ya haya llegado, y repetirla duplicaría un alta.
 */
export function isReplayable(queryClient: QueryClient, mutation: Mutation): boolean {
  const key = mutation.options.mutationKey
  return (
    mutation.state.isPaused &&
    key !== undefined &&
    queryClient.getMutationDefaults(key).mutationFn !== undefined
  )
}

/**
 * Si una consulta se guarda con la caché: las terminadas con éxito, menos las que llevan
 * `meta: { private: true }`, que es lo desbloqueado (5.6, ADR-013): eso vive solo en memoria.
 */
export function isPersistable(query: Query): boolean {
  return (
    query.state.status === 'success' &&
    query.meta?.private !== true &&
    // El texto descifrado de una nota protegida (5.7), también si se dejó con `setQueryData`, que
    // no lleva `meta`.
    query.queryKey[0] !== queryKeys.openedNotes[0]
  )
}

/**
 * Restaura la caché guardada (antes de pintar, para que los loaders del router la encuentren) y
 * se suscribe para guardar los cambios. Se guardan las consultas terminadas con éxito (sin lo
 * desbloqueado, `isPersistable`) y la cola de
 * cambios sin enviar (2.10, ADR-005). Con red, la cola sale ya, antes que cualquier consulta: la
 * respuesta tiene que traer esos cambios. Sin red, sale sola cuando vuelva (`onlineManager`).
 */
export async function restoreQueryCache(queryClient: QueryClient): Promise<void> {
  const [, restored] = persistQueryClient({
    queryClient,
    persister: createIdbPersister(),
    maxAge: PERSIST_MAX_AGE_MS,
    buster: CACHE_BUSTER,
    dehydrateOptions: {
      shouldDehydrateQuery: isPersistable,
      shouldDehydrateMutation: (mutation) => isReplayable(queryClient, mutation),
    },
  })
  // Si IndexedDB no está (navegación privada) o falla, la app arranca igual, sin caché.
  await restored.catch(() => undefined)
  if (onlineManager.isOnline()) void queryClient.resumePausedMutations()
}
