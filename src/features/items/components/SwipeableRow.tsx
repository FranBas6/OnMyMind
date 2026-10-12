import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  ArrowRightLeft,
  Check,
  Circle,
  Contrast,
  GripVertical,
  Trash2,
  type LucideIcon,
} from 'lucide-react'
import {
  use,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type HTMLAttributes,
  type KeyboardEvent,
  type ReactNode,
  type Ref,
  type SyntheticEvent,
} from 'react'

import { useLongPress } from '@/hooks/useLongPress'
import { LIFT_TOLERANCE_PX } from '@/hooks/useReorderSensors'
import { cn } from '@/lib/utils'

import { useSwipe } from '../hooks/useSwipe'
import { LEFT_OPEN_PX, rightActions, rightStage, type SwipeStatusAction } from '../swipe'
import type { Item } from '../types'
import { useItemActions } from './itemActionsContext'
import { LiftedRowContext, useRowDrag, type RowDrag } from './rowDragContext'

const TONE: Record<SwipeStatusAction['tone'], { bg: string; icon: LucideIcon }> = {
  progress: { bg: 'bg-swipe-progress', icon: Contrast },
  done: { bg: 'bg-swipe-done', icon: Check },
  reopen: { bg: 'bg-swipe-move', icon: Circle },
}

const ROW_SHAPE = 'relative isolate overflow-hidden rounded-[18px] md:rounded-2xl'

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
 * menos movimiento.
 *
 * Donde se ordena a mano (2.9, dentro de `SortableRows`), la fila además se levanta: mantenerla
 * pulsada 0,4 s y moverla la arrastra, y soltarla sin moverla abre el menú (diseño 14). En el
 * resto (Hoy, Buscar, eventos, «Fuera de la cabeza»), mantenerla pulsada abre el menú, como antes.
 */
export function SwipeableRow(props: SwipeableRowProps) {
  const lifted = use(LiftedRowContext)
  const drag = useRowDrag()
  if (lifted) return <LiftedRow {...props} keyboard={lifted === 'keyboard'} />
  if (drag?.ids.includes(props.item.id)) return <SortableSwipeableRow {...props} drag={drag} />
  return <PlainSwipeableRow {...props} />
}

/** Lo de deslizar que comparten las dos filas: el gesto, la que está abierta y cerrarla al tocar fuera. */
function useRowSwipe(item: Item, disabled = false) {
  const actions = useItemActions()
  const right = rightActions(item.kind, item.status)
  const open = actions.swipeOpenId === item.id
  const setOpen = (next: boolean) => {
    actions.setSwipeOpenId(next ? item.id : undefined)
  }
  const swipe = useSwipe({
    rightStages: right.length,
    hasLeft: true,
    open,
    disabled,
    peekRight: item.kind === 'note',
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

  return { swipe, right, setOpen }
}

function PlainSwipeableRow({ item, surfaceClassName, children }: SwipeableRowProps) {
  const actions = useItemActions()
  const { swipe, right, setOpen } = useRowSwipe(item)
  const longPress = useLongPress(() => {
    actions.openMenu(item)
  })

  return (
    <SwipeRowView
      item={item}
      right={right}
      offset={swipe.offset}
      onClose={() => {
        setOpen(false)
      }}
      liClassName={ROW_SHAPE}
      surface={{
        ...longPress,
        ...swipe.handlers,
        onPointerDown: (event) => {
          longPress.onPointerDown(event)
          swipe.handlers.onPointerDown(event)
        },
        onPointerMove: (event) => {
          longPress.onPointerMove(event)
          swipe.handlers.onPointerMove(event)
        },
        onPointerUp: (event) => {
          longPress.onPointerUp()
          swipe.handlers.onPointerUp(event)
        },
        onPointerCancel: () => {
          longPress.onPointerCancel()
          swipe.handlers.onPointerCancel()
        },
        onClickCapture: (event) => {
          longPress.onClickCapture(event)
          swipe.handlers.onClickCapture(event)
        },
      }}
      surfaceClassName={cn(surfaceClassName, motion(swipe.dragging))}
    >
      {children}
    </SwipeRowView>
  )
}

/**
 * La fila que se ordena (2.9, diseño 14). Mientras se espera la pulsación larga se hunde un poco
 * (R2). Mientras se arrastra, en su sitio queda la ranura punteada índigo (R5) y la copia levantada
 * la pinta `SortableRows`. Al soltar, medio segundo con fondo índigo suave (R7). En escritorio
 * lleva un asa a la izquierda al pasar el ratón (D1), que es desde donde se ordena con el
 * teclado: Espacio levanta, ↑ ↓ mueven (D4). ⌥↑ y ⌥↓ la mueven sin levantarla.
 */
function SortableSwipeableRow({
  item,
  surfaceClassName,
  children,
  drag,
}: SwipeableRowProps & { drag: RowDrag }) {
  const actions = useItemActions()
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: item.id,
    data: { label: item.title },
    attributes: { roleDescription: 'ordenable' },
  })
  const { swipe, right, setOpen } = useRowSwipe(item, isDragging)
  const [pressing, setPressing] = useState(false)
  const pressStart = useRef<{ x: number; y: number } | null>(null)
  // dnd-kit los da como `Function`: son los manejadores de sus sensores (ratón, dedo y teclado).
  const listener = (name: 'onMouseDown' | 'onTouchStart' | 'onKeyDown') =>
    listeners?.[name] as ((event: SyntheticEvent) => void) | undefined
  const onMouseDown = listener('onMouseDown')
  const onTouchStart = listener('onTouchStart')
  const onKeyDown = listener('onKeyDown')

  const stopPressing = () => {
    pressStart.current = null
    setPressing(false)
  }

  // ⌥↑ y ⌥↓ la mueven sin levantarla (D3). Al cambiar de sitio, la fila se mueve en el DOM y el
  // navegador le quita el foco: se le devuelve.
  const onRowKeyDown = (event: KeyboardEvent<HTMLLIElement>) => {
    if (!event.altKey || (event.key !== 'ArrowUp' && event.key !== 'ArrowDown')) return
    event.preventDefault()
    const focused = document.activeElement
    actions.order?.step(item, event.key === 'ArrowUp' ? 'up' : 'down')
    requestAnimationFrame(() => {
      if (focused instanceof HTMLElement && document.activeElement !== focused) focused.focus()
    })
  }

  const settled = drag.settledId === item.id
  const slot = isDragging

  return (
    <SwipeRowView
      item={item}
      right={right}
      offset={swipe.offset}
      onClose={() => {
        setOpen(false)
      }}
      liRef={setNodeRef}
      liStyle={{
        transform: CSS.Translate.toString(transform),
        transition,
      }}
      liClassName={cn(
        ROW_SHAPE,
        'group/sortable select-none [-webkit-touch-callout:none]',
        slot && 'border-2 border-dashed border-primary/50 bg-brand-tint',
      )}
      liProps={{ onKeyDown: onRowKeyDown }}
      after={
        <button
          ref={setActivatorNodeRef}
          type="button"
          {...attributes}
          aria-label={`Ordenar «${item.title}»`}
          onKeyDown={onKeyDown}
          onMouseDown={onMouseDown}
          className={cn(
            'absolute top-1/2 left-[3px] z-20 hidden h-7 w-[15px] -translate-y-1/2 cursor-grab items-center justify-center rounded-md text-subtle-foreground opacity-0 outline-none group-hover/sortable:opacity-100 hover:bg-fill focus-visible:opacity-100 focus-visible:ring-[3px] focus-visible:ring-ring/50 md:flex',
            slot && 'invisible',
          )}
        >
          <GripVertical aria-hidden className="size-3.5" strokeWidth={2.2} />
        </button>
      }
      surface={{
        ...swipe.handlers,
        onMouseDown,
        onTouchStart: (event) => {
          const touch = event.touches[0]
          if (touch) pressStart.current = { x: touch.clientX, y: touch.clientY }
          setPressing(true)
          onTouchStart?.(event)
        },
        onTouchMove: (event) => {
          const start = pressStart.current
          const touch = event.touches[0]
          if (!start || !touch) return
          if (Math.hypot(touch.clientX - start.x, touch.clientY - start.y) > LIFT_TOLERANCE_PX) {
            stopPressing()
          }
        },
        onTouchEnd: stopPressing,
        onTouchCancel: stopPressing,
        onClickCapture: (event) => {
          if (drag.swallowsClick()) {
            event.preventDefault()
            event.stopPropagation()
            return
          }
          swipe.handlers.onClickCapture(event)
        },
      }}
      surfaceClassName={cn(
        surfaceClassName,
        // También el hundirse mientras se espera la pulsación larga (R2) y el fondo al soltar.
        swipe.dragging
          ? 'transition-none'
          : 'motion-safe:transition-[transform,scale,background-color,border-color] motion-safe:duration-300 motion-safe:ease-out motion-reduce:transition-none',
        pressing && !slot && 'scale-[0.985]',
        settled && 'border-primary/60 bg-brand-tint',
        slot && 'invisible',
      )}
    >
      {children}
    </SwipeRowView>
  )
}

/** La copia levantada que sigue al dedo o al ratón (diseño 14, R3 y D2): crece un 3 % con su sombra. */
function LiftedRow({
  item,
  surfaceClassName,
  children,
  keyboard,
}: SwipeableRowProps & { keyboard: boolean }) {
  return (
    <li
      data-lifted-row={item.id}
      className={cn(
        'relative scale-[1.03] cursor-grabbing rounded-[18px] shadow-lift md:rounded-2xl',
        keyboard && 'outline-2 outline-offset-0 outline-primary outline-solid',
      )}
    >
      <div className={surfaceClassName}>{children}</div>
    </li>
  )
}

/**
 * Las transiciones de la superficie: va después de sus clases, porque su `duration-200` (de
 * `animate-in`) da a todo una transición de 200 ms, y sin propiedad la de CSS es `all`. Deslizando,
 * nada se anima: la fila va pegada al dedo. Al soltar, solo el `transform`.
 */
const motion = (dragging: boolean) =>
  dragging
    ? 'transition-none'
    : 'motion-safe:transition-transform motion-safe:duration-200 motion-safe:ease-out motion-reduce:transition-none'

interface SwipeRowViewProps {
  item: Item
  right: SwipeStatusAction[]
  offset: number
  onClose: () => void
  surface: HTMLAttributes<HTMLDivElement>
  surfaceClassName: string
  liRef?: Ref<HTMLLIElement>
  liStyle?: CSSProperties
  liClassName: string
  liProps?: HTMLAttributes<HTMLLIElement>
  /** Lo que va tras la superficie (el asa de ordenar en escritorio, dibujada a su izquierda). */
  after?: ReactNode
  children: ReactNode
}

/** La fila: lo que asoma al deslizar, detrás, y la superficie que se mueve. */
function SwipeRowView({
  item,
  right,
  offset,
  onClose,
  surface,
  surfaceClassName,
  liRef,
  liStyle,
  liClassName,
  liProps,
  after,
  children,
}: SwipeRowViewProps) {
  const actions = useItemActions()
  const stage = Math.max(1, rightStage(offset, right.length))
  const shown = right[stage - 1]
  const reached = rightStage(offset, right.length) > 0

  return (
    <li ref={liRef} data-swipe-row={item.id} style={liStyle} className={liClassName} {...liProps}>
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
      {offset > 0 && !shown && item.kind === 'note' && (
        // Una nota no se marca (diseño 25, B11): asoma esto y la fila vuelve.
        <div
          aria-hidden
          className="absolute inset-0 -z-10 flex items-center bg-fill pl-[18px] text-[12.5px] leading-[1.3] font-semibold text-subtle-foreground"
          style={{ paddingRight: `calc(100% - ${String(Math.max(offset - 18, 0))}px)` }}
        >
          Las notas no tienen estado
        </div>
      )}
      {offset < 0 && (
        <div className="absolute inset-y-0 right-0 -z-10 flex" style={{ width: LEFT_OPEN_PX }}>
          <SideButton
            icon={ArrowRightLeft}
            label="Mover"
            className="bg-swipe-move"
            onClick={() => {
              onClose()
              actions.startMove(item, null)
            }}
          />
          <SideButton
            icon={Trash2}
            label="Borrar"
            className="bg-swipe-delete"
            onClick={() => {
              onClose()
              actions.remove(item)
            }}
          />
        </div>
      )}
      <div
        {...surface}
        style={{ transform: offset === 0 ? undefined : `translateX(${offset}px)` }}
        className={cn('touch-pan-y', offset !== 0 && 'shadow-swipe', surfaceClassName)}
      >
        {children}
      </div>
      {after}
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
