import { queryOptions } from '@tanstack/react-query'

import { queryKeys } from '@/lib/queryKeys'

import { fetchAllItems } from './api'

/**
 * Todos los ítems, con `staleTime` de un minuto: se busca muchas veces seguidas sobre lo mismo, y
 * lo que cambia en este dispositivo ya lo escriben las mutaciones de ítems en esta caché.
 */
export const allItemsQueryOptions = queryOptions({
  queryKey: queryKeys.items.all,
  queryFn: fetchAllItems,
  staleTime: 60_000,
})
