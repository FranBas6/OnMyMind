import { useIsMutating } from '@tanstack/react-query'
import { Check, WifiOff } from 'lucide-react'
import { useEffect, useState } from 'react'

import { useOnline } from '@/hooks/useOnline'
import { isPendingChange } from '@/lib/flushMutations'
import { cn } from '@/lib/utils'

/** Lo que se queda la banda verde de «Ya hay conexión» (diseño 10, I6). */
const BACK_ONLINE_MS = 3000

const sentLabel = (count: number) =>
  `Ya hay conexión · ${count} ${count === 1 ? 'cambio enviado' : 'cambios enviados'}`

/**
 * «Sin conexión» (diseño 10, I4–I6 y D1). En móvil, una banda gris de 40 px dentro del contenido,
 * encima de la cabecera: empuja la pantalla, no tapa nada y no compite con el + ni con la captura.
 * En escritorio, en el pie del sidebar. Si hay cambios esperando, lo dice («2 por enviar»). Al
 * volver la red, si había algo pendiente, pasa a verde tres segundos cuando ya se ha enviado
 * («Ya hay conexión · 2 cambios enviados»); si no, se va sin más.
 */
export function OfflineBanner({ variant }: { variant: 'page' | 'sidebar' }) {
  const online = useOnline()
  const pending = useIsMutating({ predicate: isPendingChange })
  // Lo que había por enviar sin red, para contarlo al terminar de enviarlo (`null`: con red).
  // Se deriva mientras se pinta, como recomienda React, en vez de en un efecto.
  const [waiting, setWaiting] = useState<number | null>(online ? null : pending)
  const [sent, setSent] = useState<number | null>(null)
  if (!online && waiting !== pending) setWaiting(pending)
  if (online && waiting !== null && pending === 0) {
    setWaiting(null)
    if (waiting > 0) setSent(waiting)
  }

  useEffect(() => {
    if (sent === null) return
    const timer = window.setTimeout(() => {
      setSent(null)
    }, BACK_ONLINE_MS)
    return () => {
      window.clearTimeout(timer)
    }
  }, [sent])

  if (online && sent === null) return null
  const back = online && sent !== null

  return (
    <div
      role="status"
      className={cn(
        'flex shrink-0 items-center gap-2.5 font-semibold',
        variant === 'page'
          ? '-mx-1 mb-[18px] h-10 rounded-xl px-3.5 text-[13px]'
          : 'h-9 rounded-xl px-3 text-xs',
        back ? 'bg-success-bg text-success' : 'bg-fill text-muted-foreground',
      )}
    >
      {back ? (
        <Check aria-hidden className="size-4 shrink-0" strokeWidth={2.4} />
      ) : (
        <WifiOff aria-hidden className="size-4 shrink-0" strokeWidth={2.2} />
      )}
      <span className="min-w-0 flex-1 truncate">{back ? sentLabel(sent) : 'Sin conexión'}</span>
      {!back && pending > 0 && (
        <span className="shrink-0 font-medium text-subtle-foreground">{pending} por enviar</span>
      )}
    </div>
  )
}
