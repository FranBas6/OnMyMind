import type { ItemKind, ItemStatus } from './status'
import type { Priority } from './fields'

export type { ItemKind, ItemStatus } from './status'
export type { Priority, TaskFields } from './fields'

/**
 * Un ítem de cualquier lista. Los campos promocionados de la tabla (`due_at`, `recurrence`…) van
 * como columnas; de `fields` (JSONB) solo se lee lo que el tipo usa hoy: la prioridad de las
 * tareas. El resto de campos llega con el detalle de cada tipo.
 */
export interface Item {
  id: string
  listId: string
  /** El tipo es del ítem, no de la lista (ADR-009): una lista puede mezclar tipos. */
  kind: ItemKind
  /** La sublista en la que está (ADR-010), de su misma lista; `null` si está suelta en la lista. */
  parentId: string | null
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
  /** Su enlace (2a.6, diseño 15), de cualquier tipo. */
  url: string | null
  /** El título de la página: `null` si aún no se ha buscado; `''` si la página no da ninguno. */
  urlTitle: string | null
  /** La imagen de la página enlazada («De la web»), sin descargar. */
  imageUrl: string | null
  /** Su foto propia en Storage (`item-images`); si la hay, manda sobre `imageUrl`. */
  imagePath: string | null
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
  /** Cambiar el tipo (fila «Tipo», `changeKindPatch`): llega con su estado traducido. */
  kind?: ItemKind
  /** Se quita al pasar a un tipo que no la usa (y vuelve si el cambio falla). */
  recurrence?: string | null
  /** La foto y el enlace (2a.6): se guardan como el resto, campo a campo. */
  url?: string | null
  urlTitle?: string | null
  imageUrl?: string | null
  imagePath?: string | null
}
