/**
 * Copiar de una nota protegida (5.7, diseño 26, C8c): el portapapeles se borra a los 30 s.
 *
 * Safari solo deja escribir en el portapapeles durante un gesto (un toque, una tecla). Si a los
 * 30 s no se puede, se borra en el siguiente toque o tecla dentro de la app.
 */

/** «Se borra del portapapeles en 30 s.» */
export const CLEAR_CLIPBOARD_MS = 30_000

let timer: ReturnType<typeof setTimeout> | undefined
let onNextGesture: (() => void) | null = null
let ours = false

function forgetGesture() {
  if (!onNextGesture) return
  document.removeEventListener('pointerdown', onNextGesture, true)
  document.removeEventListener('keydown', onNextGesture, true)
  onNextGesture = null
}

async function clear() {
  timer = undefined
  if (!ours) return
  try {
    await navigator.clipboard.writeText('')
    ours = false
  } catch {
    forgetGesture()
    onNextGesture = () => {
      forgetGesture()
      if (!ours) return
      ours = false
      void navigator.clipboard.writeText('').catch(() => undefined)
    }
    document.addEventListener('pointerdown', onNextGesture, true)
    document.addEventListener('keydown', onNextGesture, true)
  }
}

/** Lo copiado de una protegida se borra a los 30 s (también si se copió seleccionando). */
export function clearClipboardLater(): void {
  clearTimeout(timer)
  forgetGesture()
  ours = true
  timer = setTimeout(() => void clear(), CLEAR_CLIPBOARD_MS)
}

/** Copia texto de una nota protegida y lo borra a los 30 s. `false` si no se ha podido copiar. */
export async function copySecret(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
  } catch {
    return false
  }
  clearClipboardLater()
  return true
}
