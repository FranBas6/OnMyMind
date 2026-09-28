import { useEffect } from 'react'

/**
 * Atajo global de la captura: ⌘⇧Espacio (Ctrl+⇧+Espacio fuera de Mac). Se mira `event.code`,
 * no `event.key`, porque con ⇧ pulsado la tecla ya no se llama « ». Si el navegador o macOS se
 * lo quedan antes de que llegue a la página, el plan prevé cambiarlo por ⌘J.
 */
export function useCaptureShortcut(onShortcut: () => void) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code !== 'Space' || !event.shiftKey || !(event.metaKey || event.ctrlKey)) return
      event.preventDefault()
      onShortcut()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [onShortcut])
}
