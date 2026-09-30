import type { ListKind } from '@/features/lists'

import {
  defaultItemKind,
  firstFinalStatus,
  initialStatus,
  isFinalStatus,
  isValidStatus,
} from './status'
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

/**
 * El tipo de un ítem tras moverlo (ADR-009, decisiones del plan 02a). «En mente» es siempre «sin
 * tipo»: lo que entra vuelve a ser `note` y lo que sale toma el tipo por defecto de su destino.
 * Entre listas normales el tipo no cambia. Es la misma regla que el trigger `items_adopt_kind`.
 */
export function kindAfterMove(kind: ItemKind, to: ListKind): ItemKind {
  if (to === 'inbox') return 'note'
  return kind === 'note' ? defaultItemKind(to) : kind
}

/** Lo que se pierde al mover: la línea de aviso de la hoja «Mover a…» (diseño 06). */
export interface MoveLoss {
  /** El tipo que deja de tener («Compra»): solo al volver a «En mente», que es «sin tipo». */
  kind: string | null
  priority: boolean
  dueAt: boolean
}

/**
 * Solo se pierde algo al volver a «En mente», que no guarda tipo, prioridad ni fecha. Entre listas
 * normales el ítem conserva su tipo y todo lo suyo. El tipo solo se avisa en compras y eventos
 * (diseño 12, A5: «Se quita el tipo Compra»): una tarea se ve igual en «En mente», y lo que pierde
 * lo dicen la prioridad y la fecha, como hasta ahora.
 */
export function moveLoss(item: Pick<Item, 'kind' | 'priority' | 'dueAt'>, to: ListKind): MoveLoss {
  const toInbox = to === 'inbox'
  const kindLabel: Partial<Record<Item['kind'], string>> = { shopping: 'Compra', event: 'Evento' }
  return {
    kind: toInbox ? (kindLabel[item.kind] ?? null) : null,
    priority: toInbox && item.priority !== null,
    dueAt: toInbox && item.dueAt !== null,
  }
}

/**
 * «Se quitan la prioridad y la fecha.», «Se quita el tipo Compra.», «Se quitan el tipo Evento y
 * la fecha.» o nada si no se pierde nada.
 */
export function moveLossLabel(loss: MoveLoss): string | null {
  const parts = [
    loss.kind && `el tipo ${loss.kind}`,
    loss.priority && 'la prioridad',
    loss.dueAt && 'la fecha',
  ].filter((part): part is string => typeof part === 'string')
  if (parts.length === 0) return null
  const list =
    parts.length === 1 ? parts.join('') : `${parts.slice(0, -1).join(', ')} y ${parts.at(-1) ?? ''}`
  return `${parts.length === 1 ? 'Se quita' : 'Se quitan'} ${list}.`
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
 * Lleva un ítem a otra lista. Conserva su tipo, salvo al entrar o salir de «En mente», donde el
 * estado se traduce («leche» a Compras es una compra; una tarea en curso llega a «En mente»
 * pendiente). A «En mente» se va sin prioridad, fecha ni repetición.
 */
export function buildMovePatch(
  item: Pick<Item, 'kind' | 'status' | 'priority' | 'dueAt' | 'allDay' | 'recurrence'>,
  to: { id: string; kind: ListKind },
  parentId: string | null = null,
): MovePatch {
  const kind = kindAfterMove(item.kind, to.kind)
  const toInbox = to.kind === 'inbox'
  return {
    listId: to.id,
    parentId: toInbox ? null : parentId,
    kind,
    status: kind === item.kind ? item.status : translateStatus(item.status, kind),
    priority: toInbox ? null : item.priority,
    dueAt: toInbox ? null : item.dueAt,
    allDay: toInbox ? false : item.allDay,
    recurrence: toInbox ? null : item.recurrence,
  }
}
