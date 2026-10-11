import { Check } from 'lucide-react'

import { cn } from '@/lib/utils'

import type { OptionMark } from '../chooseOne'
import { itemPrice } from '../prices'
import type { Item } from '../types'

const CHIP = 'rounded-[8px] px-2 py-0.5 text-xs font-bold whitespace-nowrap'

/**
 * Lo de la derecha de una opción de una sublista «para elegir una» (5.1, diseño 24): su precio y
 * debajo «Más barata» en verde o cuánto más cuesta («+50,99 €», en texto), como las tiendas de una
 * compra (diseño 19); «Sin precio» si no lo tiene; y en la elegida, «Elegida» con su check en
 * índigo (A4b).
 */
export function OptionAside({
  item,
  mark,
  className,
}: {
  item: Item
  mark: OptionMark
  className?: string
}) {
  const price = itemPrice(item)
  return (
    <span className={cn('flex shrink-0 flex-col items-end gap-1 text-right', className)}>
      {price ? (
        <span className="font-display text-base leading-tight font-extrabold tracking-[-0.02em] whitespace-nowrap">
          <span className="sr-only">Precio: </span>
          {price.text}
        </span>
      ) : (
        mark.kind === 'unpriced' && (
          <span className="text-sm whitespace-nowrap text-subtle-foreground">Sin precio</span>
        )
      )}
      {mark.kind === 'cheapest' && (
        <span className={cn(CHIP, 'bg-price-down-bg text-price-down')}>Más barata</span>
      )}
      {mark.kind === 'extra' && (
        <span className="text-xs font-semibold whitespace-nowrap text-muted-foreground">
          <span className="sr-only">Cuesta </span>
          {mark.text}
          <span className="sr-only"> más que la más barata</span>
        </span>
      )}
      {mark.kind === 'chosen' && (
        <span className={cn(CHIP, 'flex items-center gap-1 bg-brand-tint text-primary-strong')}>
          <Check aria-hidden className="size-3" strokeWidth={2.8} />
          Elegida
        </span>
      )}
    </span>
  )
}
