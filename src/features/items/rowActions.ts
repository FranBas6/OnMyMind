import { initialStatus, isFinalStatus, STATUSES_BY_KIND } from './status'
import type { ItemKind, ItemStatus } from './types'

export type RowActionId =
  'progress' | 'reopen' | 'pause' | 'resume' | 'finish' | 'rename' | 'duplicate' | 'move' | 'delete'

export interface RowAction {
  id: RowActionId
  label: string
  /** Atajo de una letra del menú de escritorio (diseño 06, D8). */
  shortcut: string
  /** El estado al que lleva, si es una acción de estado. */
  status?: ItemStatus
  /** Lo que pasa, a la derecha en la hoja de móvil («Deja de salir en Hoy», diseño 12, S4). */
  hint?: string
  /** Empieza un grupo nuevo, tras un filete (en la sublista: estado · edición · borrar). */
  separated?: boolean
}

const FINISH_LABEL: Record<ItemKind, string> = {
  note: 'Hecha',
  task: 'Hecha',
  shopping: 'Comprado',
  event: 'Cancelado',
  sublist: 'Hecha',
}

const REOPEN_LABEL: Record<ItemKind, string> = {
  note: 'Marcar pendiente',
  task: 'Marcar pendiente',
  shopping: 'Marcar pendiente',
  event: 'Marcar próximo',
  sublist: 'Marcar pendiente',
}

/**
 * Acciones del menú de una fila (diseño 06, T9 y D8), la alternativa accesible a deslizar. En
 * tareas, la primera alterna «Marcar en curso» y «Marcar pendiente» según el estado; después
 * «Hecha» (o el final del tipo) si aún no lo está, «Mover a…» y «Borrar». La sublista (diseño 12,
 * S4) ordena estado (con «Pausar» o «Reanudar», que la deja en curso), edición («Renombrar»,
 * «Duplicar», «Mover a…») y «Borrar».
 */
export function rowActions(kind: ItemKind, status: ItemStatus): RowAction[] {
  if (kind === 'sublist') return sublistActions(status)

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

function sublistActions(status: ItemStatus): RowAction[] {
  const actions: RowAction[] = []
  if (status === 'pending') {
    actions.push({ id: 'progress', label: 'Marcar en curso', shortcut: 'E', status: 'in_progress' })
  } else if (status !== 'paused') {
    actions.push({ id: 'reopen', label: 'Marcar pendiente', shortcut: 'E', status: 'pending' })
  }
  if (status === 'pending' || status === 'in_progress') {
    const hint = 'Deja de salir en Hoy'
    actions.push({ id: 'pause', label: 'Pausar', shortcut: 'P', status: 'paused', hint })
  }
  if (status === 'paused') {
    actions.push({ id: 'resume', label: 'Reanudar', shortcut: 'P', status: 'in_progress' })
  }
  if (status !== 'done') {
    actions.push({ id: 'finish', label: 'Hecha', shortcut: 'H', status: 'done' })
  }
  actions.push({ id: 'rename', label: 'Renombrar', shortcut: 'R', separated: true })
  actions.push({ id: 'duplicate', label: 'Duplicar', shortcut: 'D' })
  actions.push({ id: 'move', label: 'Mover a…', shortcut: 'M' })
  actions.push({ id: 'delete', label: 'Borrar', shortcut: '⌫' })
  return actions
}
