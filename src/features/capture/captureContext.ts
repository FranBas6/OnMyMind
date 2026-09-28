import { createContext, use } from 'react'

export interface OpenCaptureOptions {
  /** Texto con el que se abre (la ruta `/add?text=…`). */
  text?: string
}

export interface CaptureApi {
  /** Abre la captura. Si se abre dentro de una lista, esa sale elegida (decisión de Fran, 1.10). */
  open: (options?: OpenCaptureOptions) => void
  isOpen: boolean
}

export const CaptureContext = createContext<CaptureApi | null>(null)

/** La captura rápida: el botón +, el atajo, el botón del sidebar y `/add` la abren con esto. */
export function useCapture(): CaptureApi {
  const capture = use(CaptureContext)
  if (!capture) throw new Error('useCapture necesita un CaptureProvider por encima')
  return capture
}
