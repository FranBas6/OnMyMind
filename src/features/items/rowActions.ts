import { initialStatus, isFinalStatus, STATUSES_BY_KIND } from './status'
import type { ItemKind, ItemStatus } from './types'

export type RowActionId = 'progress' | 'reopen' | 'finish' | 'move' | 'delete'

export interface RowAction {
  id: RowActionId
  label: string
  /** Atajo de una letra del menú de escritorio (diseño 06, D8). */
  shortcut: string
  /** El estado al que lleva, si es una acción de estado. */
  status?: ItemStatus
}

const FINISH_LABEL: Record<ItemKind, string> = {
  note: 'Hecha',
  task: 'Hecha',
  shopping: 'Comprado',
  event: 'Cancelado',
}

const REOPEN_LABEL: Record<ItemKind, string> = {
  note: 'Marcar pendiente',
  task: 'Marcar pendiente',
  shopping: 'Marcar pendiente',
  event: 'Marcar próximo',
}

/**
 * Acciones del menú de una fila (diseño 06, T9 y D8), la alternativa accesible a deslizar. En
 * tareas, la primera alterna «Marcar en curso» y «Marcar pendiente» según el estado; después
 * «Hecha» (o el final del tipo) si aún no lo está, «Mover a…» y «Borrar».
 */
export function rowActions(kind: ItemKind, status: ItemStatus): RowAction[] {
  const actions: RowAction[] = []
  const initial = initialStatus(kind)
  const final = STATUSES_BY_KIND[kind].find(isFinalStatus) ?? initial

  if (kind === 'task' && status === 'pending') {
    actions.push({ id: 'progress', label: 'Marcar en curso', shortcut: 'E', status: 'in_progress' })
  } else if (status !== initial) {
    actions.push({ id: 'reopen', label: REOPEN_LABEL[kind], shortcut: 'E', status: initial })
  }
  if (!isFinalStatus(status)) {
    actions.push({ id: 'finish', label: FINISH_LABEL[kind], shortcut: 'H', status: final })
  }
  actions.push({ id: 'move', label: 'Mover a…', shortcut: 'M' })
  actions.push({ id: 'delete', label: 'Borrar', shortcut: '⌫' })
  return actions
}
