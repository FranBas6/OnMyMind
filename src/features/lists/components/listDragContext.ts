import { createContext, use } from 'react'

/** Lo que necesita cada lista mientras se ordenan (2.9). Lo pone `ListsDnd`. */
export interface ListDrag {
  /** La que acaba de soltarse: un momento con fondo índigo suave. */
  settledId: string | null
  /** Tras arrastrar, el clic del navegador al soltar no abre la lista. */
  swallowsClick: () => boolean
}

export const ListDragContext = createContext<ListDrag | null>(null)

export function useListDrag(): ListDrag | null {
  return use(ListDragContext)
}

const SWALLOW_CLICK_MS = 600

/** Apunta cuándo se soltó (en un manejador, nunca al pintar). */
export function stampDrop(ref: { current: number }): void {
  ref.current = Date.now()
}

/** Si el clic llega justo después de soltar: es el del navegador, no uno de verdad. */
export function justDropped(ref: { current: number }): boolean {
  return Date.now() - ref.current < SWALLOW_CLICK_MS
}
