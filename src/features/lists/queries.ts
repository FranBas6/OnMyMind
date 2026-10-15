import { queryOptions } from '@tanstack/react-query'

import { queryKeys } from '@/lib/queryKeys'

import {
  fetchArchivedLists,
  fetchHiddenListIds,
  fetchHiddenLists,
  fetchLists,
  fetchRecentCaptures,
} from './api'

/**
 * Consulta de las listas: clave + función en un solo objeto. La usan `useLists` (componentes)
 * y el `loader` de Inicio (router), así que los dos leen y escriben la misma entrada de caché.
 */
export const listsQueryOptions = queryOptions({
  queryKey: queryKeys.lists.all,
  queryFn: fetchLists,
})

/** Listas archivadas (sección colapsada al final de Inicio). */
export const archivedListsQueryOptions = queryOptions({
  queryKey: queryKeys.lists.archived,
  queryFn: fetchArchivedLists,
})

/**
 * Tus listas ocultas (5.8): solo en memoria (`meta.private`), como lo desbloqueado. Las pide
 * `useHiddenLists`, y solo desbloqueado.
 */
export const hiddenListsQueryOptions = queryOptions({
  queryKey: queryKeys.lists.hidden,
  queryFn: fetchHiddenLists,
  meta: { private: true },
})

/**
 * Cuáles están ocultas, solo los ids: se guardan con la caché, para saber sin red que una lista
 * pide desbloquear y qué no guardar en el aparato.
 */
export const hiddenListIdsQueryOptions = queryOptions({
  queryKey: queryKeys.lists.hiddenIds,
  queryFn: fetchHiddenListIds,
})

/** Las tres últimas capturas de «En mente», que su tarjeta enseña en escritorio. */
export const INBOX_PREVIEW_SIZE = 3

export function recentCapturesQueryOptions(listId: string) {
  return queryOptions({
    queryKey: queryKeys.items.latest(listId, INBOX_PREVIEW_SIZE),
    queryFn: () => fetchRecentCaptures(listId, INBOX_PREVIEW_SIZE),
  })
}
