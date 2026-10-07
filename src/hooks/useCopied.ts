import { useCallback, useEffect, useRef, useState } from 'react'

/** Lo que dura «Copiado» en el botón antes de volver a «Copiar enlace» (diseños 20, S4, y 21, C3). */
const COPIED_MS = 2000

/** `[copied, markCopied]`: «Copiado» durante dos segundos tras copiar; otra copia los reinicia. */
export function useCopied(): [boolean, () => void] {
  const [copied, setCopied] = useState(false)
  const timer = useRef<number | undefined>(undefined)

  useEffect(
    () => () => {
      window.clearTimeout(timer.current)
    },
    [],
  )

  const markCopied = useCallback(() => {
    setCopied(true)
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => {
      setCopied(false)
    }, COPIED_MS)
  }, [])

  return [copied, markCopied]
}
