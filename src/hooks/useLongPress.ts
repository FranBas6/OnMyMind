import { useCallback, useRef, type MouseEvent, type PointerEvent } from 'react'

const HOLD_MS = 500
const MOVE_TOLERANCE_PX = 10

/**
 * Pulsación larga táctil (500 ms sin moverse más de 10 px). Devuelve manejadores para el elemento.
 * Si la pulsación llega a completarse, anula el clic que viene después, para que abrir el menú de
 * una tarjeta no navegue además a la lista. Con ratón no hace nada: ahí está el botón ···.
 */
export function useLongPress(onLongPress: () => void) {
  const timer = useRef<number | undefined>(undefined)
  const start = useRef<{ x: number; y: number } | null>(null)
  const fired = useRef(false)

  const cancel = useCallback(() => {
    window.clearTimeout(timer.current)
    start.current = null
  }, [])

  const onPointerDown = useCallback(
    (event: PointerEvent) => {
      if (event.pointerType !== 'touch') return
      fired.current = false
      start.current = { x: event.clientX, y: event.clientY }
      timer.current = window.setTimeout(() => {
        fired.current = true
        onLongPress()
      }, HOLD_MS)
    },
    [onLongPress],
  )

  const onPointerMove = useCallback(
    (event: PointerEvent) => {
      if (!start.current) return
      const moved = Math.hypot(event.clientX - start.current.x, event.clientY - start.current.y)
      if (moved > MOVE_TOLERANCE_PX) cancel()
    },
    [cancel],
  )

  const onClickCapture = useCallback((event: MouseEvent) => {
    if (!fired.current) return
    fired.current = false
    event.preventDefault()
    event.stopPropagation()
  }, [])

  return {
    onPointerDown,
    onPointerMove,
    onPointerUp: cancel,
    onPointerCancel: cancel,
    onPointerLeave: cancel,
    onClickCapture,
    // Sin menú contextual del sistema ni vista previa de enlace de iOS al mantener pulsado.
    onContextMenu: (event: MouseEvent) => {
      if (fired.current || start.current) event.preventDefault()
    },
  }
}
