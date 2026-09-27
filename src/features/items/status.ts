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
] as const
export type ItemStatus = (typeof ITEM_STATUSES)[number]

/** Estados válidos de cada tipo; el primero es el inicial. */
export const STATUSES_BY_KIND: Record<ListKind, readonly ItemStatus[]> = {
  inbox: ['pending', 'done'],
  tasks: ['pending', 'in_progress', 'done'],
  shopping: ['pending', 'bought', 'discarded'],
  events: ['upcoming', 'cancelled'],
  custom: ['pending', 'done'],
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
}

export function isFinalStatus(status: ItemStatus): boolean {
  return FINAL_STATUSES.has(status)
}

export function isValidStatus(kind: ListKind, status: ItemStatus): boolean {
  return STATUSES_BY_KIND[kind].includes(status)
}

/** Estado con el que nace un ítem en una lista de ese tipo. */
export function initialStatus(kind: ListKind): ItemStatus {
  return STATUSES_BY_KIND[kind][0] ?? 'pending'
}

/** El primer estado final del tipo: el que pone el checkbox. */
function firstFinalStatus(kind: ListKind): ItemStatus {
  return STATUSES_BY_KIND[kind].find(isFinalStatus) ?? 'done'
}

/**
 * Qué pasa al tocar el checkbox (decisión anotada en 02 §Estados): cualquier estado sin terminar
 * pasa al primer final del tipo (en tareas, «En curso» también va a «Hecha») y cualquier final
 * vuelve al inicial. «En curso» no se pone con el checkbox: llega deslizando (1.9) o desde el
 * detalle (1.8).
 */
export function nextStatusOnToggle(kind: ListKind, status: ItemStatus): ItemStatus {
  return isFinalStatus(status) ? initialStatus(kind) : firstFinalStatus(kind)
}

/** Aspecto del checkbox: vacío (sin empezar), medio (en curso) o lleno (terminado). */
export type CheckboxState = 'empty' | 'half' | 'full'

export function checkboxState(status: ItemStatus): CheckboxState {
  if (isFinalStatus(status)) return 'full'
  return status === 'in_progress' ? 'half' : 'empty'
}

/**
 * Si el ítem va a «Fuera de la cabeza»: un estado final o, en eventos, uno pasado. Los eventos
 * pasados no se guardan como estado: `upcoming` sin repetición con la fecha ya pasada (03 §items),
 * la misma regla que la vista `list_counters`.
 */
export function isOutOfMind(
  item: { status: ItemStatus; dueAt: Date | null; recurrence: string | null },
  kind: ListKind,
  now: Date = new Date(),
): boolean {
  if (isFinalStatus(item.status)) return true
  return kind === 'events' && item.recurrence === null && item.dueAt !== null && item.dueAt < now
}
