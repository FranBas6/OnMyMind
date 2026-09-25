import { Link } from '@tanstack/react-router'

import { ListIcon } from '@/components/ListIcon'

import { counterLabel, KIND_TEMPLATES, pendingTotal } from '../templates'
import type { List } from '../types'

/**
 * Tarjeta de lista (diseño 03 Inicio, M1 y D1): icono y hueco del menú ···, nombre, tipo en
 * gris terciario y, abajo, el contador a la izquierda y el total de compras a la derecha. Así
 * el total no se corta en las tarjetas de 160 px del móvil.
 */
export function ListCard({ list }: { list: List }) {
  const total = pendingTotal(list)

  return (
    <Link
      to="/lists/$listId"
      params={{ listId: list.id }}
      className="flex w-full min-w-0 flex-col gap-3 rounded-[22px] border border-border-soft bg-card p-4 shadow-card outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
    >
      <div className="flex items-start justify-between">
        <ListIcon name={list.name} color={list.color} />
        {/* Hueco del menú ··· (editar, archivar, borrar): se activa en 1.6. */}
        <span
          aria-hidden
          className="-mt-1.5 -mr-1.5 flex size-8 shrink-0 items-center justify-center gap-[3px]"
        >
          <span className="size-1 rounded-full bg-control" />
          <span className="size-1 rounded-full bg-control" />
          <span className="size-1 rounded-full bg-control" />
        </span>
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
  )
}
