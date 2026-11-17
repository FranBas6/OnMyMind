import { useQuery, useQueryClient, type QueryKey } from '@tanstack/react-query'

import { sublistsQueryOptions } from '../queries'
import type { Item } from '../types'

/** `['items', { listId }]`: los ítems de una lista (no sus variantes, como `latest`). */
function listIdOf(queryKey: QueryKey): string | undefined {
  const [, filter] = queryKey
  if (typeof filter !== 'object' || filter === null) return undefined
  if (!('listId' in filter) || Object.keys(filter).length !== 1) return undefined
  return typeof filter.listId === 'string' ? filter.listId : undefined
}

/**
 * Las sublistas como destino (captura y «Mover a…»). De cada lista que ya está en caché se toman
 * de ahí, que incluye lo optimista (una sublista recién creada sin red, una renombrada, una
 * borrada); del resto, de la consulta de todas las sublistas.
 */
export function useSublists(): Item[] {
  const query = useQuery(sublistsQueryOptions)
  const queryClient = useQueryClient()
  const cached = queryClient
    .getQueriesData<Item[]>({ queryKey: ['items'] })
    .flatMap(([key, items]) => {
      const listId = listIdOf(key)
      return listId && items ? [{ listId, items }] : []
    })
  const covered = new Set(cached.map((entry) => entry.listId))
  return [
    ...(query.data ?? []).filter((sublist) => !covered.has(sublist.listId)),
    ...cached.flatMap(({ items }) => items.filter((item) => item.kind === 'sublist')),
  ]
}
