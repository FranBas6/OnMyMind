import { queryOptions } from '@tanstack/react-query'

import { queryKeys } from '@/lib/queryKeys'

import { fetchItems, fetchLinkMetadata, fetchMovedFromInbox, fetchSublists } from './api'

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

/** Las sublistas de todas las listas (`useSublists` las junta con lo que ya hay en caché). */
export const sublistsQueryOptions = queryOptions({
  queryKey: queryKeys.items.sublists,
  queryFn: fetchSublists,
})

/**
 * Lo que trae la página de un enlace (`fetch-metadata`), una vez por enlace. La comparten el
 * detalle, cada tienda y la captura (2.3): lo que se miró al pegarlo en la captura ya no se vuelve
 * a pedir al abrir el detalle. Sin red ni lo intenta (la app va en `offlineFirst`): espera en
 * pausa y sale sola al volver la conexión.
 */
export function linkMetadataQueryOptions(url: string) {
  return queryOptions({
    queryKey: queryKeys.linkMetadata(url),
    queryFn: () => fetchLinkMetadata(url),
    networkMode: 'online',
    staleTime: Infinity,
    retry: 1,
  })
}
