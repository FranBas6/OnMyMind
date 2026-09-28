import type { ListKind } from '@/features/lists'

import { initialStatus, isFinalStatus, isValidStatus, STATUSES_BY_KIND } from './status'
import type { Item, ItemStatus } from './types'

/** Qué guarda cada tipo además del título, las notas y el estado (02 §Tipo de lista). */
const KEEPS: Record<ListKind, { priority: boolean; dueAt: boolean }> = {
  inbox: { priority: false, dueAt: false },
  tasks: { priority: true, dueAt: true },
  shopping: { priority: false, dueAt: false },
  events: { priority: false, dueAt: true },
  custom: { priority: false, dueAt: false },
}

/**
 * Estado del ítem en la lista destino (03 §items): si el estado existe también allí, se queda
 * (una tarea en curso sigue en curso en otra lista de tareas); si no, lo terminado pasa al primer
 * estado final del destino y lo demás, a su estado inicial. Así el trigger nunca ve un estado que
 * no admite el tipo.
 */
export function translateStatus(status: ItemStatus, to: ListKind): ItemStatus {
  if (isValidStatus(to, status)) return status
  if (isFinalStatus(status)) return STATUSES_BY_KIND[to].find(isFinalStatus) ?? initialStatus(to)
  return initialStatus(to)
}

/** Lo que se pierde al mover: la línea de aviso de la hoja «Mover a…» (diseño 06). */
export interface MoveLoss {
  priority: boolean
  dueAt: boolean
}

export function moveLoss(item: Pick<Item, 'priority' | 'dueAt'>, to: ListKind): MoveLoss {
  return {
    priority: item.priority !== null && !KEEPS[to].priority,
    dueAt: item.dueAt !== null && !KEEPS[to].dueAt,
  }
}

/** «Se quitan la prioridad y la fecha.», «Se quita la prioridad.» o nada si no se pierde nada. */
export function moveLossLabel(loss: MoveLoss): string | null {
  if (loss.priority && loss.dueAt) return 'Se quitan la prioridad y la fecha.'
  if (loss.priority) return 'Se quita la prioridad.'
  if (loss.dueAt) return 'Se quita la fecha.'
  return null
}

/** Los cambios que se escriben en `items` al mover (el cliente limpia; el trigger valida). */
export interface MovePatch {
  listId: string
  status: ItemStatus
  priority: Item['priority']
  dueAt: Date | null
  allDay: boolean
  recurrence: string | null
}

/**
 * Traduce un ítem a otra lista: estado del tipo destino y fuera los campos que allí no existen
 * (a «En mente» se va sin prioridad ni fecha; a Eventos la fecha se conserva como fecha del
 * evento). La repetición solo vive en Eventos.
 */
export function buildMovePatch(
  item: Pick<Item, 'status' | 'priority' | 'dueAt' | 'allDay' | 'recurrence'>,
  to: { id: string; kind: ListKind },
): MovePatch {
  const keeps = KEEPS[to.kind]
  const dueAt = keeps.dueAt ? item.dueAt : null
  return {
    listId: to.id,
    status: translateStatus(item.status, to.kind),
    priority: keeps.priority ? item.priority : null,
    dueAt,
    allDay: dueAt === null ? false : item.allDay,
    recurrence: to.kind === 'events' ? item.recurrence : null,
  }
}
