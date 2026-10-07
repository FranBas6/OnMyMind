import type { QueryClient, QueryKey } from '@tanstack/react-query'
import { z } from 'zod'

import { queryKeys } from '@/lib/queryKeys'

import { markArrived, markCompleted } from './liveRows'

/**
 * En directo (3.4, migración `live_lists`): cada cambio en una lista llega por Realtime al canal
 * privado de quienes la ven. El mensaje dice qué lista cambió y quién lo hizo (`by`, y desde qué
 * sesión, `session`), no cómo: la app vuelve a pedir lo que tenga en pantalla. Con lo que añadió o
 * terminó el otro, además, las filas se notan (diseño 20, M7 y M8).
 */
const ids = z.array(z.string())
const author = { by: z.string().nullable(), session: z.string().nullable().catch(null) }

export const liveChangeSchema = z.discriminatedUnion('kind', [
  /** Ítems: entran, cambian, se mueven, se borran. */
  z.object({
    kind: z.literal('items'),
    list_id: z.string(),
    ...author,
    added: ids,
    completed: ids,
  }),
  /** La lista: nombre, color, archivar, borrar; o tu orden en Inicio. */
  z.object({ kind: z.literal('list'), list_id: z.string(), ...author }),
  /** Alguien entra o sale. */
  z.object({ kind: z.literal('people'), list_id: z.string(), ...author }),
  /** Te quitan, o se borra o se archiva una lista que no es tuya (3.3, M9 y M10). */
  z.object({ kind: z.literal('departure'), list_id: z.string(), ...author, reason: z.string() }),
])
export type LiveChange = z.infer<typeof liveChangeSchema>

/** Lo que hay que volver a pedir con cada cambio. Solo se piden de nuevo las que están en uso. */
export function staleAfter(change: LiveChange): QueryKey[] {
  switch (change.kind) {
    case 'items':
      // Como al terminar una mutación propia (`settle`): las filas de todas las pantallas, los
      // contadores y los avisos (si el otro cambia la fecha, el tuyo se mueve en la base).
      return [['items'], queryKeys.lists.all, queryKeys.reminders]
    case 'list':
      return [queryKeys.lists.all, queryKeys.sharing.shared]
    case 'people':
      // Si quien entra eres tú (otra vez, después de que te quitaran), lo de dentro también: lo
      // último que se pidió, sin estar, volvió vacío.
      return [
        queryKeys.sharing.shared,
        queryKeys.sharing.people(change.list_id),
        queryKeys.lists.all,
        queryKeys.items.byList(change.list_id),
      ]
    case 'departure':
      // Primero el porqué, para que la pantalla lo tenga al ver que la lista ya no está.
      return [
        queryKeys.sharing.departure(change.list_id),
        queryKeys.lists.all,
        queryKeys.sharing.shared,
        ['items'],
      ]
  }
}

/** Lo mismo tras volver de estar sin conexión o en segundo plano: Realtime no guarda lo perdido. */
export const CATCH_UP: readonly QueryKey[] = [
  ['items'],
  queryKeys.lists.all,
  queryKeys.sharing.shared,
  queryKeys.reminders,
]

/**
 * Lo tuyo también llega (puedes tener la lista abierta en otro dispositivo). En el que lo hizo ya
 * está: sus mutaciones lo pidieron al terminar. Se reconoce por la sesión (una por dispositivo) y
 * porque aquí hubo una mutación hace nada o sigue en vuelo; otra pestaña del mismo navegador
 * comparte sesión, pero no ha cambiado nada.
 */
const OWN_ECHO_MS = 5_000

/** La sesión de un token de Supabase (`session_id`, una por dispositivo en que entraste). */
export function sessionIdOf(accessToken: string): string | null {
  try {
    const part = accessToken.split('.')[1] ?? ''
    const json = atob(part.replace(/-/g, '+').replace(/_/g, '/'))
    const claims = z.object({ session_id: z.string() }).safeParse(JSON.parse(json))
    return claims.success ? claims.data.session_id : null
  } catch {
    return null
  }
}

/** Quién eres aquí: la persona y la sesión de este dispositivo. */
export interface LiveViewer {
  userId: string
  sessionId: string | null
}

/**
 * Recibe los cambios y vuelve a pedir lo que toca, con la guarda de la 2.10: mientras haya cambios
 * propios por enviar no se pide nada (la respuesta aún no los tendría y lo optimista parpadearía).
 * Lo que llega entretanto se junta y se pide cuando termina la última mutación.
 */
export function createLiveSync(
  queryClient: QueryClient,
  { userId: me, sessionId }: LiveViewer,
  { now = () => Date.now(), delayMs = 150 }: { now?: () => number; delayMs?: number } = {},
) {
  const waiting = new Map<string, QueryKey>()
  let lastOwnMutation = Number.NEGATIVE_INFINITY
  let timer: ReturnType<typeof setTimeout> | undefined

  const flush = () => {
    timer = undefined
    if (queryClient.isMutating() > 0) return
    const keys = [...waiting.values()]
    waiting.clear()
    for (const queryKey of keys) void queryClient.invalidateQueries({ queryKey })
  }

  // Varios mensajes seguidos (un reordenar, el mensaje de la lista y el de los ítems) son una
  // sola petición por consulta.
  const schedule = (keys: readonly QueryKey[]) => {
    for (const queryKey of keys) waiting.set(JSON.stringify(queryKey), queryKey)
    timer ??= setTimeout(flush, delayMs)
  }

  const unsubscribe = queryClient.getMutationCache().subscribe((event) => {
    if (event.type !== 'updated') return
    lastOwnMutation = now()
    // Termina la última: lo que se juntó mientras, ahora.
    if (waiting.size > 0 && queryClient.isMutating() === 0) timer ??= setTimeout(flush, delayMs)
  })

  return {
    receive(change: LiveChange) {
      const mine = change.by === me
      // Lo que hizo otra persona se nota en su fila; lo de la base (precios), no.
      if (change.kind === 'items' && change.by !== null && !mine) {
        markArrived(change.added)
        markCompleted(change.completed)
      }
      const here = mine && sessionId !== null && change.session === sessionId
      const ownEcho =
        here && (queryClient.isMutating() > 0 || now() - lastOwnMutation < OWN_ECHO_MS)
      if (ownEcho && change.kind !== 'departure') return
      schedule(staleAfter(change))
    },
    /** El canal vuelve a estar conectado después de haberlo estado: lo perdido, de nuevo. */
    catchUp() {
      schedule(CATCH_UP)
    },
    dispose() {
      unsubscribe()
      clearTimeout(timer)
    },
  }
}
