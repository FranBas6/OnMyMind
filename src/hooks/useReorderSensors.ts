import {
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type Announcements,
  type Modifier,
  type ScreenReaderInstructions,
} from '@dnd-kit/core'
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable'

/**
 * Ordenar arrastrando (sesión 2.9, diseño 14). En el dedo, mantener pulsado 0,4 s levanta (la fila
 * se hunde mientras esperas); si te mueves más de 8 px antes, no: es deslizar o scroll. Con el
 * ratón, arrastrar 6 px (un clic sigue abriendo). Con teclado, Espacio levanta, ↑ ↓ mueven, Espacio
 * suelta y Esc cancela. Ratón y dedo van con sus propios eventos (no `pointer`), así no chocan con
 * el deslizar de las filas, que usa `pointer`.
 */
export const LIFT_DELAY_MS = 400
export const LIFT_TOLERANCE_PX = 8

export function useReorderSensors() {
  return useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: LIFT_DELAY_MS, tolerance: LIFT_TOLERANCE_PX },
    }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )
}

/** Las filas solo suben y bajan. */
export const restrictToVerticalAxis: Modifier = ({ transform }) => ({ ...transform, x: 0 })

/** Si quien arrastra empezó con el dedo (soltar sin mover abre el menú, diseño 14, R4). */
export function isTouchStart(event: Event): boolean {
  return typeof TouchEvent !== 'undefined' && event instanceof TouchEvent
}

/** Si empezó con el teclado (sale la barra de las teclas, D4). */
export function isKeyboardStart(event: Event): boolean {
  return event instanceof KeyboardEvent
}

/** Un toque de vibración al levantar (R3). Safari en el iPhone no la tiene: no pasa nada. */
export function liftHaptic(): void {
  try {
    navigator.vibrate(12)
  } catch {
    // Sin vibración.
  }
}

export const REORDER_INSTRUCTIONS: ScreenReaderInstructions = {
  draggable:
    'Para ordenar, pulsa Espacio para levantar, muévelo con las flechas arriba y abajo, Espacio para soltar y Escape para cancelar.',
}

/**
 * Lo que dicen los lectores de pantalla al ordenar. `label` es el nombre de lo que se mueve
 * (`data.label` de cada elemento) y `position` su sitio entre los que se ven.
 */
export function reorderAnnouncements(
  ids: readonly string[],
  label: (id: string) => string,
): Announcements {
  const at = (id: string | number) => `${ids.indexOf(String(id)) + 1} de ${ids.length}`
  return {
    onDragStart: ({ active }) =>
      `«${label(String(active.id))}» levantada. Posición ${at(active.id)}.`,
    onDragOver: ({ active, over }) =>
      over ? `«${label(String(active.id))}» en la posición ${at(over.id)}.` : undefined,
    onDragEnd: ({ active, over }) =>
      over
        ? `«${label(String(active.id))}» soltada en la posición ${at(over.id)}.`
        : `«${label(String(active.id))}» vuelve a su sitio.`,
    onDragCancel: ({ active }) => `Cancelado. «${label(String(active.id))}» vuelve a su sitio.`,
  }
}
