import { queryOptions } from '@tanstack/react-query'

import { queryKeys } from '@/lib/queryKeys'

import { fetchItems, fetchMovedFromInbox } from './api'

/** Ítems de una lista. La usan `useItems` y el `loader` del detalle, con la misma entrada de caché. */
export function itemsQueryOptions(listId: string) {
  return queryOptions({
    queryKey: queryKeys.items.byList(listId),
    queryFn: () => fetchItems(listId),
  })
}

/** Lo movido desde una inbox, para su «Fuera de la cabeza». */
export function movedFromInboxQueryOptions(inboxId: string) {
  return queryOptions({
    queryKey: queryKeys.items.movedFrom(inboxId),
    queryFn: () => fetchMovedFromInbox(inboxId),
  })
}
