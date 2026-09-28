/**
 * Claves de TanStack Query (documento 04 §Estado y datos). Todas salen de aquí para que
 * leer, invalidar y actualizar la caché use siempre la misma forma de clave.
 *
 * Son jerárquicas: `invalidateQueries({ queryKey: queryKeys.lists.all })` invalida también
 * `queryKeys.lists.detail(id)`, porque la clave de detalle empieza por `['lists']`.
 */
export const queryKeys = {
  lists: {
    all: ['lists'] as const,
    /** Archivadas: cuelga de `['lists']`, así que invalidar `all` también las refresca. */
    archived: ['lists', 'archived'] as const,
    detail: (listId: string) => ['lists', listId] as const,
  },
  items: {
    byList: (listId: string) => ['items', { listId }] as const,
    /** Últimas capturas pendientes de una lista (la tarjeta de «En mente» en escritorio). */
    latest: (listId: string, limit: number) => ['items', { listId, latest: limit }] as const,
    /**
     * Hoy, con el día en la clave (`2026-09-28`): a medianoche es otra consulta y no se reutiliza
     * la de ayer. `todayAll` las abarca todas, para que las mutaciones de ítems las actualicen.
     */
    todayAll: ['items', 'today'] as const,
    today: (day: string) => ['items', 'today', day] as const,
    /** Lo que salió de una inbox y sigue en otra lista («Fuera de la cabeza» de «En mente»). */
    movedFrom: (inboxId: string) => ['items', { movedFrom: inboxId }] as const,
    detail: (itemId: string) => ['items', itemId] as const,
  },
  prices: (itemId: string) => ['prices', itemId] as const,
  profile: () => ['profile'] as const,
}
