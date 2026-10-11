import { Link2, Store } from 'lucide-react'
import { useState } from 'react'

import { cn } from '@/lib/utils'

import { usePhotoSrc } from '../hooks/usePhoto'
import { linkDomain } from '../links'
import { hasThumb } from '../photos'
import { changeDescription, changeLabel, itemPrice } from '../prices'
import { linksLabel } from '../stores'
import type { Item } from '../types'

/**
 * La miniatura de 44 px de la fila, tras el control (diseño 15, L1 y D1; base: diseño 13, I1). Si
 * la imagen de la web ya no carga, queda el cuadrado vacío en `fill`, sin icono roto. Con varias
 * fotos, la primera y un número pequeño con cuántas son (diseño 23, D y E5).
 */
export function RowThumb({
  item,
  className,
}: {
  item: Pick<Item, 'imagePath' | 'imageUrl' | 'images'>
  className?: string
}) {
  const { src } = usePhotoSrc(item, 'thumb')
  const [broken, setBroken] = useState<string | null>(null)
  if (!hasThumb(item)) return null
  const count = item.images.length
  return (
    <span
      aria-hidden
      className={cn(
        'relative block size-11 shrink-0 overflow-hidden rounded-[12px] bg-fill',
        className,
      )}
    >
      {src && broken !== src && (
        <img
          src={src}
          alt=""
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => {
            setBroken(src)
          }}
          className="size-full object-cover"
        />
      )}
      {count > 1 && (
        <span className="absolute right-0.5 bottom-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-foreground/80 px-1 text-[10px] leading-none font-bold text-background">
          {count}
        </span>
      )}
    </span>
  )
}

/**
 * «🔗 shop.realmadrid.com» en la meta de la fila (diseño 15, L1 y L2); con varios enlaces, «🔗 en 3
 * enlaces» (diseño 23, D12), y en una compra con varias tiendas, el icono de tienda y «en 3
 * tiendas» (diseño 19, T24).
 */
export function LinkMeta({
  url,
  item,
  className,
}: {
  url: string
  item?: Pick<Item, 'kind' | 'links'>
  className?: string
}) {
  const many = item ? linksLabel(item) : null
  const Icon = many && item?.kind === 'shopping' ? Store : Link2
  return (
    <span className={cn('inline-flex min-w-0 items-center gap-1', className)}>
      <Icon aria-hidden className="size-3 shrink-0" strokeWidth={2.4} />
      {!many && <span className="sr-only">Enlace: </span>}
      <span className="truncate">{many ?? linkDomain(url)}</span>
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
