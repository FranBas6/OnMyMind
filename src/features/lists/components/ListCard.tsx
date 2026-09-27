import { Link } from '@tanstack/react-router'
import { useState } from 'react'

import { ListIcon } from '@/components/ListIcon'
import { useLongPress } from '@/hooks/useLongPress'
import { cn } from '@/lib/utils'

import { counterLabel, KIND_TEMPLATES, pendingTotal } from '../templates'
import type { List } from '../types'
import { ListCardMenu } from './ListCardMenu'

/**
 * Tarjeta de lista (diseño 03 Inicio y 04 Listas): icono, nombre, tipo en gris terciario y, abajo,
 * el contador y el total de compras. El menú ··· (Editar, Archivar, Borrar) va arriba a la derecha
 * y también se abre manteniendo pulsada la tarjeta en móvil. El botón es hermano del enlace, no
 * hijo: un botón dentro de un enlace no es HTML válido.
 */
export function ListCard({ list }: { list: List }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const longPress = useLongPress(() => {
    setMenuOpen(true)
  })
  const total = pendingTotal(list)

  return (
    <div className="relative flex w-full min-w-0">
      <Link
        to="/lists/$listId"
        params={{ listId: list.id }}
        {...longPress}
        className={cn(
          'flex w-full min-w-0 flex-col gap-3 rounded-[22px] border border-border-soft bg-card p-4 shadow-card outline-none select-none [-webkit-touch-callout:none] focus-visible:ring-[3px] focus-visible:ring-ring/50',
          menuOpen && 'outline-2 outline-offset-2 outline-primary outline-solid md:outline-none',
        )}
      >
        <div className="flex items-start justify-between">
          <ListIcon name={list.name} color={list.color} />
          {/* Hueco del botón ···, que se pinta encima (fuera del enlace). */}
          <span aria-hidden className="-mt-1.5 -mr-1.5 size-8 shrink-0" />
        </div>
        <div className="min-w-0">
          <p className="font-display text-base leading-[1.2] font-bold tracking-[-0.01em] break-words">
            {list.name}
          </p>
          <p className="mt-[3px] truncate text-[12.5px] text-subtle-foreground">
            {KIND_TEMPLATES[list.kind].label}
          </p>
        </div>
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-[13px] whitespace-nowrap text-muted-foreground">
            {counterLabel(list.kind, list.counters.pending)}
          </span>
          {total && (
            <span className="font-display text-[15px] font-extrabold tracking-[-0.02em] whitespace-nowrap">
              {total}
            </span>
          )}
        </div>
      </Link>
      <div className="absolute top-2.5 right-2.5">
        <ListCardMenu list={list} open={menuOpen} onOpenChange={setMenuOpen} />
      </div>
    </div>
  )
}
