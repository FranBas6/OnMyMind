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
    today: () => ['items', { today: true }] as const,
    detail: (itemId: string) => ['items', itemId] as const,
  },
  prices: (itemId: string) => ['prices', itemId] as const,
  profile: () => ['profile'] as const,
}
