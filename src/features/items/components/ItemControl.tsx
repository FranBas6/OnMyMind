import { Calendar } from 'lucide-react'

import type { ListColor } from '@/lib/listColors'
import { cn } from '@/lib/utils'

import { checkboxState } from '../status'
import type { Item } from '../types'
import { StatusCheckbox } from './StatusCheckbox'
import { SublistIcon } from './SublistIcon'

interface ItemControlProps {
  item: Pick<Item, 'kind' | 'status' | 'title'>
  onToggle: () => void
  /** El del detalle: 28 px en móvil y 26 en escritorio. */
  large?: boolean
  tone?: ListColor
  className?: string
}

/**
 * El control de la izquierda de un ítem, que es lo que distingue su tipo sin iconos añadidos
 * (diseño 12): la tarea con su círculo, la compra con un cuadrado redondeado y el evento sin
 * checkbox, con un calendario de línea en su lugar (se cancela desde el detalle, el menú o
 * deslizando). Es la misma forma en cualquier lista, también en Buscar.
 */
export function ItemControl({ item, onToggle, large = false, tone, className }: ItemControlProps) {
  if (item.kind === 'sublist') {
    return (
      <SublistIcon
        color={tone}
        state={item.status === 'paused' ? 'paused' : item.status === 'done' ? 'done' : 'active'}
        className={cn(large && 'size-7 md:size-[26px]', className)}
      />
    )
  }
  if (item.kind === 'event') {
    return (
      <span
        role="img"
        aria-label="Evento"
        className={cn(
          'grid shrink-0 place-items-center text-muted-foreground',
          large ? 'size-7 md:size-[26px]' : 'size-6',
          className,
        )}
      >
        <Calendar aria-hidden className={large ? 'size-5' : 'size-[18px]'} strokeWidth={2.2} />
      </span>
    )
  }
  return (
    <StatusCheckbox
      state={checkboxState(item.status)}
      label={item.title}
      onToggle={onToggle}
      large={large}
      tone={tone}
      shape={item.kind === 'shopping' ? 'square' : 'circle'}
      className={className}
    />
  )
}
