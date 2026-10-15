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
  hideList,
  showList,
  unarchiveList,
  updateList,
  updateListPositions,
  updateListView,
} from '../api'
import type { ListFormValues } from '../schemas'
import type { List, ListView } from '../types'

/** Foto de las cachés de listas, para poder volver atrás si el servidor falla. */
interface ListsSnapshot {
  active: List[] | undefined
  archived: List[] | undefined
  /** Las ocultas (5.8), si están desbloqueadas, y cuáles son. */
  hidden: List[] | undefined
  hiddenIds: string[] | undefined
}

/** Lo que cambia una mutación en cada caché de listas. */
interface ListsChange {
  active?: (lists: List[]) => List[]
  archived?: (lists: List[]) => List[]
  hidden?: (lists: List[]) => List[]
  hiddenIds?: (ids: string[]) => string[]
}

const byPosition = (a: List, b: List) => a.position - b.position

/**
 * Paso 1 del patrón optimista (`onMutate`): cancela las consultas de listas en vuelo (una
 * respuesta vieja pisaría el cambio), guarda la foto y escribe en la caché lo que esperamos que
 * pase. La pantalla se repinta al instante, antes de que conteste Supabase.
 */
async function applyOptimistic(
  queryClient: QueryClient,
  change: ListsChange,
): Promise<ListsSnapshot> {
  await queryClient.cancelQueries({ queryKey: queryKeys.lists.all })
  const snapshot: ListsSnapshot = {
    active: queryClient.getQueryData<List[]>(queryKeys.lists.all),
    archived: queryClient.getQueryData<List[]>(queryKeys.lists.archived),
    hidden: queryClient.getQueryData<List[]>(queryKeys.lists.hidden),
    hiddenIds: queryClient.getQueryData<string[]>(queryKeys.lists.hiddenIds),
  }
  const { active, archived, hidden, hiddenIds } = change
  if (active && snapshot.active)
    queryClient.setQueryData(queryKeys.lists.all, active(snapshot.active))
  if (archived && snapshot.archived) {
    queryClient.setQueryData(queryKeys.lists.archived, archived(snapshot.archived))
  }
  if (hidden && snapshot.hidden) {
    queryClient.setQueryData(queryKeys.lists.hidden, hidden(snapshot.hidden))
  }
  if (hiddenIds)
    queryClient.setQueryData(queryKeys.lists.hiddenIds, hiddenIds(snapshot.hiddenIds ?? []))
  return snapshot
}

/** Paso 3 (`onError`): deja la caché como estaba y avisa. */
function rollback(queryClient: QueryClient, snapshot: ListsSnapshot | undefined, message: string) {
  if (snapshot) {
    queryClient.setQueryData(queryKeys.lists.all, snapshot.active)
    queryClient.setQueryData(queryKeys.lists.archived, snapshot.archived)
    if (snapshot.hidden) queryClient.setQueryData(queryKeys.lists.hidden, snapshot.hidden)
    queryClient.setQueryData(queryKeys.lists.hiddenIds, snapshot.hiddenIds)
  }
  toast.error(message)
}

/** Una lista que cambia, en la caché de las ocultas: la misma, con el cambio. */
const patchList = (id: string, patch: (list: List) => List) => (lists: List[]) =>
  lists.map((list) => (list.id === id ? patch(list) : list))

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
      applyOptimistic(
        queryClient,
        // Una oculta se queda en «Listas ocultas», abajo, con las archivadas de allí.
        list.hidden
          ? { hidden: patchList(list.id, (item) => ({ ...item, archivedAt: new Date() })) }
          : {
              active: (lists) => lists.filter((item) => item.id !== list.id),
              archived: (lists) => [list, ...lists],
            },
      ),
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
      applyOptimistic(
        queryClient,
        list.hidden
          ? { hidden: patchList(list.id, (item) => ({ ...item, archivedAt: null })) }
          : {
              active: (lists) => [...lists, { ...list, archivedAt: null }].sort(byPosition),
              archived: (lists) => lists.filter((item) => item.id !== list.id),
            },
      ),
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
        hidden: (lists) => lists.filter((item) => item.id !== list.id),
        hiddenIds: (ids) => ids.filter((id) => id !== list.id),
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
      active: (lists) => withPositions(lists, changes).sort(byPosition),
      // Las ocultas también se ordenan, entre ellas, en su pantalla.
      hidden: (lists) => withPositions(lists, changes).sort(byPosition),
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

const VIEW_KEY = ['lists', 'view'] as const

/**
 * «Lista · Agenda» (5.5, diseño 25, B10 y D5): la lista recuerda cómo se ve. Al momento y también
 * sin red, como el orden: espera y se envía al volver.
 */
const listViewMutation = durableMutation(VIEW_KEY, (queryClient) => ({
  ...WAITS_FOR_NETWORK,
  scope: { id: 'lists-view' },
  mutationFn: ({ listId, view }: { listId: string; view: ListView }) =>
    updateListView(listId, view),
  onMutate: ({ listId, view }) =>
    applyOptimistic(queryClient, {
      active: patchList(listId, (list) => ({ ...list, view })),
      hidden: patchList(listId, (list) => ({ ...list, view })),
    }),
  onError: (error, _change, snapshot) => {
    rollback(queryClient, snapshot, `No se ha podido guardar la vista. ${errorMessage(error)}`)
  },
  onSettled: () => {
    if (queryClient.isMutating({ mutationKey: VIEW_KEY }) > 1) return
    return refetchLists(queryClient)
  },
}))

export function useUpdateListView() {
  return useDurableMutation(listViewMutation)
}

/**
 * «Ocultar» (5.8, diseño 27, D1): sale de Inicio y del sidebar al momento, y lo de dentro de Hoy y
 * Buscar al volver a pedirlos. Hace falta conexión, como archivar. Si era la lista por defecto de
 * la captura, la base la deja en «En mente»: el perfil se vuelve a pedir.
 */
export function useHideList() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (list: List) => hideList(list.id),
    onMutate: (list) =>
      applyOptimistic(queryClient, {
        active: (lists) => lists.filter((item) => item.id !== list.id),
        archived: (lists) => lists.filter((item) => item.id !== list.id),
        hidden: (lists) => [...lists, { ...list, hidden: true }].sort(byPosition),
        hiddenIds: (ids) => [...ids.filter((id) => id !== list.id), list.id],
      }),
    onError: (error, _list, snapshot) => {
      rollback(queryClient, snapshot, `No se ha podido ocultar. ${errorMessage(error)}`)
    },
    onSettled: () =>
      Promise.all([
        refetchLists(queryClient),
        queryClient.invalidateQueries({ queryKey: ['items'] }),
        queryClient.invalidateQueries({ queryKey: queryKeys.profile() }),
      ]),
  })
}

/** «Mostrar» (D5b): vuelve a Inicio y al sidebar en su sitio de antes. */
export function useShowList() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (list: List) => showList(list.id),
    onMutate: (list) => {
      const shown = { ...list, hidden: false }
      return applyOptimistic(
        queryClient,
        list.archivedAt
          ? {
              archived: (lists) => [shown, ...lists],
              hidden: (lists) => lists.filter((item) => item.id !== list.id),
              hiddenIds: (ids) => ids.filter((id) => id !== list.id),
            }
          : {
              active: (lists) => [...lists, shown].sort(byPosition),
              hidden: (lists) => lists.filter((item) => item.id !== list.id),
              hiddenIds: (ids) => ids.filter((id) => id !== list.id),
            },
      )
    },
    onError: (error, _list, snapshot) => {
      rollback(queryClient, snapshot, `No se ha podido mostrar. ${errorMessage(error)}`)
    },
    onSettled: () =>
      Promise.all([
        refetchLists(queryClient),
        queryClient.invalidateQueries({ queryKey: ['items'] }),
      ]),
  })
}

/** Las mutaciones de listas que se registran en el QueryClient (2.10). */
export const listMutations = [reorderListsMutation, listViewMutation]

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
          item.id === list.id ? { ...item, name: values.name.trim(), color: values.color } : item,
        )
      queryClient.setQueryData<List[]>(queryKeys.lists.all, patch)
      queryClient.setQueryData<List[]>(queryKeys.lists.archived, patch)
      queryClient.setQueryData<List[]>(queryKeys.lists.hidden, patch)
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
