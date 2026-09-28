import type { ItemStatus } from './status'
import type { Priority } from './fields'

export type { ItemStatus } from './status'
export type { Priority, TaskFields } from './fields'

/**
 * Un ítem de cualquier lista. Los campos promocionados de la tabla (`due_at`, `recurrence`…) van
 * como columnas; de `fields` (JSONB) solo se lee lo que el tipo usa hoy: la prioridad de las
 * tareas. El resto de campos llega con el detalle de cada tipo.
 */
export interface Item {
  id: string
  listId: string
  title: string
  notes: string | null
  status: ItemStatus
  /** Solo en tareas. */
  priority: Priority | null
  /** Fecha límite (tareas) o fecha del evento. */
  dueAt: Date | null
  allDay: boolean
  recurrence: string | null
  position: number
  /** La rellena el trigger al pasar a un estado final. */
  completedAt: Date | null
  createdAt: Date
  /** De qué «En mente» salió y cuándo (trigger `items_track_inbox`); `null` si no viene de una. */
  leftInboxId: string | null
  leftInboxAt: Date | null
}

/**
 * Algo que salió de «En mente» y vive ya en otra lista: la inbox lo enseña tachado en su «Fuera
 * de la cabeza», con «movida a Casa · lunes» (diseño 05).
 */
export interface MovedItem {
  id: string
  title: string
  listName: string
  movedAt: Date
}

/** Lo que se puede cambiar de un ítem desde su detalle, campo a campo. */
export interface ItemPatch {
  title?: string
  notes?: string | null
  priority?: Priority | null
  dueAt?: Date | null
  status?: ItemStatus
}
