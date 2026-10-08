import type { QueryClient, QueryKey } from '@tanstack/react-query'
import { toast } from 'sonner'

import type { List } from '@/features/lists'
import { errorMessage } from '@/lib/errors'
import { durableMutation, useDurableMutation, WAITS_FOR_NETWORK } from '@/lib/mutations'
import { withPositions, type Positioned } from '@/lib/reorder'
import { queryKeys } from '@/lib/queryKeys'

import {
  createItem,
  deleteItem,
  deleteImage,
  deleteLink,
  insertImages,
  insertLinks,
  updateImage,
  updateLink,
  insertItems,
  moveItem,
  updateItem,
  updateItemPositions,
  updateItemStatus,
  undoRepeat,
  type NewItem,
} from '../api'
import { repeatOnDone } from '../recurrence'
import { buildMovePatch } from '../move'
import { schedulePhotoCleanup } from '../photoCleanup'
import { isFinalStatus, isOutOfMind } from '../status'
import { patchLink, withLinks } from '../stores'
import { countItems, type Counts } from '../sublists'
import type {
  Completion,
  Item,
  ItemImage,
  ItemLink,
  ItemLinkPatch,
  ItemPatch,
  ItemStatus,
  MovedItem,
} from '../types'

/**
 * Todas las mutaciones de ítems empiezan su clave por `items` y comparten `scope`. El `scope` las
 * pone en fila: se envían de una en una y en orden, así que completar un ítem recién creado sin
 * red nunca llega a Supabase antes que su alta, ni un «Deshacer» antes que el borrado. Con el
 * prefijo se sabe cuántas quedan en vuelo; el resto de la clave dice cuál es, para encontrar su
 * función al restaurarla (2.10).
 */
const ITEM_MUTATION_KEY = ['items'] as const

/**
 * Las consultas que mezclan ítems de varias listas: Hoy (una por día), otro día de Hoy (una por
 * mes) y Buscar. Cada pantalla
 * vuelve a filtrar lo suyo (`groupToday`, `searchItems`), así que basta con aplicarles el cambio.
 */
const MIXED_QUERIES = [
  queryKeys.items.todayAll,
  queryKeys.items.daysAll,
  queryKeys.items.all,
] as const

function mixedQueries(queryClient: QueryClient): [QueryKey, Item[] | undefined][] {
  return MIXED_QUERIES.flatMap((queryKey) => queryClient.getQueriesData<Item[]>({ queryKey }))
}
const ITEM_MUTATION_SCOPE = { id: 'items' }

/**
 * Sin red esperan en vez de fallar (`WAITS_FOR_NETWORK`), en fila. Los avisos (2.6) van en la
 * misma fila: el de un ítem creado sin red sale detrás de su alta.
 */
export const OFFLINE_TOLERANT = { ...WAITS_FOR_NETWORK, scope: ITEM_MUTATION_SCOPE } as const

/** La clave de una mutación de ítems: `items` y cuál es. */
export const itemMutationKey = (name: string) => [...ITEM_MUTATION_KEY, name] as const

/** Foto de las cachés que toca una mutación, para volver atrás si el servidor dice que no. */
interface Snapshot {
  items: Map<string, Item[] | undefined>
  moved: Map<string, MovedItem[] | undefined>
  /** Hoy y Buscar. */
  mixed: [QueryKey, Item[] | undefined][]
  lists: List[] | undefined
}

interface OptimisticChange {
  /** Cambios en los ítems de cada lista (por id de lista). */
  items: Record<string, (items: Item[]) => Item[]>
  /** Cambios en lo movido desde cada inbox (por id de la inbox). */
  moved?: Record<string, (moved: MovedItem[]) => MovedItem[]>
  /** Cambio en Hoy y en Buscar, que mezclan ítems de todas las listas. */
  mixed?: (items: Item[]) => Item[]
  /**
   * Cuánto cambian los contadores de Inicio y del sidebar, por lista, cuando sus ítems no están en
   * caché. Si lo están, el cambio se calcula comparando lo que cuentan antes y después
   * (`countItems`, las reglas de `list_counters`): así cuadra también con las sublistas.
   */
  counters?: Record<string, Counts>
}

/** Lo que cambian los contadores de una lista entre dos versiones de sus ítems. */
function countsDelta(before: readonly Item[], after: readonly Item[]): Counts {
  const was = countItems(before)
  const is = countItems(after)
  return { pending: is.pending - was.pending, done: is.done - was.done }
}

/**
 * Paso 1 del patrón optimista: para las consultas en vuelo, guarda la foto y escribe lo que
 * esperamos que pase, en los ítems, en lo movido, en Hoy y Buscar, y en los contadores.
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
    mixed: mixedQueries(queryClient),
    lists: queryClient.getQueryData<List[]>(queryKeys.lists.all),
  }

  const deltas: Record<string, Counts> = { ...change.counters }
  for (const [listId, update] of Object.entries(change.items)) {
    const key = queryKeys.items.byList(listId)
    const items = queryClient.getQueryData<Item[]>(key)
    snapshot.items.set(listId, items)
    if (items) {
      const next = update(items)
      queryClient.setQueryData(key, next)
      deltas[listId] = countsDelta(items, next)
    }
  }
  for (const [inboxId, update] of Object.entries(change.moved ?? {})) {
    const key = queryKeys.items.movedFrom(inboxId)
    const moved = queryClient.getQueryData<MovedItem[]>(key)
    snapshot.moved.set(inboxId, moved)
    if (moved) queryClient.setQueryData(key, update(moved))
  }
  const { mixed } = change
  if (mixed) {
    for (const [key, items] of snapshot.mixed) {
      if (items) queryClient.setQueryData(key, mixed(items))
    }
  }
  if (snapshot.lists) {
    queryClient.setQueryData(
      queryKeys.lists.all,
      snapshot.lists.map((list) => {
        const delta = deltas[list.id]
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
    for (const [key, items] of snapshot.mixed) queryClient.setQueryData(key, items)
    queryClient.setQueryData(queryKeys.lists.all, snapshot.lists)
  }
  toast.error(message)
}

/**
 * Paso 4: el servidor manda (los triggers ponen `completed_at`, `updated_at` y el rastro de «En
 * mente»), así que se vuelve a pedir. Pero solo cuando termina la última mutación en fila: si se
 * pidiera con otras en vuelo, la respuesta aún no las tendría y los cambios optimistas
 * parpadearían. `['items']` cubre todas las listas, lo movido, Hoy y la vista previa de Inicio; solo se
 * vuelven a pedir las que están en pantalla.
 */
function settle(queryClient: QueryClient) {
  if (queryClient.isMutating({ mutationKey: ITEM_MUTATION_KEY }) > 1) return
  void queryClient.invalidateQueries({ queryKey: ['items'] })
  void queryClient.invalidateQueries({ queryKey: queryKeys.lists.all })
  // Cambiar la fecha de un ítem mueve su aviso en la base (`items_sync_reminders`, 2.6).
  void queryClient.invalidateQueries({ queryKey: queryKeys.reminders })
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

/**
 * Un cambio en la caché. Además de lo del detalle, al deshacer un precio fallido vuelven tal cual
 * el anterior y la fecha, que en un cambio normal calcula `patchItem` como el trigger.
 */
type CachePatch = ItemPatch & Partial<Pick<Item, 'previousPriceCents'>>

/**
 * Aplica un cambio del detalle a un ítem, con lo que haría el trigger: `completed_at` y, si cambia
 * el precio, el anterior y cuándo se puso (`items_price_before`).
 */
function patchItem(item: Item, patch: CachePatch): Item {
  const next: Item = { ...item }
  if (patch.title !== undefined) next.title = patch.title.trim()
  if (patch.notes !== undefined) next.notes = patch.notes?.trim() ? patch.notes.trim() : null
  if (patch.priority !== undefined) next.priority = patch.priority
  if (patch.allDay !== undefined) {
    if (patch.dueAt !== undefined) next.dueAt = patch.dueAt
    next.allDay = patch.allDay
  } else if (patch.dueAt !== undefined) {
    next.dueAt = patch.dueAt
    next.allDay = patch.dueAt !== null
  }
  if (patch.status !== undefined) {
    next.status = patch.status
    const final = isFinalStatus(patch.status)
    next.completedAt = final ? (item.completedAt ?? new Date()) : null
    // Lo completa quien tiene la sesión: hasta que vuelva el servidor, sin inicial.
    next.completedBy = final && item.completedAt ? item.completedBy : null
  }
  if (patch.kind !== undefined) next.kind = patch.kind
  if (patch.url !== undefined) next.url = patch.url
  if (patch.urlTitle !== undefined) next.urlTitle = patch.urlTitle
  if (patch.imageUrl !== undefined) next.imageUrl = patch.imageUrl
  if (patch.recurrence !== undefined) next.recurrence = patch.recurrence
  if (patch.urlSite !== undefined) next.urlSite = patch.urlSite
  if (patch.currency !== undefined) next.currency = patch.currency
  if (patch.priceSource !== undefined) next.priceSource = patch.priceSource
  if (patch.priceCents !== undefined && patch.priceCents !== item.priceCents) {
    next.priceCents = patch.priceCents
    const removed = patch.priceCents === null
    next.previousPriceCents = removed ? null : item.priceCents
    next.priceCheckedAt = removed ? null : new Date()
    if (removed) next.priceSource = null
  }
  if (patch.previousPriceCents !== undefined) next.previousPriceCents = patch.previousPriceCents
  if (patch.priceCheckedAt !== undefined) next.priceCheckedAt = patch.priceCheckedAt
  // Lo que hace `price_follow_before` (3.8): un enlace nuevo empieza sin seguir; un precio de la web
  // lo pone en seguimiento (también si había dejado de poderse seguir).
  if (patch.url !== undefined && patch.url !== item.url) next.priceTracking = null
  if ((patch.priceSource === 'web' || patch.priceSource === 'auto') && next.priceCents !== null) {
    next.priceTracking = 'on'
  }
  return next
}

/**
 * Diferencia en los contadores entre dos versiones de un ítem. Mira si está fuera de la cabeza
 * (`isOutOfMind`) y no solo el estado: una tarea con la fecha pasada que se convierte en evento
 * pasa a contar como hecha, igual que en la vista `list_counters`.
 */
function itemDelta(before: Item, after: Item): Counts {
  const was = isOutOfMind(before) ? 1 : 0
  const is = isOutOfMind(after) ? 1 : 0
  return { pending: was - is, done: is - was }
}

/** El ítem tal como se verá al añadirlo, antes de que conteste el servidor. */
export function itemFromNew(item: NewItem, position: number): Item {
  const { link } = item
  return {
    id: item.id,
    listId: item.listId,
    kind: item.kind,
    parentId: item.parentId ?? null,
    title: item.title.trim(),
    notes: null,
    status: item.status,
    priority: null,
    dueAt: item.due?.at ?? null,
    allDay: item.due?.allDay ?? false,
    recurrence: item.recurrence ?? null,
    position,
    // Una línea pegada con «[x] » nace hecha (4.3): el trigger le pone la fecha.
    completedAt: isFinalStatus(item.status) ? new Date() : null,
    createdAt: new Date(),
    leftInboxId: null,
    leftInboxAt: null,
    url: link?.url ?? null,
    urlTitle: link?.urlTitle ?? null,
    imageUrl: link?.imageUrl ?? null,
    imagePath: null,
    urlSite: link?.urlSite ?? null,
    priceCents: link?.price?.cents ?? null,
    currency: link?.price?.currency ?? 'EUR',
    priceSource: link?.price ? 'web' : null,
    previousPriceCents: null,
    priceCheckedAt: link?.price ? new Date() : null,
    links: [],
    images: [],
    priceLinkId: null,
    priceStore: null,
    // El precio que trae al pegarlo es de la web: desde ahí se mira solo (3.8).
    priceTracking: link?.price ? 'on' : null,
    createdBy: null,
    completedBy: null,
  }
}

/**
 * Añadir (optimista): el ítem aparece al instante con un id generado en el cliente, que es
 * también el que se guarda, así que la fila real sustituye a la optimista sin saltos.
 */
const createItemMutation = durableMutation(itemMutationKey('create'), (queryClient) => ({
  ...OFFLINE_TOLERANT,
  mutationFn: (item: NewItem) => createItem(item),
  onMutate: (item) =>
    applyOptimistic(queryClient, {
      items: {
        [item.listId]: (items) => [
          ...items,
          itemFromNew(item, item.position ?? nextItemPosition(items)),
        ],
      },
      counters: { [item.listId]: counted(item.status) },
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
}))

export function useCreateItem() {
  return useDurableMutation(createItemMutation)
}

/** Cambia un ítem en una lista de ítems, si está. */
const patchIn = (items: Item[], itemId: string, patch: CachePatch) =>
  items.map((entry) => (entry.id === itemId ? patchItem(entry, patch) : entry))

/**
 * Cambiar el estado desde el checkbox o el menú de la fila (optimista). La lista es la del ítem:
 * en Hoy cada fila es de una lista distinta.
 */
const setItemStatusMutation = durableMutation(itemMutationKey('status'), (queryClient) => ({
  ...OFFLINE_TOLERANT,
  mutationFn: ({ item, status }: { item: Item; status: ItemStatus }) =>
    updateItemStatus(item.id, status),
  onMutate: ({ item, status }) => {
    // Una tarea que se repite no se completa: pasa a su siguiente fecha y queda la vez hecha (3.6).
    const next = repeatOnDone(item, status)
    if (next) {
      addCompletion(queryClient, item, next)
      return applyOptimistic(queryClient, {
        items: { [item.listId]: (items) => patchIn(items, item.id, { dueAt: next }) },
        mixed: (items) => patchIn(items, item.id, { dueAt: next }),
      })
    }
    return applyOptimistic(queryClient, {
      items: { [item.listId]: (items) => patchIn(items, item.id, { status }) },
      mixed: (items) => patchIn(items, item.id, { status }),
      counters: { [item.listId]: statusDelta(item.status, status) },
    })
  },
  onError: (error, _variables, snapshot) => {
    rollback(queryClient, snapshot, `No se ha podido cambiar. ${errorMessage(error)}`)
  },
  onSettled: () => {
    settle(queryClient)
  },
}))

export function useSetItemStatus() {
  return useDurableMutation(setItemStatusMutation)
}

/**
 * La vez hecha, en las consultas de veces hechas que haya («Hecho hoy»), antes de que conteste el
 * servidor. Hoy la pone en su día por `doneAt`; al terminar la mutación se vuelven a pedir.
 */
function addCompletion(queryClient: QueryClient, item: Item, next: Date) {
  if (!item.dueAt) return
  const completion: Completion = {
    id: crypto.randomUUID(),
    item: { ...item, dueAt: next },
    doneAt: new Date(),
    doneBy: null,
    occurrence: item.dueAt,
  }
  queryClient.setQueriesData<Completion[]>(
    { queryKey: queryKeys.items.completionsAll },
    (completions) => completions && [completion, ...completions],
  )
}

/**
 * «Deshacer» al completar una tarea que se repite (diseño 21, B10): la última vez hecha se borra y
 * la tarea vuelve a la fecha que tenía (`undo_repeat`). Optimista y en la fila de las mutaciones de
 * ítems, así que sin red espera detrás de la de completar.
 */
const undoRepeatMutation = durableMutation(itemMutationKey('undoRepeat'), (queryClient) => ({
  ...OFFLINE_TOLERANT,
  mutationFn: ({ item }: { item: Item; occurrence: Date }) => undoRepeat(item.id),
  onMutate: ({ item, occurrence }) => {
    queryClient.setQueriesData<Completion[]>(
      { queryKey: queryKeys.items.completionsAll },
      (completions) => {
        if (!completions) return completions
        const last = completions.find((completion) => completion.item.id === item.id)
        return completions.filter((completion) => completion !== last)
      },
    )
    return applyOptimistic(queryClient, {
      items: { [item.listId]: (items) => patchIn(items, item.id, { dueAt: occurrence }) },
      mixed: (items) => patchIn(items, item.id, { dueAt: occurrence }),
    })
  },
  onError: (error, _variables, snapshot) => {
    rollback(queryClient, snapshot, `No se ha podido deshacer. ${errorMessage(error)}`)
  },
  onSettled: () => {
    settle(queryClient)
  },
}))

export function useUndoRepeat() {
  return useDurableMutation(undoRepeatMutation)
}

/**
 * Guardar un campo del detalle (optimista). Si falla, se deshace **solo ese campo** con lo que
 * tenía antes: lo que se haya guardado mientras tanto en otros campos no se pierde, como pasaría
 * al restaurar la foto entera de la lista. Se aplica en su lista y en Hoy.
 */
const updateItemMutation = durableMutation(itemMutationKey('update'), (queryClient) => {
  const replace = (item: Item, patch: CachePatch) => {
    queryClient.setQueryData<Item[]>(
      queryKeys.items.byList(item.listId),
      (items) => items && patchIn(items, item.id, patch),
    )
    for (const queryKey of MIXED_QUERIES) {
      queryClient.setQueriesData<Item[]>(
        { queryKey },
        (items) => items && patchIn(items, item.id, patch),
      )
    }
  }
  const adjustCounters = (listId: string, delta: Counts) => {
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

  return {
    ...OFFLINE_TOLERANT,
    mutationFn: ({ item, patch }: { item: Item; patch: ItemPatch }) => updateItem(item.id, patch),
    onMutate: async ({ item, patch }) => {
      const key = queryKeys.items.byList(item.listId)
      await queryClient.cancelQueries({ queryKey: key })
      for (const queryKey of MIXED_QUERIES) await queryClient.cancelQueries({ queryKey })
      const before =
        queryClient.getQueryData<Item[]>(key)?.find((entry) => entry.id === item.id) ?? item
      // Lo que había en los campos que se tocan, para devolverlo si falla.
      const previous: CachePatch = {}
      if (patch.title !== undefined) previous.title = before.title
      if (patch.notes !== undefined) previous.notes = before.notes
      if (patch.priority !== undefined) previous.priority = before.priority
      if (patch.dueAt !== undefined || patch.allDay !== undefined) {
        previous.dueAt = before.dueAt
        previous.allDay = before.allDay
      }
      if (patch.status !== undefined) previous.status = before.status
      if (patch.kind !== undefined) previous.kind = before.kind
      if (patch.url !== undefined) previous.url = before.url
      if (patch.urlTitle !== undefined) previous.urlTitle = before.urlTitle
      if (patch.imageUrl !== undefined) previous.imageUrl = before.imageUrl
      if (patch.recurrence !== undefined) previous.recurrence = before.recurrence
      if (patch.urlSite !== undefined) previous.urlSite = before.urlSite
      if (patch.currency !== undefined) previous.currency = before.currency
      if (patch.priceSource !== undefined) previous.priceSource = before.priceSource
      if (patch.priceCheckedAt !== undefined) previous.priceCheckedAt = before.priceCheckedAt
      if (patch.priceCents !== undefined) {
        previous.priceCents = before.priceCents
        previous.priceSource = before.priceSource
        previous.previousPriceCents = before.previousPriceCents
        previous.priceCheckedAt = before.priceCheckedAt
      }
      const cached = queryClient.getQueryData<Item[]>(key)
      const delta = cached
        ? countsDelta(cached, patchIn(cached, item.id, patch))
        : itemDelta(before, patchItem(before, patch))
      replace(item, patch)
      adjustCounters(item.listId, delta)
      return { previous, delta }
    },
    onError: (error, { item }, context) => {
      if (context) {
        replace(item, context.previous)
        adjustCounters(item.listId, negate(context.delta))
      }
      toast.error(`No se ha podido guardar. ${errorMessage(error)}`)
    },
    onSettled: () => {
      settle(queryClient)
    },
  }
})

export function useUpdateItem() {
  return useDurableMutation(updateItemMutation)
}

export interface MoveVariables {
  item: Item
  from: List
  to: List
  /** La sublista de destino (2a.5); sin ella va suelto a `to` («Sacar de Lisboa» si es la misma). */
  parentId?: string | null
}

/**
 * Mover a otra lista (optimista): sale de la lista de origen, entra al final de la de destino (si
 * está en caché) con su estado traducido, y los contadores de las dos cambian. Si sale de «En
 * mente», aparece en su «Fuera de la cabeza» como movida; si vuelve a ella, deja de estarlo.
 */
const moveItemMutation = durableMutation(itemMutationKey('move'), (queryClient) => ({
  ...OFFLINE_TOLERANT,
  mutationFn: ({ item, to, parentId = null }: MoveVariables) =>
    moveItem(item.id, buildMovePatch(item, to, parentId)),
  onMutate: ({ item, from, to, parentId = null }) => {
    const patch = buildMovePatch(item, to, parentId)
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
    // Una sublista se va con lo de dentro (trigger `items_follow_parent`).
    const children =
      item.kind === 'sublist'
        ? (queryClient.getQueryData<Item[]>(queryKeys.items.byList(from.id)) ?? [])
            .filter((entry) => entry.parentId === item.id)
            .map((entry) => ({ ...entry, listId: to.id }))
        : []
    const goes = new Set([item.id, ...children.map((entry) => entry.id)])
    const follow = (entry: Item) =>
      entry.id === item.id ? moved : goes.has(entry.id) ? { ...entry, listId: to.id } : entry
    return applyOptimistic(queryClient, {
      // Dentro de la misma lista (a una sublista, o fuera de ella) el ítem cambia de sitio sin
      // salir de su caché; entre listas sale de una y entra al final de la otra.
      items:
        from.id === to.id
          ? { [from.id]: (items) => items.map((entry) => (entry.id === item.id ? moved : entry)) }
          : {
              [from.id]: (items) => items.filter((entry) => !goes.has(entry.id)),
              [to.id]: (items) => [...items, moved, ...children],
            },
      // En Hoy se queda si la lista destino también es de tareas (lo decide `groupToday`).
      mixed: (items) => items.map(follow),
      moved: movedChanges,
      counters:
        from.id === to.id
          ? {}
          : { [from.id]: negate(counted(item.status)), [to.id]: counted(patch.status) },
    })
  },
  onError: (error, { to }, snapshot) => {
    rollback(queryClient, snapshot, `No se ha podido mover a «${to.name}». ${errorMessage(error)}`)
  },
  onSettled: () => {
    settle(queryClient)
  },
}))

export function useMoveItem() {
  return useDurableMutation(moveItemMutation)
}

/**
 * Ordenar a mano (2.9, diseño 14): las posiciones nuevas de unos ítems de una lista, al momento y
 * también sin red (en la fila de las mutaciones de ítems; «Sin conexión, el orden cambia igual,
 * sin aviso», R13). Si el servidor dice que no, vuelve atrás.
 */
const reorderItemsMutation = durableMutation(itemMutationKey('reorder'), (queryClient) => ({
  ...OFFLINE_TOLERANT,
  mutationFn: ({ changes }: { listId: string; changes: Positioned[] }) =>
    updateItemPositions(changes),
  onMutate: ({ listId, changes }) =>
    applyOptimistic(queryClient, {
      items: { [listId]: (items) => withPositions(items, changes) },
      mixed: (items) => withPositions(items, changes),
    }),
  onError: (error, _variables, snapshot) => {
    rollback(queryClient, snapshot, `No se ha podido guardar el orden. ${errorMessage(error)}`)
  },
  onSettled: () => {
    settle(queryClient)
  },
}))

export function useReorderItems() {
  return useDurableMutation(reorderItemsMutation)
}

/**
 * Borrar (optimista y sin confirmación, diseño 06): desaparece al instante y quien llama enseña
 * el aviso «Deshacer». Deshacer es `useInsertItems`, que lo vuelve a crear igual (una sublista,
 * con lo de dentro).
 */
const deleteItemMutation = durableMutation(itemMutationKey('delete'), (queryClient) => ({
  ...OFFLINE_TOLERANT,
  mutationFn: (item: Pick<Item, 'id' | 'listId' | 'status' | 'title'>) => deleteItem(item.id),
  onMutate: (item) => {
    // Borrar una sublista borra lo de dentro (`on delete cascade`).
    const gone = (entry: Item) => entry.id === item.id || entry.parentId === item.id
    return applyOptimistic(queryClient, {
      items: { [item.listId]: (items) => items.filter((entry) => !gone(entry)) },
      mixed: (items) => items.filter((entry) => !gone(entry)),
      counters: { [item.listId]: negate(counted(item.status)) },
    })
  },
  onError: (error, item, snapshot) => {
    rollback(
      queryClient,
      snapshot,
      `No se ha podido borrar «${item.title}». ${errorMessage(error)}`,
    )
  },
  onSuccess: () => {
    // Sus fotos (y las de lo de dentro), cuando ya no se pueda «Deshacer» (2.8).
    schedulePhotoCleanup()
  },
  onSettled: () => {
    settle(queryClient)
  },
}))

export function useDeleteItem() {
  return useDurableMutation(deleteItemMutation)
}

const withItems = (items: Item[], added: readonly Item[]) => [
  ...items,
  ...added.filter((item) => !items.some((entry) => entry.id === item.id)),
]

export interface InsertVariables {
  /** De una misma lista; si hay una sublista, con lo suyo. */
  items: readonly Item[]
  /** «Deshacer» un borrado o duplicar una sublista: solo cambia el aviso si falla. */
  reason: 'restore' | 'duplicate'
}

/**
 * Vuelve a poner ítems tal cual (optimista): «Deshacer» un borrado, que devuelve una sublista con
 * todo lo suyo, y duplicar una sublista, que inserta la copia con sus ids ya generados.
 */
const insertItemsMutation = durableMutation(itemMutationKey('insert'), (queryClient) => ({
  ...OFFLINE_TOLERANT,
  mutationFn: ({ items }: InsertVariables) => insertItems(items),
  onMutate: ({ items }) => {
    const listId = items[0]?.listId
    if (!listId) return undefined
    return applyOptimistic(queryClient, {
      items: { [listId]: (cached) => withItems(cached, items) },
      mixed: (cached) => withItems(cached, items),
      counters: { [listId]: countItems(items) },
    })
  },
  onError: (error, { items, reason }, snapshot) => {
    const title = items[0]?.title ?? ''
    const what = reason === 'restore' ? 'recuperar' : 'duplicar'
    rollback(queryClient, snapshot, `No se ha podido ${what} «${title}». ${errorMessage(error)}`)
  },
  onSettled: () => {
    settle(queryClient)
  },
}))

export function useInsertItems() {
  return useDurableMutation(insertItemsMutation)
}

/** Lo que se hace con las tiendas de una compra (2.2b). */
export type StoreChange =
  | { type: 'add'; item: Item; links: ItemLink[] }
  | { type: 'update'; item: Item; linkId: string; patch: ItemLinkPatch }
  | { type: 'remove'; item: Item; linkId: string }

/** Las tiendas de la compra después del cambio (lo que el servidor tendrá). */
function linksAfter(change: StoreChange): ItemLink[] {
  const { item } = change
  if (change.type === 'add') return [...item.links, ...change.links]
  if (change.type === 'update')
    return item.links.map((link) =>
      link.id === change.linkId ? patchLink(link, change.patch) : link,
    )
  return item.links.filter((link) => link.id !== change.linkId)
}

/**
 * Añadir, cambiar o quitar una tienda (optimista, en la misma fila que el resto de mutaciones de
 * ítems, así que nunca llega antes que el alta de la compra). En la caché, la compra queda como la
 * dejará el trigger (`withLinks`): con el enlace de la primera y el precio de la más barata.
 */
const storeMutation = durableMutation(itemMutationKey('store'), (queryClient) => ({
  ...OFFLINE_TOLERANT,
  mutationFn: (change: StoreChange) => {
    if (change.type === 'add') return insertLinks(change.item.id, change.links)
    if (change.type === 'update') return updateLink(change.linkId, change.patch)
    return deleteLink(change.linkId)
  },
  onMutate: (change) => {
    // Sobre lo que hay en la caché, por si otra mutación en fila ya la cambió.
    const update = (items: Item[]) =>
      items.map((entry) =>
        entry.id === change.item.id
          ? withLinks(entry, linksAfter({ ...change, item: entry }))
          : entry,
      )
    return applyOptimistic(queryClient, {
      items: { [change.item.listId]: update },
      mixed: update,
    })
  },
  onError: (error, _change, snapshot) => {
    rollback(queryClient, snapshot, `No se ha podido guardar la tienda. ${errorMessage(error)}`)
  },
  onSettled: () => {
    settle(queryClient)
  },
}))

export function useStoreMutation() {
  return useDurableMutation(storeMutation)
}

/** Lo que se hace con las fotos de una cosa (4.5, diseño 23, D). */
export type ImageChange =
  | { type: 'add'; item: Item; images: ItemImage[] }
  | {
      type: 'update'
      item: Item
      imageId: string
      patch: Partial<Pick<ItemImage, 'path' | 'position'>>
    }
  | { type: 'remove'; item: Item; imageId: string }

/** Las fotos después del cambio, por su orden. */
export function imagesAfter(images: readonly ItemImage[], change: ImageChange): ItemImage[] {
  const next =
    change.type === 'add'
      ? [
          ...images.filter((image) => !change.images.some((added) => added.id === image.id)),
          ...change.images,
        ]
      : change.type === 'update'
        ? images.map((image) =>
            image.id === change.imageId ? { ...image, ...change.patch } : image,
          )
        : images.filter((image) => image.id !== change.imageId)
  return next.sort((a, b) => a.position - b.position)
}

/** La cosa con estas fotos, como la deja `item_images_sync`: la primera es la suya. */
export function withImages(item: Item, images: ItemImage[]): Item {
  const [first] = images
  return {
    ...item,
    images,
    imagePath: first?.path ?? null,
    imageUrl: first ? null : item.imageUrl,
  }
}

/**
 * Las fotos (optimista): añadir las ya subidas, ponerlas en otro sitio, cambiar una y quitarla. En
 * la cola de ítems, como lo demás. Lo que se queda sin usar lo borra la limpieza de huérfanas.
 */
const imageMutation = durableMutation(itemMutationKey('image'), (queryClient) => ({
  ...OFFLINE_TOLERANT,
  mutationFn: (change: ImageChange) => {
    if (change.type === 'add') {
      return insertImages(change.images.map((image) => ({ ...image, item_id: change.item.id })))
    }
    if (change.type === 'update') return updateImage(change.imageId, change.patch)
    return deleteImage(change.imageId)
  },
  onMutate: (change) => {
    const update = (items: Item[]) =>
      items.map((entry) =>
        entry.id === change.item.id ? withImages(entry, imagesAfter(entry.images, change)) : entry,
      )
    return applyOptimistic(queryClient, {
      items: { [change.item.listId]: update },
      mixed: update,
    })
  },
  onError: (error, _change, snapshot) => {
    rollback(queryClient, snapshot, `No se ha podido guardar la foto. ${errorMessage(error)}`)
  },
  onSuccess: (_data, change) => {
    // La foto quitada o cambiada puede haberse quedado sin nadie que la use (2.8).
    if (change.type !== 'add') schedulePhotoCleanup()
  },
  onSettled: () => {
    settle(queryClient)
  },
}))

export function useImageMutation() {
  return useDurableMutation(imageMutation)
}

/** Las mutaciones de ítems que se registran en el QueryClient (`setMutationDefaults`, 2.10). */
export const itemMutations = [
  createItemMutation,
  setItemStatusMutation,
  undoRepeatMutation,
  updateItemMutation,
  moveItemMutation,
  reorderItemsMutation,
  deleteItemMutation,
  insertItemsMutation,
  storeMutation,
  imageMutation,
]
