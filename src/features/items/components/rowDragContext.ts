import { createContext, use } from 'react'

/**
 * Lo que necesita cada fila mientras se ordena (2.9, diseño 14). Lo pone `SortableRows`: solo las
 * filas que están dentro (y en `ids`) se pueden levantar.
 */
export interface RowDrag {
  ids: readonly string[]
  /** La que acaba de soltarse: medio segundo con fondo índigo suave (R7). */
  settledId: string | null
  /** Tras arrastrar, el clic que manda el navegador al soltar no debe abrir el detalle. */
  swallowsClick: () => boolean
}

export const RowDragContext = createContext<RowDrag | null>(null)

/**
 * Dentro de la copia levantada (`DragOverlay`): se pinta crecida y con sombra, sin arrastre propio.
 * Con el teclado lleva además el borde índigo (diseño 14, D4). Fuera, `null`.
 */
export const LiftedRowContext = createContext<'pointer' | 'keyboard' | null>(null)

export function useRowDrag(): RowDrag | null {
  return use(RowDragContext)
}
