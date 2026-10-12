import { initialStatus, isFinalStatus, STATUSES_BY_KIND } from './status'
import type { ItemKind, ItemStatus } from './types'

export type RowActionId =
  | 'progress'
  | 'reopen'
  | 'pause'
  | 'resume'
  | 'finish'
  | 'chooseOne'
  | 'choose'
  | 'rename'
  | 'duplicate'
  | 'move'
  | 'toTask'
  | 'copyText'
  | 'delete'

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
  /** Resaltada en la hoja de móvil, con una línea debajo que explica qué pasa («Elegir esta», A4). */
  highlight?: { note: string }
}

/** Lo que cambia el menú en una sublista «para elegir una» y en sus opciones (5.1, diseño 24). */
export interface RowActionsContext {
  /** La sublista es «para elegir una»: «Dejar de elegir una» en vez de «Elegir una». */
  chooseOne?: boolean
  /**
   * El ítem es una opción en juego de una sublista «para elegir una»; `chosen`, si ya es la elegida
   * (entonces se quita la elección).
   */
  option?: { note: string; chosen: boolean }
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
export function rowActions(
  kind: ItemKind,
  status: ItemStatus,
  context: RowActionsContext = {},
): RowAction[] {
  if (kind === 'sublist') return sublistActions(status, context.chooseOne ?? false)
  if (kind === 'note') return noteActions(context)

  const actions: RowAction[] = []
  // Una opción se elige arriba del todo (A4). Elegir solo la marca: comprarla o hacerla va con
  // las acciones de siempre (Fran, 2026-10-11).
  const { option } = context
  if (option) {
    actions.push(
      option.chosen
        ? { id: 'choose', label: 'Quitar elección', shortcut: 'L' }
        : { id: 'choose', label: 'Elegir esta', shortcut: 'L', highlight: { note: option.note } },
    )
  }
  const initial = initialStatus(kind)
  const final = STATUSES_BY_KIND[kind].find(isFinalStatus) ?? initial

  if (kind === 'task' && status === 'pending') {
    actions.push({ id: 'progress', label: 'Marcar en curso', shortcut: 'E', status: 'in_progress' })
  } else if (status !== initial) {
    actions.push({ id: 'reopen', label: REOPEN_LABEL[kind], shortcut: 'E', status: initial })
  }
  // La nota no se marca hecha (5.3): no tiene estado final.
  if (!isFinalStatus(status) && isFinalStatus(final)) {
    actions.push({ id: 'finish', label: FINISH_LABEL[kind], shortcut: 'H', status: final })
  }
  actions.push({ id: 'move', label: 'Mover a…', shortcut: 'M' })
  actions.push({ id: 'delete', label: 'Borrar', shortcut: '⌫' })
  return actions
}

/**
 * La nota no tiene estado (diseño 25, B11b): «Pasar a tarea», que le da casilla, «Mover a…»,
 * «Copiar el texto» y «Borrar». En una sublista «para elegir una», «Elegir esta» va arriba.
 */
function noteActions({ option }: RowActionsContext): RowAction[] {
  const actions: RowAction[] = []
  if (option) {
    actions.push(
      option.chosen
        ? { id: 'choose', label: 'Quitar elección', shortcut: 'L' }
        : { id: 'choose', label: 'Elegir esta', shortcut: 'L', highlight: { note: option.note } },
    )
  }
  actions.push({ id: 'toTask', label: 'Pasar a tarea', shortcut: 'T', hint: 'tendrá casilla' })
  actions.push({ id: 'move', label: 'Mover a…', shortcut: 'M' })
  actions.push({ id: 'copyText', label: 'Copiar el texto', shortcut: 'C' })
  actions.push({ id: 'delete', label: 'Borrar', shortcut: '⌫' })
  return actions
}

function sublistActions(status: ItemStatus, chooseOne: boolean): RowAction[] {
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
  // «Para elegir una» (5.1, diseño 24, A1): se activa y se quita aquí.
  actions.push(
    chooseOne
      ? {
          id: 'chooseOne',
          label: 'Dejar de elegir una',
          shortcut: 'L',
          hint: 'vuelve a sumar todo',
        }
      : { id: 'chooseOne', label: 'Elegir una', shortcut: 'L', hint: 'cuenta la más barata' },
  )
  actions.push({ id: 'rename', label: 'Renombrar', shortcut: 'R', separated: true })
  actions.push({ id: 'duplicate', label: 'Duplicar', shortcut: 'D' })
  actions.push({ id: 'move', label: 'Mover a…', shortcut: 'M' })
  actions.push({ id: 'delete', label: 'Borrar', shortcut: '⌫' })
  return actions
}
