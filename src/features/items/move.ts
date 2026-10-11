import type { ListKind } from '@/features/lists'

import { firstFinalStatus, initialStatus, isFinalStatus, isValidStatus } from './status'
import type { Item, ItemKind, ItemStatus } from './types'

/**
 * El estado de un ítem al cambiar de tipo (función `translate_item_status` de la base): si existe
 * también en el tipo nuevo, se queda; si no, lo terminado pasa al primer final del tipo y lo
 * demás, al inicial. Así el trigger nunca ve un estado que no admite el tipo.
 */
export function translateStatus(status: ItemStatus, to: ItemKind): ItemStatus {
  if (isValidStatus(to, status)) return status
  return isFinalStatus(status) ? firstFinalStatus(to) : initialStatus(to)
}

/** Los cambios que se escriben en `items` al mover (el cliente calcula; los triggers validan). */
export interface MovePatch {
  listId: string
  /**
   * La sublista de destino (2a.5), de la lista de destino; `null` si va suelto a la lista. Mover
   * a otra lista sin elegir sublista la saca de la suya (ADR-010), y «Sacar de Lisboa» es mover
   * a su misma lista con `null`.
   */
  parentId: string | null
  kind: ItemKind
  status: ItemStatus
  priority: Item['priority']
  dueAt: Date | null
  allDay: boolean
  recurrence: string | null
}

/**
 * Lleva un ítem a otra lista (ADR-012): conserva su tipo, su estado y todo lo suyo, también al
 * entrar o salir de «En mente». Solo la sublista cambia: en «En mente» no hay.
 */
export function buildMovePatch(
  item: Pick<Item, 'kind' | 'status' | 'priority' | 'dueAt' | 'allDay' | 'recurrence'>,
  to: { id: string; kind: ListKind },
  parentId: string | null = null,
): MovePatch {
  return {
    listId: to.id,
    parentId: to.kind === 'inbox' ? null : parentId,
    kind: item.kind,
    status: item.status,
    priority: item.priority,
    dueAt: item.dueAt,
    allDay: item.allDay,
    recurrence: item.recurrence,
  }
}
