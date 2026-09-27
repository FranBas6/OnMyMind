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
}
