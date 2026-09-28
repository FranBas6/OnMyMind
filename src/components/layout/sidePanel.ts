import { createContext, use } from 'react'

/**
 * Hueco del panel lateral derecho en escritorio (diseño 06: el detalle de un ítem, 420 px). Lo
 * pone `AppShell` como tercera columna de su rejilla, así la lista se estrecha en vez de quedar
 * tapada; quien quiera pintar ahí lo hace con un portal a este nodo. En móvil es `null`.
 */
export const SidePanelContext = createContext<HTMLElement | null>(null)

export function useSidePanel(): HTMLElement | null {
  return use(SidePanelContext)
}
