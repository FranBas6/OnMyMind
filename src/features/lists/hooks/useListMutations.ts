import { useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import { schedulePhotoCleanup } from '@/features/items/photoCleanup'
import { copyItemPhoto } from '@/features/items/photos'
import { errorMessage } from '@/lib/errors'
import { durableMutation, useDurableMutation, WAITS_FOR_NETWORK } from '@/lib/mutations'
import { withPositions, type Positioned } from '@/lib/reorder'
import { queryKeys } from '@/lib/queryKeys'

import {
  archiveList,
  createList,
  deleteList,
  duplicateList,
  unarchiveList,
  updateList,
  updateListPositions,
} from '../api'
import type { ListFormValues } from '../schemas'
import type { List } from '../types'

/** Foto de las dos cachés de listas, para poder volver atrás si el servidor falla. */
interface ListsSnapshot {
  active: List[] | undefined
  archived: List[] | undefined
}

const byPosition = (a: List, b: List) => a.position - b.position

/**
 * Paso 1 del patrón optimista (`onMutate`): cancela las consultas de listas en vuelo (una
 * respuesta vieja pisaría el cambio), guarda la foto y escribe en la caché lo que esperamos que
 * pase. La pantalla se repinta al instante, antes de que conteste Supabase.
 */
async function applyOptimistic(
  queryClient: QueryClient,
  change: { active?: (lists: List[]) => List[]; archived?: (lists: List[]) => List[] },
): Promise<ListsSnapshot> {
  await queryClient.cancelQueries({ queryKey: queryKeys.lists.all })
  const snapshot: ListsSnapshot = {
    active: queryClient.getQueryData<List[]>(queryKeys.lists.all),
    archived: queryClient.getQueryData<List[]>(queryKeys.lists.archived),
  }
  const { active, archived } = change
  if (active && snapshot.active)
    queryClient.setQueryData(queryKeys.lists.all, active(snapshot.active))
  if (archived && snapshot.archived) {
    queryClient.setQueryData(queryKeys.lists.archived, archived(snapshot.archived))
  }
  return snapshot
}

/** Paso 3 (`onError`): deja la caché como estaba y avisa. */
function rollback(queryClient: QueryClient, snapshot: ListsSnapshot | undefined, message: string) {
  if (snapshot) {
    queryClient.setQueryData(queryKeys.lists.all, snapshot.active)
    queryClient.setQueryData(queryKeys.lists.archived, snapshot.archived)
  }
  toast.error(message)
}

/** Paso 4 (`onSettled`): pase lo que pase, vuelve a pedir las listas para quedarse con la verdad. */
function refetchLists(queryClient: QueryClient) {
  return queryClient.invalidateQueries({ queryKey: queryKeys.lists.all })
}

/**
 * Archivar (optimista): la tarjeta sale de Inicio y del sidebar al instante y entra en la
 * sección de archivadas; si Supabase falla, vuelve a su sitio.
 */
export function useArchiveList() {
  const queryClient = useQueryClient()
  return useMutation({
    // Paso 2: la llamada real.
    mutationFn: (list: List) => archiveList(list.id),
    onMutate: (list) =>
      applyOptimistic(queryClient, {
        active: (lists) => lists.filter((item) => item.id !== list.id),
        archived: (lists) => [list, ...lists],
      }),
    onError: (error, _list, snapshot) => {
      rollback(queryClient, snapshot, `No se ha podido archivar. ${errorMessage(error)}`)
    },
    onSettled: () => refetchLists(queryClient),
  })
}

/** Desarchivar (optimista): vuelve a Inicio en su posición de siempre. */
export function useUnarchiveList() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (list: List) => unarchiveList(list.id),
    onMutate: (list) =>
      applyOptimistic(queryClient, {
        active: (lists) => [...lists, list].sort(byPosition),
        archived: (lists) => lists.filter((item) => item.id !== list.id),
      }),
    onError: (error, _list, snapshot) => {
      rollback(queryClient, snapshot, `No se ha podido desarchivar. ${errorMessage(error)}`)
    },
    onSettled: () => refetchLists(queryClient),
  })
}

/** Borrar (optimista, tras la confirmación): desaparece de donde esté; si falla, vuelve. */
export function useDeleteList() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (list: List) => deleteList(list.id),
    onMutate: (list) =>
      applyOptimistic(queryClient, {
        active: (lists) => lists.filter((item) => item.id !== list.id),
        archived: (lists) => lists.filter((item) => item.id !== list.id),
      }),
    onError: (error, _list, snapshot) => {
      rollback(queryClient, snapshot, `No se ha podido borrar. ${errorMessage(error)}`)
    },
    // Las fotos de sus ítems se quedan sin nadie que las use (2.8).
    onSuccess: () => {
      schedulePhotoCleanup()
    },
    onSettled: () => refetchLists(queryClient),
  })
}

const REORDER_KEY = ['lists', 'order'] as const

/**
 * Ordenar las listas a mano (2.9, diseño 14, I1 y D5): en Inicio y en el sidebar, al momento y
 * también sin red: espera, y se envía al volver aunque la app se cierre antes (2.10). En fila, y la
 * verdad del servidor se pide al terminar la última: si no, una respuesta a medias haría parpadear
 * el orden.
 */
const reorderListsMutation = durableMutation(REORDER_KEY, (queryClient) => ({
  ...WAITS_FOR_NETWORK,
  scope: { id: 'lists-order' },
  mutationFn: (changes: Positioned[]) => updateListPositions(changes),
  onMutate: (changes) =>
    applyOptimistic(queryClient, {
      active: (lists) => withPositions(lists, changes).sort((a, b) => a.position - b.position),
    }),
  onError: (error, _changes, snapshot) => {
    rollback(queryClient, snapshot, `No se ha podido guardar el orden. ${errorMessage(error)}`)
  },
  onSettled: () => {
    if (queryClient.isMutating({ mutationKey: REORDER_KEY }) > 1) return
    return refetchLists(queryClient)
  },
}))

export function useReorderLists() {
  return useDurableMutation(reorderListsMutation)
}

/** Las mutaciones de listas que se registran en el QueryClient (2.10). */
export const listMutations = [reorderListsMutation]

/** Posición para una lista nueva: la mayor de todas (también archivadas) + 1000. */
export function nextListPosition(queryClient: QueryClient): number {
  const all = [
    ...(queryClient.getQueryData<List[]>(queryKeys.lists.all) ?? []),
    ...(queryClient.getQueryData<List[]>(queryKeys.lists.archived) ?? []),
  ]
  return Math.max(0, ...all.map((list) => list.position)) + 1000
}

/**
 * Crear (no optimista, como pide el diseño 04 Listas: el formulario espera en «Creando…» y enseña
 * el error del servidor sin cerrarse). Al confirmar, la lista entra en la caché y se refresca.
 */
export function useCreateList() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (values: ListFormValues) => createList(values, nextListPosition(queryClient)),
    onSuccess: (created) => {
      queryClient.setQueryData<List[]>(queryKeys.lists.all, (lists) =>
        lists ? [...lists, created].sort(byPosition) : lists,
      )
    },
    onSettled: () => refetchLists(queryClient),
  })
}

/** Editar (no optimista, mismo motivo que crear). */
export function useUpdateList() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ list, values }: { list: List; values: ListFormValues }) =>
      updateList(list.id, values),
    onSuccess: (_result, { list, values }) => {
      const patch = (lists: List[] | undefined) =>
        lists?.map((item) =>
          item.id === list.id
            ? { ...item, name: values.name.trim(), color: values.color, kind: values.kind }
            : item,
        )
      queryClient.setQueryData<List[]>(queryKeys.lists.all, patch)
      queryClient.setQueryData<List[]>(queryKeys.lists.archived, patch)
    },
    onSettled: () => refetchLists(queryClient),
  })
}

/**
 * Duplicar una lista (4.4, diseño 23, C). Hace falta conexión: es una sola llamada a la base, que
 * hace la copia entera o nada, así que no se guarda para luego. Después, en segundo plano, se
 * copian las fotos subidas; la que no se pueda copiar deja ese ítem sin foto.
 */
export function useDuplicateList() {
  const queryClient = useQueryClient()
  return useMutation({
    networkMode: 'online',
    mutationFn: ({ list, name }: { list: List; name: string }) => duplicateList(list.id, name),
    onSuccess: (copy) => {
      if (copy.photos.length === 0) return
      void Promise.allSettled(
        copy.photos.map((photo) => copyItemPhoto(photo.itemId, photo.path, photo.position)),
      ).then(() => queryClient.invalidateQueries({ queryKey: queryKeys.items.byList(copy.listId) }))
    },
    onSettled: () => refetchLists(queryClient),
  })
}
