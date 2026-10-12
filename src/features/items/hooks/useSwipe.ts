import { useRef, useState, type MouseEvent, type PointerEvent } from 'react'

import {
  decideAxis,
  EDGE_GUARD_PX,
  LEFT_OPEN_PX,
  releaseOutcome,
  resist,
  SWIPE_STEP_PX,
  type Axis,
} from '../swipe'

interface UseSwipeOptions {
  /** Tramos de la derecha (0 = no se desliza a la derecha). */
  rightStages: number
  /** Si hay botones a la izquierda («Mover» y «Borrar»). */
  hasLeft: boolean
  /** Si la fila está abierta a la izquierda (lo lleva quien la usa: solo una abierta a la vez). */
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Al soltar pasado un tramo de la derecha. */
  onStage: (stage: number) => void
  /** Cuando el gesto se confirma como horizontal (p. ej., para cerrar otra fila abierta). */
  onDragStart?: () => void
  /** Mientras la fila está levantada para ordenarla (2.9), solo cuenta el arrastre vertical. */
  disabled?: boolean
  /**
   * Sin tramos a la derecha, la fila asoma igual un poco y vuelve sola: una nota enseña «Las notas
   * no tienen estado» (diseño 25, B11).
   */
  peekRight?: boolean
}

/** Lo que asoma una fila sin acciones a la derecha: va más despacio que el dedo y no pasa de aquí. */
const PEEK_RATIO = 0.6
const PEEK_MAX_PX = 220

interface Gesture {
  pointerId: number
  x: number
  y: number
  /** Dónde estaba la fila al empezar (abierta o cerrada). */
  base: number
  axis: Axis | null
}

/**
 * Deslizar una fila con pointer events, sin librería (04 §Gestos). Solo con el dedo o el lápiz:
 * con ratón no se desliza (en escritorio está el menú ···). Nada empieza en los 24 px del borde
 * izquierdo, que son del gesto «atrás» de Safari. Hasta moverse 10 px no se sabe si es deslizar o
 * scroll; si es scroll, se suelta y el navegador sigue (la fila tiene `touch-action: pan-y`). Si
 * es deslizar, se captura el puntero para recibir el final aunque el dedo salga de la fila.
 */
export function useSwipe({
  rightStages,
  hasLeft,
  open,
  onOpenChange,
  onStage,
  onDragStart,
  disabled = false,
  peekRight = false,
}: UseSwipeOptions) {
  const [drag, setDrag] = useState<number | null>(null)
  const gesture = useRef<Gesture | null>(null)
  const last = useRef(0)
  // Tras arrastrar, el navegador aún manda un «click» al soltar: no debe abrir el detalle.
  const swallowClick = useRef(false)

  const base = open ? -LEFT_OPEN_PX : 0
  const limits = { right: rightStages * SWIPE_STEP_PX, left: hasLeft ? LEFT_OPEN_PX : 0 }

  const reset = () => {
    gesture.current = null
    setDrag(null)
  }

  const onPointerDown = (event: PointerEvent<HTMLElement>) => {
    if (event.pointerType === 'mouse' || !event.isPrimary) return
    if (event.clientX < EDGE_GUARD_PX) return
    gesture.current = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      base,
      axis: null,
    }
  }

  const onPointerMove = (event: PointerEvent<HTMLElement>) => {
    const current = gesture.current
    if (current?.pointerId !== event.pointerId) return
    if (disabled) {
      reset()
      return
    }
    const dx = event.clientX - current.x
    const dy = event.clientY - current.y

    if (current.axis === null) {
      current.axis = decideAxis(dx, dy)
      if (current.axis === null) return
      if (current.axis === 'y') {
        // Es scroll: la fila no hace nada y el navegador se encarga (`touch-action: pan-y`).
        gesture.current = null
        return
      }
      event.currentTarget.setPointerCapture(event.pointerId)
      swallowClick.current = true
      onDragStart?.()
    }

    const wanted = current.base + dx
    last.current =
      peekRight && rightStages === 0 && wanted > 0
        ? Math.min(wanted * PEEK_RATIO, PEEK_MAX_PX)
        : resist(wanted, limits)
    setDrag(last.current)
  }

  const onPointerUp = (event: PointerEvent<HTMLElement>) => {
    const current = gesture.current
    if (current?.pointerId !== event.pointerId) return
    const dragged = current.axis === 'x'
    reset()
    if (!dragged) return

    const outcome = releaseOutcome(last.current, { rightStages, hasLeft })
    if (outcome.type === 'status') {
      onOpenChange(false)
      onStage(outcome.stage)
    } else {
      onOpenChange(outcome.type === 'open-left')
    }
  }

  const onClickCapture = (event: MouseEvent) => {
    if (swallowClick.current) {
      swallowClick.current = false
      event.preventDefault()
      event.stopPropagation()
      return
    }
    // Tocar una fila abierta la cierra, en vez de abrir su detalle.
    if (open) {
      event.preventDefault()
      event.stopPropagation()
      onOpenChange(false)
    }
  }

  return {
    /** Desplazamiento actual de la fila: siguiendo al dedo, abierta o en su sitio. */
    offset: drag ?? base,
    dragging: drag !== null,
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerCancel: reset,
      onClickCapture,
    },
  }
}
