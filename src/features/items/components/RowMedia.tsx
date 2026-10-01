import { Link2 } from 'lucide-react'
import { useState } from 'react'

import { cn } from '@/lib/utils'

import { usePhotoSrc } from '../hooks/usePhoto'
import { linkDomain } from '../links'
import { hasThumb } from '../photos'
import { changeDescription, changeLabel, itemPrice } from '../prices'
import type { Item } from '../types'

/**
 * La miniatura de 44 px de la fila, tras el control (diseño 15, L1 y D1; base: diseño 13, I1). Si
 * la imagen de la web ya no carga, queda el cuadrado vacío en `fill`, sin icono roto.
 */
export function RowThumb({ item, className }: { item: Item; className?: string }) {
  const { src } = usePhotoSrc(item, 'thumb')
  const [broken, setBroken] = useState<string | null>(null)
  if (!hasThumb(item)) return null
  return (
    <span
      aria-hidden
      className={cn('block size-11 shrink-0 overflow-hidden rounded-[12px] bg-fill', className)}
    >
      {src && broken !== src && (
        <img
          src={src}
          alt=""
          loading="lazy"
          onError={() => {
            setBroken(src)
          }}
          className="size-full object-cover"
        />
      )}
    </span>
  )
}

/** «🔗 shop.realmadrid.com» en la meta de la fila (diseño 15, L1 y L2). */
export function LinkMeta({ url, className }: { url: string; className?: string }) {
  return (
    <span className={cn('inline-flex min-w-0 items-center gap-1', className)}>
      <Link2 aria-hidden className="size-3 shrink-0" strokeWidth={2.4} />
      <span className="sr-only">Enlace: </span>
      <span className="truncate">{linkDomain(url)}</span>
    </span>
  )
}

/**
 * El precio de una compra a la derecha de su fila (diseño 16, A1 y D2): el importe en Plus Jakarta
 * 800 y debajo la variación en texto («↓ 8 %» verde, «↑ 3 %» rojo), sin chip, para que no pese más
 * que el título. Sin precio no hay nada.
 */
export function RowPrice({ item, className }: { item: Item; className?: string }) {
  const price = itemPrice(item)
  if (!price) return null
  const { change } = price
  return (
    <span className={cn('flex shrink-0 flex-col items-end text-right', className)}>
      <span className="font-display text-base leading-tight font-extrabold tracking-[-0.02em] whitespace-nowrap">
        <span className="sr-only">Precio: </span>
        {price.text}
      </span>
      {change && (
        <span
          className={cn(
            'text-xs font-bold whitespace-nowrap',
            change.direction === 'down' ? 'text-price-down' : 'text-price-up',
          )}
        >
          <span aria-hidden>{changeLabel(change)}</span>
          <span className="sr-only">, {changeDescription(change)}</span>
        </span>
      )}
    </span>
  )
}
