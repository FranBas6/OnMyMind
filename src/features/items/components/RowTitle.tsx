import { cn } from '@/lib/utils'

import type { Item } from '../types'
import { useItemActions } from './itemActionsContext'

/**
 * El título de una fila es el botón que abre el detalle, y su pseudoelemento cubre la fila
 * entera: tocar en cualquier sitio abre el detalle, salvo en el checkbox y en los botones, que
 * van por encima (`z-10`). Así hay un solo elemento enfocable por fila para abrirla.
 */
export function RowTitle({ item, className }: { item: Item; className?: string }) {
  const { openDetail } = useItemActions()
  return (
    <button
      type="button"
      onClick={() => {
        openDetail(item)
      }}
      className={cn(
        'block w-full text-left text-base leading-[1.3] font-medium wrap-break-word outline-none after:absolute after:inset-0 after:rounded-[18px] after:content-[""] focus-visible:after:ring-[3px] focus-visible:after:ring-ring/50 md:after:rounded-2xl',
        className,
      )}
    >
      {item.title}
    </button>
  )
}
