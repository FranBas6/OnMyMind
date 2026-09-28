import { ArrowRightLeft, Check, Circle, Contrast, Trash2, type LucideIcon } from 'lucide-react'
import { useEffect, type ReactNode } from 'react'

import { useLongPress } from '@/hooks/useLongPress'
import { cn } from '@/lib/utils'

import { useSwipe } from '../hooks/useSwipe'
import { LEFT_OPEN_PX, rightActions, rightStage, type SwipeStatusAction } from '../swipe'
import type { Item } from '../types'
import { useItemActions } from './itemActionsContext'

const TONE: Record<SwipeStatusAction['tone'], { bg: string; icon: LucideIcon }> = {
  progress: { bg: 'bg-swipe-progress', icon: Contrast },
  done: { bg: 'bg-swipe-done', icon: Check },
  reopen: { bg: 'bg-swipe-move', icon: Circle },
}

interface SwipeableRowProps {
  item: Item
  /** Clases de la superficie que se desliza (la tarjeta de la fila de siempre). */
  surfaceClassName: string
  children: ReactNode
}

/**
 * Envuelve una fila para deslizarla (pantalla 4 v2, 06 §Interacción). A la derecha, el estado:
 * «En curso» a 80 px y «Hecha» a 160 px en una tarea pendiente, y se ejecuta al soltar. A la
 * izquierda se abren «Mover» y «Borrar», que se tocan. Solo una fila abierta a la vez; tocar
 * fuera la cierra. Al soltar, la fila vuelve con una transición corta, salvo que el sistema pida
 * menos movimiento. Mantenerla pulsada sin moverla sigue abriendo el menú de fila.
 */
export function SwipeableRow({ item, surfaceClassName, children }: SwipeableRowProps) {
  const actions = useItemActions()
  const right = rightActions(actions.list.kind, item.status)
  const open = actions.swipeOpenId === item.id
  const setOpen = (next: boolean) => {
    actions.setSwipeOpenId(next ? item.id : undefined)
  }
  const longPress = useLongPress(() => {
    actions.openMenu(item)
  })
  const swipe = useSwipe({
    rightStages: right.length,
    hasLeft: true,
    open,
    onOpenChange: setOpen,
    onStage: (stage) => {
      const action = right[stage - 1]
      if (action) actions.setStatus(item, action.status)
    },
    onDragStart: () => {
      // Deslizar otra fila cierra la que estuviera abierta.
      if (actions.swipeOpenId !== item.id) actions.setSwipeOpenId(undefined)
    },
  })

  // Abierta, un toque en cualquier otro sitio la cierra.
  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: globalThis.PointerEvent) => {
      const target = event.target instanceof Element ? event.target : null
      if (target?.closest(`[data-swipe-row="${item.id}"]`)) return
      actions.setSwipeOpenId(undefined)
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
    }
  }, [open, item.id, actions])

  const { offset } = swipe
  const stage = Math.max(1, rightStage(offset, right.length))
  const shown = right[stage - 1]
  const reached = rightStage(offset, right.length) > 0

  return (
    <li
      data-swipe-row={item.id}
      className="relative isolate overflow-hidden rounded-[18px] md:rounded-2xl"
    >
      {offset > 0 && shown && (
        <div
          aria-hidden
          className={cn(
            'absolute inset-0 -z-10 flex items-center gap-2 pl-[18px] text-[13px] font-semibold text-white',
            TONE[shown.tone].bg,
          )}
        >
          <ToneIcon icon={TONE[shown.tone].icon} className={cn(!reached && 'opacity-60')} />
          <span className={cn(!reached && 'opacity-60')}>{shown.label}</span>
        </div>
      )}
      {offset < 0 && (
        <div className="absolute inset-y-0 right-0 -z-10 flex" style={{ width: LEFT_OPEN_PX }}>
          <SideButton
            icon={ArrowRightLeft}
            label="Mover"
            className="bg-swipe-move"
            onClick={() => {
              setOpen(false)
              actions.startMove(item, null)
            }}
          />
          <SideButton
            icon={Trash2}
            label="Borrar"
            className="bg-swipe-delete"
            onClick={() => {
              setOpen(false)
              actions.remove(item)
            }}
          />
        </div>
      )}
      <div
        {...longPress}
        {...swipe.handlers}
        onPointerDown={(event) => {
          longPress.onPointerDown(event)
          swipe.handlers.onPointerDown(event)
        }}
        onPointerMove={(event) => {
          longPress.onPointerMove(event)
          swipe.handlers.onPointerMove(event)
        }}
        onPointerUp={(event) => {
          longPress.onPointerUp()
          swipe.handlers.onPointerUp(event)
        }}
        onPointerCancel={() => {
          longPress.onPointerCancel()
          swipe.handlers.onPointerCancel()
        }}
        onClickCapture={(event) => {
          longPress.onClickCapture(event)
          swipe.handlers.onClickCapture(event)
        }}
        style={{ transform: offset === 0 ? undefined : `translateX(${offset}px)` }}
        className={cn(
          'touch-pan-y',
          offset !== 0 && 'shadow-swipe',
          !swipe.dragging &&
            'motion-safe:transition-transform motion-safe:duration-200 motion-safe:ease-out',
          surfaceClassName,
        )}
      >
        {children}
      </div>
    </li>
  )
}

function ToneIcon({ icon: Icon, className }: { icon: LucideIcon; className?: string }) {
  return <Icon aria-hidden className={cn('size-4', className)} strokeWidth={2.4} />
}

function SideButton({
  icon: Icon,
  label,
  className,
  onClick,
}: {
  icon: LucideIcon
  label: string
  className: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex w-20 flex-col items-center justify-center gap-[3px] text-[11px] font-semibold text-white outline-none focus-visible:ring-[3px] focus-visible:ring-white/70 focus-visible:ring-inset',
        className,
      )}
    >
      <Icon aria-hidden className="size-4" strokeWidth={2.2} />
      {label}
    </button>
  )
}
