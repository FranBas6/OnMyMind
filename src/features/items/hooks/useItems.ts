import { useQuery } from '@tanstack/react-query'

import { itemsQueryOptions } from '../queries'

/** Ítems de una lista, desde la caché que precarga el `loader` del detalle. */
export function useItems(listId: string) {
  return useQuery(itemsQueryOptions(listId))
}
