import type { ListKind } from '@/features/lists'

/** Todos los estados que admite la base (trigger `items_validate`, documento 03 §items). */
export const ITEM_STATUSES = [
  'pending',
  'in_progress',
  'done',
  'bought',
  'discarded',
  'upcoming',
  'cancelled',
  'paused',
] as const
export type ItemStatus = (typeof ITEM_STATUSES)[number]

/**
 * Tipos de ítem (enum `item_kind`, ADR-009): el tipo es de cada ítem, no de su lista. `note` es lo
 * de «En mente», aún sin tipo; al moverse a otra lista toma el tipo por defecto de esa lista.
 * `sublist` es una sublista (ADR-010): un ítem que se abre y tiene cosas dentro (`parentId`).
 */
export const ITEM_KINDS = ['note', 'task', 'shopping', 'event', 'sublist'] as const
export type ItemKind = (typeof ITEM_KINDS)[number]

/** Estados válidos de cada tipo; el primero es el inicial (función `item_statuses` de la base). */
export const STATUSES_BY_KIND: Record<ItemKind, readonly ItemStatus[]> = {
  note: ['pending', 'done'],
  task: ['pending', 'in_progress', 'done'],
  shopping: ['pending', 'bought', 'discarded'],
  event: ['upcoming', 'cancelled'],
  sublist: ['pending', 'in_progress', 'paused', 'done'],
}

const DEFAULT_ITEM_KIND: Record<ListKind, ItemKind> = {
  inbox: 'note',
  tasks: 'task',
  shopping: 'shopping',
  events: 'event',
  custom: 'task',
}

/**
 * El tipo con el que nace un ítem en una lista (`lists.kind` es su tipo por defecto; función
 * `default_item_kind` de la base).
 */
export function defaultItemKind(listKind: ListKind): ItemKind {
  return DEFAULT_ITEM_KIND[listKind]
}

/** Estados finales: el trigger rellena `completed_at` y el ítem va a «Fuera de la cabeza». */
const FINAL_STATUSES: ReadonlySet<ItemStatus> = new Set([
  'done',
  'bought',
  'discarded',
  'cancelled',
])

export const STATUS_LABELS: Record<ItemStatus, string> = {
  pending: 'Pendiente',
  in_progress: 'En curso',
  done: 'Hecha',
  bought: 'Comprado',
  discarded: 'Descartado',
  upcoming: 'Próximo',
  cancelled: 'Cancelado',
  paused: 'Pausada',
}

/**
 * Si lo de dentro de una sublista cuenta: solo mientras está pendiente o en curso. Pausada o
 * hecha, se calla en Hoy y en los contadores (ADR-010; función `is_active_sublist_status`).
 */
export function isActiveSublistStatus(status: string): boolean {
  return status === 'pending' || status === 'in_progress'
}

export function isFinalStatus(status: ItemStatus): boolean {
  return FINAL_STATUSES.has(status)
}

export function isValidStatus(kind: ItemKind, status: ItemStatus): boolean {
  return STATUSES_BY_KIND[kind].includes(status)
}

/** Estado con el que nace un ítem de ese tipo. */
export function initialStatus(kind: ItemKind): ItemStatus {
  return STATUSES_BY_KIND[kind][0] ?? 'pending'
}

/** Tipo y estado de un ítem recién creado en una lista: los de su tipo por defecto. */
export function newItemKindAndStatus(listKind: ListKind): { kind: ItemKind; status: ItemStatus } {
  const kind = defaultItemKind(listKind)
  return { kind, status: initialStatus(kind) }
}

/** El primer estado final del tipo: el que pone el checkbox. */
export function firstFinalStatus(kind: ItemKind): ItemStatus {
  return STATUSES_BY_KIND[kind].find(isFinalStatus) ?? 'done'
}

/**
 * Qué pasa al tocar el checkbox (decisión anotada en 02 §Estados): cualquier estado sin terminar
 * pasa al primer final del tipo (en tareas, «En curso» también va a «Hecha») y cualquier final
 * vuelve al inicial. «En curso» no se pone con el checkbox: llega deslizando (1.9) o desde el
 * detalle (1.8).
 */
export function nextStatusOnToggle(kind: ItemKind, status: ItemStatus): ItemStatus {
  return isFinalStatus(status) ? initialStatus(kind) : firstFinalStatus(kind)
}

/**
 * Aspecto del checkbox: vacío (sin empezar), medio (en curso), lleno (terminado) o con una × en
 * gris (descartado o cancelado: terminado sin hacerse, diseño 08).
 */
export type CheckboxState = 'empty' | 'half' | 'full' | 'crossed'

export function checkboxState(status: ItemStatus): CheckboxState {
  if (status === 'discarded' || status === 'cancelled') return 'crossed'
  if (isFinalStatus(status)) return 'full'
  return status === 'in_progress' ? 'half' : 'empty'
}

/**
 * Si el ítem va a «Fuera de la cabeza»: un estado final o, en eventos, uno pasado. Los eventos
 * pasados no se guardan como estado: `upcoming` sin repetición con la fecha ya pasada (03 §items),
 * la misma regla que la vista `list_counters`.
 */
export function isOutOfMind(
  item: { kind: ItemKind; status: ItemStatus; dueAt: Date | null; recurrence: string | null },
  now: Date = new Date(),
): boolean {
  if (isFinalStatus(item.status)) return true
  return (
    item.kind === 'event' && item.recurrence === null && item.dueAt !== null && item.dueAt < now
  )
}
