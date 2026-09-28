import { useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import type { List } from '@/features/lists'
import { errorMessage, isNetworkError } from '@/lib/errors'
import { queryKeys } from '@/lib/queryKeys'

import {
  createItem,
  deleteItem,
  moveItem,
  restoreItem,
  updateItem,
  updateItemStatus,
  type NewItem,
} from '../api'
import { buildMovePatch } from '../move'
import { isFinalStatus } from '../status'
import type { Item, ItemPatch, ItemStatus, MovedItem } from '../types'

/**
 * Todas las mutaciones de ítems comparten clave y `scope`. El `scope` las pone en fila: se envían
 * de una en una y en orden, así que completar un ítem recién creado sin red nunca llega a
 * Supabase antes que su alta, ni un «Deshacer» antes que el borrado. La clave sirve para saber
 * cuántas quedan en vuelo.
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

/** Foto de las cachés que toca una mutación, para volver atrás si el servidor dice que no. */
interface Snapshot {
  items: Map<string, Item[] | undefined>
  moved: Map<string, MovedItem[] | undefined>
  lists: List[] | undefined
}

interface Counts {
  pending: number
  done: number
}

interface OptimisticChange {
  /** Cambios en los ítems de cada lista (por id de lista). */
  items: Record<string, (items: Item[]) => Item[]>
  /** Cambios en lo movido desde cada inbox (por id de la inbox). */
  moved?: Record<string, (moved: MovedItem[]) => MovedItem[]>
  /** Cuánto cambian los contadores de Inicio y del sidebar, por lista. */
  counters: Record<string, Counts>
}

/**
 * Paso 1 del patrón optimista: para las consultas en vuelo, guarda la foto y escribe lo que
 * esperamos que pase, en los ítems, en lo movido y en los contadores.
 */
async function applyOptimistic(
  queryClient: QueryClient,
  change: OptimisticChange,
): Promise<Snapshot> {
  await queryClient.cancelQueries({ queryKey: ['items'] })
  await queryClient.cancelQueries({ queryKey: queryKeys.lists.all, exact: true })
  const snapshot: Snapshot = {
    items: new Map(),
    moved: new Map(),
    lists: queryClient.getQueryData<List[]>(queryKeys.lists.all),
  }

  for (const [listId, update] of Object.entries(change.items)) {
    const key = queryKeys.items.byList(listId)
    const items = queryClient.getQueryData<Item[]>(key)
    snapshot.items.set(listId, items)
    if (items) queryClient.setQueryData(key, update(items))
  }
  for (const [inboxId, update] of Object.entries(change.moved ?? {})) {
    const key = queryKeys.items.movedFrom(inboxId)
    const moved = queryClient.getQueryData<MovedItem[]>(key)
    snapshot.moved.set(inboxId, moved)
    if (moved) queryClient.setQueryData(key, update(moved))
  }
  if (snapshot.lists) {
    queryClient.setQueryData(
      queryKeys.lists.all,
      snapshot.lists.map((list) => {
        const delta = change.counters[list.id]
        if (!delta) return list
        return {
          ...list,
          counters: {
            ...list.counters,
            pending: list.counters.pending + delta.pending,
            done: list.counters.done + delta.done,
          },
        }
      }),
    )
  }
  return snapshot
}

/** Paso 3: si el servidor dice que no, todo vuelve a como estaba y se avisa. */
function rollback(queryClient: QueryClient, snapshot: Snapshot | undefined, message: string) {
  if (snapshot) {
    snapshot.items.forEach((items, listId) => {
      queryClient.setQueryData(queryKeys.items.byList(listId), items)
    })
    snapshot.moved.forEach((moved, inboxId) => {
      queryClient.setQueryData(queryKeys.items.movedFrom(inboxId), moved)
    })
    queryClient.setQueryData(queryKeys.lists.all, snapshot.lists)
  }
  toast.error(message)
}

/**
 * Paso 4: el servidor manda (los triggers ponen `completed_at`, `updated_at` y el rastro de «En
 * mente»), así que se vuelve a pedir. Pero solo cuando termina la última mutación en fila: si se
 * pidiera con otras en vuelo, la respuesta aún no las tendría y los cambios optimistas
 * parpadearían. `['items']` cubre todas las listas, lo movido y la vista previa de Inicio; solo se
 * vuelven a pedir las que están en pantalla.
 */
function settle(queryClient: QueryClient) {
  if (queryClient.isMutating({ mutationKey: ITEM_MUTATION_KEY }) > 1) return
  void queryClient.invalidateQueries({ queryKey: ['items'] })
  void queryClient.invalidateQueries({ queryKey: queryKeys.lists.all })
}

/** Cuánto suma un ítem a los contadores: un pendiente o un hecho. */
function counted(status: ItemStatus): Counts {
  return isFinalStatus(status) ? { pending: 0, done: 1 } : { pending: 1, done: 0 }
}

const negate = ({ pending, done }: Counts): Counts => ({ pending: -pending, done: -done })

/** Diferencia en los contadores al pasar de un estado a otro (cero si los dos cuentan igual). */
function statusDelta(from: ItemStatus, to: ItemStatus): Counts {
  const before = counted(from)
  const after = counted(to)
  return { pending: after.pending - before.pending, done: after.done - before.done }
}

/** Posición de un ítem nuevo: al final de la lista (la mayor + 1000, como las listas). */
export function nextItemPosition(items: readonly Item[] | undefined): number {
  return Math.max(0, ...(items ?? []).map((item) => item.position)) + 1000
}

/** Aplica un cambio del detalle a un ítem, con lo que haría el trigger (`completed_at`). */
function patchItem(item: Item, patch: ItemPatch): Item {
  const next: Item = { ...item }
  if (patch.title !== undefined) next.title = patch.title.trim()
  if (patch.notes !== undefined) next.notes = patch.notes?.trim() ? patch.notes.trim() : null
  if (patch.priority !== undefined) next.priority = patch.priority
  if (patch.dueAt !== undefined) {
    next.dueAt = patch.dueAt
    next.allDay = patch.dueAt !== null
  }
  if (patch.status !== undefined) {
    next.status = patch.status
    next.completedAt = isFinalStatus(patch.status) ? (item.completedAt ?? new Date()) : null
  }
  return next
}

/**
 * Añadir (optimista): el ítem aparece al instante con un id generado en el cliente, que es
 * también el que se guarda, así que la fila real sustituye a la optimista sin saltos.
 */
export function useCreateItem() {
  const queryClient = useQueryClient()
  return useMutation({
    ...OFFLINE_TOLERANT,
    mutationFn: (item: NewItem) => createItem(item),
    onMutate: (item) =>
      applyOptimistic(queryClient, {
        items: {
          [item.listId]: (items) => [
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
              position: item.position ?? nextItemPosition(items),
              completedAt: null,
              createdAt: new Date(),
              leftInboxId: null,
              leftInboxAt: null,
            },
          ],
        },
        counters: { [item.listId]: { pending: 1, done: 0 } },
      }),
    onError: (error, item, snapshot) => {
      rollback(
        queryClient,
        snapshot,
        `No se ha podido añadir «${item.title.trim()}». ${errorMessage(error)}`,
      )
    },
    onSettled: () => {
      settle(queryClient)
    },
  })
}

/** Cambiar el estado desde el checkbox o el menú de la fila (optimista). */
export function useSetItemStatus(listId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    ...OFFLINE_TOLERANT,
    mutationFn: ({ item, status }: { item: Item; status: ItemStatus }) =>
      updateItemStatus(item.id, status),
    onMutate: ({ item, status }) =>
      applyOptimistic(queryClient, {
        items: {
          [listId]: (items) =>
            items.map((entry) => (entry.id === item.id ? patchItem(entry, { status }) : entry)),
        },
        counters: { [listId]: statusDelta(item.status, status) },
      }),
    onError: (error, _variables, snapshot) => {
      rollback(queryClient, snapshot, `No se ha podido cambiar. ${errorMessage(error)}`)
    },
    onSettled: () => {
      settle(queryClient)
    },
  })
}

/**
 * Guardar un campo del detalle (optimista). Si falla, se deshace **solo ese campo** con lo que
 * tenía antes: lo que se haya guardado mientras tanto en otros campos no se pierde, como pasaría
 * al restaurar la foto entera de la lista.
 */
export function useUpdateItem(listId: string) {
  const queryClient = useQueryClient()
  const key = queryKeys.items.byList(listId)
  const replace = (itemId: string, update: (item: Item) => Item) => {
    queryClient.setQueryData<Item[]>(key, (items) =>
      items?.map((entry) => (entry.id === itemId ? update(entry) : entry)),
    )
  }
  const adjustCounters = (delta: Counts) => {
    queryClient.setQueryData<List[]>(queryKeys.lists.all, (lists) =>
      lists?.map((list) =>
        list.id === listId
          ? {
              ...list,
              counters: {
                ...list.counters,
                pending: list.counters.pending + delta.pending,
                done: list.counters.done + delta.done,
              },
            }
          : list,
      ),
    )
  }

  return useMutation({
    ...OFFLINE_TOLERANT,
    mutationFn: ({ item, patch }: { item: Item; patch: ItemPatch }) => updateItem(item.id, patch),
    onMutate: async ({ item, patch }) => {
      await queryClient.cancelQueries({ queryKey: key })
      const before =
        queryClient.getQueryData<Item[]>(key)?.find((entry) => entry.id === item.id) ?? item
      // Lo que había en los campos que se tocan, para devolverlo si falla.
      const previous: ItemPatch = {}
      if (patch.title !== undefined) previous.title = before.title
      if (patch.notes !== undefined) previous.notes = before.notes
      if (patch.priority !== undefined) previous.priority = before.priority
      if (patch.dueAt !== undefined) previous.dueAt = before.dueAt
      if (patch.status !== undefined) previous.status = before.status
      const delta = patch.status
        ? statusDelta(before.status, patch.status)
        : { pending: 0, done: 0 }
      replace(item.id, (entry) => patchItem(entry, patch))
      adjustCounters(delta)
      return { previous, delta }
    },
    onError: (error, { item }, context) => {
      if (context) {
        replace(item.id, (entry) => patchItem(entry, context.previous))
        adjustCounters(negate(context.delta))
      }
      toast.error(`No se ha podido guardar. ${errorMessage(error)}`)
    },
    onSettled: () => {
      settle(queryClient)
    },
  })
}

export interface MoveVariables {
  item: Item
  from: List
  to: List
}

/**
 * Mover a otra lista (optimista): sale de la lista de origen, entra al final de la de destino (si
 * está en caché) con su estado traducido, y los contadores de las dos cambian. Si sale de «En
 * mente», aparece en su «Fuera de la cabeza» como movida; si vuelve a ella, deja de estarlo.
 */
export function useMoveItem() {
  const queryClient = useQueryClient()
  return useMutation({
    ...OFFLINE_TOLERANT,
    mutationFn: ({ item, to }: MoveVariables) => moveItem(item.id, buildMovePatch(item, to)),
    onMutate: ({ item, from, to }) => {
      const patch = buildMovePatch(item, to)
      const leavesInbox = from.kind === 'inbox'
      const entersInbox = to.kind === 'inbox'
      const moved: Item = {
        ...item,
        ...patch,
        position: Number.MAX_SAFE_INTEGER,
        completedAt: isFinalStatus(patch.status) ? (item.completedAt ?? new Date()) : null,
        leftInboxId: entersInbox ? null : leavesInbox ? from.id : item.leftInboxId,
        leftInboxAt: entersInbox ? null : leavesInbox ? new Date() : item.leftInboxAt,
      }
      const movedChanges: Record<string, (entries: MovedItem[]) => MovedItem[]> = {}
      if (leavesInbox) {
        movedChanges[from.id] = (entries) => [
          { id: item.id, title: item.title, listName: to.name, movedAt: new Date() },
          ...entries,
        ]
      }
      if (entersInbox) {
        movedChanges[to.id] = (entries) => entries.filter((entry) => entry.id !== item.id)
      }
      return applyOptimistic(queryClient, {
        items: {
          [from.id]: (items) => items.filter((entry) => entry.id !== item.id),
          [to.id]: (items) => [...items, moved],
        },
        moved: movedChanges,
        counters: { [from.id]: negate(counted(item.status)), [to.id]: counted(patch.status) },
      })
    },
    onError: (error, { to }, snapshot) => {
      rollback(
        queryClient,
        snapshot,
        `No se ha podido mover a «${to.name}». ${errorMessage(error)}`,
      )
    },
    onSettled: () => {
      settle(queryClient)
    },
  })
}

/**
 * Borrar (optimista y sin confirmación, diseño 06): desaparece al instante y quien llama enseña
 * el aviso «Deshacer». Deshacer es `useRestoreItem`, que lo vuelve a crear igual.
 */
export function useDeleteItem() {
  const queryClient = useQueryClient()
  return useMutation({
    ...OFFLINE_TOLERANT,
    mutationFn: (item: Pick<Item, 'id' | 'listId' | 'status' | 'title'>) => deleteItem(item.id),
    onMutate: (item) =>
      applyOptimistic(queryClient, {
        items: { [item.listId]: (items) => items.filter((entry) => entry.id !== item.id) },
        counters: { [item.listId]: negate(counted(item.status)) },
      }),
    onError: (error, item, snapshot) => {
      rollback(
        queryClient,
        snapshot,
        `No se ha podido borrar «${item.title}». ${errorMessage(error)}`,
      )
    },
    onSettled: () => {
      settle(queryClient)
    },
  })
}

/** «Deshacer» un borrado (optimista): el ítem vuelve a su sitio con todo lo que tenía. */
export function useRestoreItem() {
  const queryClient = useQueryClient()
  return useMutation({
    ...OFFLINE_TOLERANT,
    mutationFn: (item: Item) => restoreItem(item),
    onMutate: (item) =>
      applyOptimistic(queryClient, {
        items: {
          [item.listId]: (items) =>
            items.some((entry) => entry.id === item.id) ? items : [...items, item],
        },
        counters: { [item.listId]: counted(item.status) },
      }),
    onError: (error, item, snapshot) => {
      rollback(
        queryClient,
        snapshot,
        `No se ha podido recuperar «${item.title}». ${errorMessage(error)}`,
      )
    },
    onSettled: () => {
      settle(queryClient)
    },
  })
}
