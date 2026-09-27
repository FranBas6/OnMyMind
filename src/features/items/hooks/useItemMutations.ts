import { useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import type { List } from '@/features/lists'
import { errorMessage, isNetworkError } from '@/lib/errors'
import { queryKeys } from '@/lib/queryKeys'

import { createItem, updateItemStatus, type NewItem } from '../api'
import { isFinalStatus } from '../status'
import type { Item, ItemStatus } from '../types'

/**
 * Todas las mutaciones de ítems comparten clave y `scope`. El `scope` las pone en fila: se envían
 * de una en una y en orden, así que completar un ítem recién creado sin red nunca llega a
 * Supabase antes que su alta. La clave sirve para saber cuántas quedan en vuelo.
 */
const ITEM_MUTATION_KEY = ['items'] as const
const ITEM_MUTATION_SCOPE = { id: 'items' }

/**
 * Sin red, la mutación espera (`networkMode: 'online'`) en vez de fallar: el cambio optimista ya
 * se ve y se envía solo al volver la conexión. Si la red cae a mitad, se reintenta hasta tres
 * veces; cualquier otro error (RLS, validación) no se reintenta porque no se arreglaría.
 */
const OFFLINE_TOLERANT = {
  mutationKey: ITEM_MUTATION_KEY,
  scope: ITEM_MUTATION_SCOPE,
  networkMode: 'online',
  retry: (failureCount: number, error: Error) => isNetworkError(error) && failureCount < 3,
} as const

interface Snapshot {
  items: Item[] | undefined
  lists: List[] | undefined
}

/**
 * Paso 1 del patrón optimista: para las consultas en vuelo de la lista, guarda la foto de sus
 * ítems y de los contadores (Inicio y sidebar) y escribe lo que esperamos que pase.
 */
async function applyOptimistic(
  queryClient: QueryClient,
  listId: string,
  change: { items: (items: Item[]) => Item[]; pending: number; done: number },
): Promise<Snapshot> {
  const itemsKey = queryKeys.items.byList(listId)
  await queryClient.cancelQueries({ queryKey: itemsKey })
  await queryClient.cancelQueries({ queryKey: queryKeys.lists.all, exact: true })
  const snapshot: Snapshot = {
    items: queryClient.getQueryData<Item[]>(itemsKey),
    lists: queryClient.getQueryData<List[]>(queryKeys.lists.all),
  }
  if (snapshot.items) queryClient.setQueryData(itemsKey, change.items(snapshot.items))
  if (snapshot.lists) {
    queryClient.setQueryData(
      queryKeys.lists.all,
      snapshot.lists.map((list) =>
        list.id === listId
          ? {
              ...list,
              counters: {
                ...list.counters,
                pending: list.counters.pending + change.pending,
                done: list.counters.done + change.done,
              },
            }
          : list,
      ),
    )
  }
  return snapshot
}

/** Paso 3: si el servidor dice que no, todo vuelve a como estaba y se avisa. */
function rollback(
  queryClient: QueryClient,
  listId: string,
  snapshot: Snapshot | undefined,
  message: string,
) {
  if (snapshot) {
    queryClient.setQueryData(queryKeys.items.byList(listId), snapshot.items)
    queryClient.setQueryData(queryKeys.lists.all, snapshot.lists)
  }
  toast.error(message)
}

/**
 * Paso 4: el servidor manda (el trigger pone `completed_at` y `updated_at`), así que se vuelve a
 * pedir. Pero solo cuando termina la última mutación en fila: si se pidiera con otras en vuelo,
 * la respuesta aún no las tendría y los ítems optimistas parpadearían.
 */
function settle(queryClient: QueryClient, listId: string) {
  if (queryClient.isMutating({ mutationKey: ITEM_MUTATION_KEY }) > 1) return
  // `byList` también cubre la vista previa de «En mente» en Inicio (`latest`): la clave empieza igual.
  void queryClient.invalidateQueries({ queryKey: queryKeys.items.byList(listId) })
  void queryClient.invalidateQueries({ queryKey: queryKeys.lists.all })
}

/** Posición de un ítem nuevo: al final de la lista (la mayor + 1000, como las listas). */
export function nextItemPosition(items: readonly Item[] | undefined): number {
  return Math.max(0, ...(items ?? []).map((item) => item.position)) + 1000
}

/**
 * Añadir (optimista): el ítem aparece al instante con un id generado en el cliente, que es
 * también el que se guarda, así que la fila real sustituye a la optimista sin saltos.
 */
export function useCreateItem(listId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    ...OFFLINE_TOLERANT,
    mutationFn: (item: NewItem) => createItem(item),
    onMutate: (item) =>
      applyOptimistic(queryClient, listId, {
        items: (items) => [
          ...items,
          {
            id: item.id,
            listId: item.listId,
            title: item.title.trim(),
            notes: null,
            status: item.status,
            priority: null,
            dueAt: null,
            allDay: false,
            recurrence: null,
            position: item.position,
            completedAt: null,
            createdAt: new Date(),
          },
        ],
        pending: 1,
        done: 0,
      }),
    onError: (error, item, snapshot) => {
      rollback(
        queryClient,
        listId,
        snapshot,
        `No se ha podido añadir «${item.title.trim()}». ${errorMessage(error)}`,
      )
    },
    onSettled: () => {
      settle(queryClient, listId)
    },
  })
}

/** Cambiar el estado desde el checkbox (optimista). */
export function useSetItemStatus(listId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    ...OFFLINE_TOLERANT,
    mutationFn: ({ item, status }: { item: Item; status: ItemStatus }) =>
      updateItemStatus(item.id, status),
    onMutate: ({ item, status }) => {
      const wasFinal = isFinalStatus(item.status)
      const final = isFinalStatus(status)
      const moved = wasFinal === final ? 0 : final ? 1 : -1
      return applyOptimistic(queryClient, listId, {
        items: (items) =>
          items.map((entry) =>
            entry.id === item.id
              ? { ...entry, status, completedAt: final ? (entry.completedAt ?? new Date()) : null }
              : entry,
          ),
        pending: -moved,
        done: moved,
      })
    },
    onError: (error, _variables, snapshot) => {
      rollback(queryClient, listId, snapshot, `No se ha podido cambiar. ${errorMessage(error)}`)
    },
    onSettled: () => {
      settle(queryClient, listId)
    },
  })
}
