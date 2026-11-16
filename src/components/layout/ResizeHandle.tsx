import { useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'

import { cn } from '@/lib/utils'

interface ResizeHandleProps {
  /** «Ancho de la barra lateral». */
  label: string
  value: number
  min: number
  max: number
  /**
   * En qué borde está: `end`, el derecho de la barra lateral (a la derecha crece); `start`, el
   * izquierdo del panel de detalle (a la izquierda crece).
   */
  edge: 'start' | 'end'
  onChange: (value: number) => void
  /** Doble clic: el ancho de siempre. */
  onReset: () => void
}

/** Lo que se mueve con cada flecha; con ⇧, más. */
const STEP = 16
const BIG_STEP = 64

/**
 * El borde que se arrastra para cambiar el ancho de un panel (Fran, 2026-11-16): una franja de 8 px
 * sobre el borde, con el cursor de redimensionar y una línea índigo al pasar o con el foco. También
 * con el teclado (← →, ⇧ para ir más rápido, Inicio y Fin) y con doble clic vuelve al de siempre.
 */
export function ResizeHandle({
  label,
  value,
  min,
  max,
  edge,
  onChange,
  onReset,
}: ResizeHandleProps) {
  const start = useRef<{ x: number; value: number } | null>(null)
  const [dragging, setDragging] = useState(false)
  // A la derecha crece la barra lateral; a la izquierda, el panel.
  const sign = edge === 'end' ? 1 : -1

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return
    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    start.current = { x: event.clientX, value }
    setDragging(true)
  }
  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!start.current) return
    onChange(start.current.value + sign * (event.clientX - start.current.x))
  }
  const stop = (event: PointerEvent<HTMLDivElement>) => {
    if (!start.current) return
    start.current = null
    setDragging(false)
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
  }
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const step = event.shiftKey ? BIG_STEP : STEP
    const next =
      event.key === 'ArrowRight'
        ? value + sign * step
        : event.key === 'ArrowLeft'
          ? value - sign * step
          : event.key === 'Home'
            ? min
            : event.key === 'End'
              ? max
              : null
    if (next === null) return
    event.preventDefault()
    onChange(next)
  }

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label={label}
      aria-valuenow={value}
      aria-valuemin={min}
      aria-valuemax={max}
      tabIndex={0}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={stop}
      onPointerCancel={stop}
      onDoubleClick={onReset}
      onKeyDown={onKeyDown}
      className={cn(
        'group absolute inset-y-0 z-30 w-2 cursor-col-resize touch-none outline-none',
        edge === 'end' ? '-right-1' : '-left-1',
      )}
    >
      <span
        aria-hidden
        className={cn(
          'absolute inset-y-0 left-[3px] w-0.5 rounded-full bg-primary/60 opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100',
          dragging && 'opacity-100',
        )}
      />
      {/* Mientras se arrastra, el cursor y sin seleccionar texto en toda la página. */}
      {dragging && (
        <span aria-hidden className="fixed inset-0 z-50 cursor-col-resize select-none" />
      )}
    </div>
  )
}
