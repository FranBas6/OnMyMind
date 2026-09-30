import { rowActions } from './rowActions'
import { STATUS_LABELS } from './status'
import type { ItemKind, ItemStatus } from './types'

/** Movimiento a partir del cual se decide si el gesto es horizontal (deslizar) o vertical (scroll). */
export const AXIS_LOCK_PX = 10
/** Umbral de una acción (06 §Interacción): cada tramo de la derecha y cada botón de la izquierda. */
export const SWIPE_STEP_PX = 80
/** Lo que se abre a la izquierda: los botones «Mover» y «Borrar», de 80 px cada uno. */
export const LEFT_OPEN_PX = SWIPE_STEP_PX * 2
/** Borde izquierdo reservado al gesto «atrás» de Safari: ahí no empieza ningún deslizar. */
export const EDGE_GUARD_PX = 24
/** Cuánto sigue al dedo más allá del último umbral (resistencia, 06 §Interacción). */
const RESISTANCE = 0.35

export type Axis = 'x' | 'y'

/**
 * Decide el eje en cuanto el dedo se ha movido `AXIS_LOCK_PX`: horizontal si ha ido más de lado
 * que hacia abajo. Hasta entonces, `null` (aún no se sabe).
 */
export function decideAxis(dx: number, dy: number, lock: number = AXIS_LOCK_PX): Axis | null {
  if (Math.hypot(dx, dy) < lock) return null
  return Math.abs(dx) > Math.abs(dy) ? 'x' : 'y'
}

/**
 * Desplazamiento de la fila para un desplazamiento del dedo: 1:1 hasta el límite de cada lado y,
 * pasado, con resistencia. Sin acciones a un lado, ese lado no se mueve.
 */
export function resist(offset: number, { right, left }: { right: number; left: number }): number {
  if (offset > 0) {
    if (right === 0) return 0
    return offset <= right ? offset : right + (offset - right) * RESISTANCE
  }
  if (left === 0) return 0
  const limit = -left
  return offset >= limit ? offset : limit + (offset - limit) * RESISTANCE
}

/** Una acción de la derecha: el estado al que lleva, su etiqueta y su color. */
export interface SwipeStatusAction {
  status: ItemStatus
  label: string
  tone: 'progress' | 'done' | 'reopen'
}

/**
 * Acciones de la derecha según el tipo y el estado (decisión de Fran en 1.9: dos tramos en
 * tareas). Una tarea pendiente tiene dos: a 80 px «En curso» y a 160 px «Hecha». En curso, solo
 * «Hecha». Lo terminado, volver a pendiente. Fuera de Tareas, un tramo: el final del tipo
 * («Hecha», «Comprado», «Cancelado»). Salen de `rowActions`, las mismas del menú de fila. Una
 * sublista se desliza como una tarea; pausada, «En curso» la reanuda.
 */
export function rightActions(kind: ItemKind, status: ItemStatus): SwipeStatusAction[] {
  // Pausar una sublista no se hace deslizando: se hace a propósito, desde el menú.
  const withStatus = rowActions(kind, status).filter(
    (action) => action.status !== undefined && action.id !== 'pause',
  )
  const finish = withStatus.find((action) => action.id === 'finish')
  const chosen = finish ? withStatus.filter((action) => action.id !== 'reopen') : withStatus
  return chosen.flatMap((action) =>
    action.status
      ? [
          {
            status: action.status,
            label: STATUS_LABELS[action.status],
            tone:
              action.id === 'progress' || action.id === 'resume'
                ? 'progress'
                : action.id === 'finish'
                  ? 'done'
                  : 'reopen',
          } satisfies SwipeStatusAction,
        ]
      : [],
  )
}

/** Qué tramo de la derecha está activo con la fila en `offset` (0 si ninguno). */
export function rightStage(offset: number, stages: number): number {
  if (offset < SWIPE_STEP_PX) return 0
  return Math.min(stages, Math.floor(offset / SWIPE_STEP_PX))
}

export type SwipeOutcome =
  { type: 'close' } | { type: 'status'; stage: number } | { type: 'open-left' }

/**
 * Qué pasa al soltar: a la derecha, pasado un umbral, se ejecuta ese tramo (y la fila vuelve); a
 * la izquierda, pasado el primer umbral, se queda abierta enseñando «Mover» y «Borrar», que se
 * tocan aparte; si no, vuelve a su sitio sin hacer nada.
 */
export function releaseOutcome(
  offset: number,
  { rightStages, hasLeft }: { rightStages: number; hasLeft: boolean },
): SwipeOutcome {
  const stage = rightStage(offset, rightStages)
  if (stage > 0) return { type: 'status', stage }
  if (hasLeft && offset <= -SWIPE_STEP_PX) return { type: 'open-left' }
  return { type: 'close' }
}
