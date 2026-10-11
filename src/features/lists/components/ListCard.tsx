import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Link } from '@tanstack/react-router'
import { useState, type SyntheticEvent } from 'react'

import { ListIcon } from '@/components/ListIcon'
import { LIFT_TOLERANCE_PX } from '@/hooks/useReorderSensors'
import { cn } from '@/lib/utils'

import { counterLabel, listStyle, pendingTotal, STYLE_TEMPLATES } from '../templates'
import type { List } from '../types'
import { ListCardInitials, ListCardSharedNote } from '@/features/sharing/components/SharedInitials'

import { ListCardMenu } from './ListCardMenu'
import { useListDrag } from './listDragContext'

/**
 * Tarjeta de lista (diseño 03 Inicio y 04 Listas): icono, nombre, tipo en gris terciario y, abajo,
 * el contador y el total de compras. El menú ··· (Editar, Archivar, Borrar) va arriba a la derecha.
 * El botón es hermano del enlace, no hijo: un botón dentro de un enlace no es HTML válido.
 *
 * Desde la 2.9 se ordena arrastrando (diseño 14, I1 y D6): con el dedo, mantenerla pulsada 0,4 s
 * la levanta (se hunde mientras se espera) y soltarla sin moverla abre su menú, como antes la
 * pulsación larga; con el ratón, arrastrarla. En su sitio queda la ranura punteada y, al soltar,
 * un momento con fondo índigo suave. La copia levantada es `ListCardFace` con `lifted`.
 */
export function ListCard({
  list,
  menuOpen,
  onMenuOpenChange,
}: {
  list: List
  menuOpen: boolean
  onMenuOpenChange: (open: boolean) => void
}) {
  const drag = useListDrag()
  const { listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: list.id,
    data: { label: list.name },
  })
  const [pressing, setPressing] = useState(false)
  const [pressStart, setPressStart] = useState<{ x: number; y: number } | null>(null)
  // dnd-kit los da como `Function`: los manejadores de sus sensores de ratón y dedo.
  const listener = (name: 'onMouseDown' | 'onTouchStart') =>
    listeners?.[name] as ((event: SyntheticEvent) => void) | undefined
  const onMouseDown = listener('onMouseDown')
  const onTouchStart = listener('onTouchStart')
  const stopPressing = () => {
    setPressStart(null)
    setPressing(false)
  }

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn(
        'flex min-w-0 rounded-[22px]',
        isDragging && 'border-2 border-dashed border-primary/50 bg-brand-tint',
      )}
    >
      <div className={cn('relative flex w-full min-w-0', isDragging && 'invisible')}>
        <Link
          to="/lists/$listId"
          params={{ listId: list.id }}
          onMouseDown={onMouseDown}
          onTouchStart={(event) => {
            const touch = event.touches[0]
            if (touch) setPressStart({ x: touch.clientX, y: touch.clientY })
            setPressing(true)
            onTouchStart?.(event)
          }}
          onTouchMove={(event) => {
            const touch = event.touches[0]
            if (!pressStart || !touch) return
            const moved = Math.hypot(touch.clientX - pressStart.x, touch.clientY - pressStart.y)
            if (moved > LIFT_TOLERANCE_PX) stopPressing()
          }}
          onTouchEnd={stopPressing}
          onTouchCancel={stopPressing}
          onClickCapture={(event) => {
            if (drag?.swallowsClick()) {
              event.preventDefault()
              event.stopPropagation()
            }
          }}
          // Sin menú contextual del sistema ni vista previa de enlace de iOS al mantener pulsado.
          onContextMenu={(event) => {
            event.preventDefault()
          }}
          className={cn(
            CARD,
            'motion-safe:transition-[scale,background-color,border-color] motion-safe:duration-300',
            pressing && 'scale-[0.985]',
            drag?.settledId === list.id && 'border-primary/60 bg-brand-tint',
            menuOpen && 'outline-2 outline-offset-2 outline-primary outline-solid md:outline-none',
          )}
        >
          <ListCardFace list={list} />
        </Link>
        <div className="absolute top-2.5 right-2.5">
          <ListCardMenu list={list} open={menuOpen} onOpenChange={onMenuOpenChange} />
        </div>
      </div>
    </li>
  )
}

const CARD =
  'flex w-full min-w-0 flex-col gap-3 rounded-[22px] border border-border-soft bg-card p-4 shadow-card outline-none select-none [-webkit-touch-callout:none] hover:border-border hover:shadow-md focus-visible:ring-[3px] focus-visible:ring-ring/50'

/** La tarjeta levantada al arrastrarla (diseño 14, I1 y D6): crece un 5 % con su sombra. */
export function LiftedListCard({ list }: { list: List }) {
  return (
    <div className={cn(CARD, 'scale-[1.05] cursor-grabbing border-border shadow-lift')}>
      <ListCardFace list={list} />
    </div>
  )
}

function ListCardFace({ list }: { list: List }) {
  const total = pendingTotal(list)
  return (
    <>
      <div className="flex items-start justify-between">
        <ListIcon name={list.name} color={list.color} />
        <div className="flex items-start gap-1">
          {/* Compartida: las iniciales de quienes están, junto al ··· (diseño 20, M1). */}
          <ListCardInitials list={list} />
          {/* Hueco del botón ···, que se pinta encima (fuera del enlace). */}
          <span aria-hidden className="-mt-1.5 -mr-1.5 size-8 shrink-0" />
        </div>
      </div>
      <div className="min-w-0">
        <p className="font-display text-base leading-[1.2] font-bold tracking-[-0.01em] break-words">
          {list.name}
          <ListCardSharedNote list={list} />
        </p>
        <p className="mt-[3px] truncate text-[12.5px] text-subtle-foreground">
          {STYLE_TEMPLATES[listStyle(list)].label}
        </p>
      </div>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[13px] whitespace-nowrap text-muted-foreground">
          {counterLabel(listStyle(list), list.counters.pending)}
        </span>
        {total && (
          <span className="font-display text-[15px] font-extrabold tracking-[-0.02em] whitespace-nowrap">
            {total}
          </span>
        )}
      </div>
    </>
  )
}
