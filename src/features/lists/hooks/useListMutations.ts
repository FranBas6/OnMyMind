import { useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import { schedulePhotoCleanup } from '@/features/items/photoCleanup'
import { errorMessage } from '@/lib/errors'
import { queryKeys } from '@/lib/queryKeys'

import { archiveList, createList, deleteList, unarchiveList, updateList } from '../api'
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
