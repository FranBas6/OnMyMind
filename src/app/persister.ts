import type { QueryClient } from '@tanstack/react-query'
import {
  persistQueryClient,
  type PersistedClient,
  type Persister,
} from '@tanstack/react-query-persist-client'
import { del, get, set } from 'idb-keyval'

/** Cuánto vale la caché guardada: una semana sin abrir la app y se vuelve a pedir todo. */
export const PERSIST_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000

/**
 * Versión de la forma de los datos guardados. Se sube a mano cuando cambie lo que se guarda en
 * caché (un campo nuevo en `Item`, otra clave): la caché anterior se descarta en vez de leerse
 * mal. No es la versión de la app, para no perder lo guardado en cada despliegue.
 */
export const CACHE_BUSTER = 'datos-1'

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
  // caché al cerrar sesión: que no sobreviva en el dispositivo).
  window.addEventListener('pagehide', flush)
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
 * Restaura la caché guardada (antes de pintar, para que los loaders del router la encuentren) y
 * se suscribe para guardar los cambios. Solo se guardan consultas terminadas con éxito; las
 * mutaciones en pausa no, porque al volver no sabrían qué función ejecutar (su cola persistida es
 * de la fase 2, ADR-005).
 */
export async function restoreQueryCache(queryClient: QueryClient): Promise<void> {
  const [, restored] = persistQueryClient({
    queryClient,
    persister: createIdbPersister(),
    maxAge: PERSIST_MAX_AGE_MS,
    buster: CACHE_BUSTER,
    dehydrateOptions: { shouldDehydrateMutation: () => false },
  })
  // Si IndexedDB no está (navegación privada) o falla, la app arranca igual, sin caché.
  await restored.catch(() => undefined)
}
