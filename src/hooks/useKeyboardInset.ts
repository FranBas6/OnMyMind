import { useSyncExternalStore } from 'react'

/**
 * Cuánto tapa el teclado por abajo, en píxeles (0 si no hay teclado o no aplica).
 *
 * En iOS el teclado no encoge la página: el *layout viewport* sigue igual de alto y el teclado se
 * pone encima, así que algo con `position: fixed; bottom: 0` queda detrás. `visualViewport`
 * describe lo que de verdad se ve: al salir el teclado baja su `height` (y `offsetTop` dice
 * cuánto se ha desplazado la vista). El hueco tapado es lo que falta hasta el alto de la ventana.
 * Se escucha `resize` y `scroll` porque iOS cambia las dos cosas al abrir y cerrar el teclado.
 */
function read(): number {
  const viewport = window.visualViewport
  if (!viewport) return 0
  const covered = window.innerHeight - (viewport.height + viewport.offsetTop)
  // Menos de un par de píxeles es redondeo, no un teclado.
  return covered > 2 ? Math.round(covered) : 0
}

function subscribe(onChange: () => void): () => void {
  const viewport = window.visualViewport
  if (!viewport) return () => undefined
  viewport.addEventListener('resize', onChange)
  viewport.addEventListener('scroll', onChange)
  return () => {
    viewport.removeEventListener('resize', onChange)
    viewport.removeEventListener('scroll', onChange)
  }
}

export function useKeyboardInset(): number {
  return useSyncExternalStore(subscribe, read, () => 0)
}
