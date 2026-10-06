import {
  closestCenter,
  DndContext,
  DragOverlay,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { useRef, useState } from 'react'
import { createPortal } from 'react-dom'

import { KeyboardDragHint } from '@/components/KeyboardDragHint'
import {
  isKeyboardStart,
  isTouchStart,
  liftHaptic,
  LIFT_TOLERANCE_PX,
  REORDER_INSTRUCTIONS,
  reorderAnnouncements,
  restrictToVerticalAxis,
  useReorderSensors,
} from '@/hooks/useReorderSensors'

import type { Item } from '../types'
import { useItemActions, type RowOrder } from './itemActionsContext'
import { ItemRow } from './ItemRow'
import { LiftedRowContext, RowDragContext } from './rowDragContext'

/** Cuánto se queda la fila recién soltada con su fondo índigo (diseño 14, R7). */
const SETTLE_MS = 700
/** Cuánto espera el menú tras soltar sin mover (ver `onDragEnd`). */
const MENU_DELAY_MS = 80
/** Tras soltar, el clic del navegador que llega en este rato no abre nada. */
const SWALLOW_CLICK_MS = 600

interface Lifted {
  item: Item
  touch: boolean
  keyboard: boolean
}

/**
 * Las filas de una lista que se ordena a mano (2.9, diseño 14). En el dedo, mantener pulsado
 * 0,4 s levanta la fila con un toque de vibración; si luego se mueve, se arrastra, y si se suelta
 * sin moverla se abre el menú de fila de siempre (R2–R4). Con el ratón se arrastra la fila entera
 * (D2) y con el teclado, desde el asa (D4). Lo que se ve levantado es una copia (`DragOverlay`):
 * en su sitio queda la ranura punteada, que se mueve mientras las demás se apartan (R5). Cerca del
 * borde la página se desplaza sola (R6). Soltar fuera de la lista o con Esc lo deja donde estaba
 * (R8).
 */
export function SortableRows({ items, order }: { items: readonly Item[]; order: RowOrder }) {
  const actions = useItemActions()
  const sensors = useReorderSensors()
  const [lifted, setLifted] = useState<Lifted | null>(null)
  const [overId, setOverId] = useState<string | null>(null)
  const [settledId, setSettledId] = useState<string | null>(null)
  const lastDrop = useRef(0)
  const settleTimer = useRef<number | undefined>(undefined)
  const ids = items.map((item) => item.id)
  const titleOf = (id: string) => items.find((item) => item.id === id)?.title ?? ''

  const onDragStart = ({ active, activatorEvent }: DragStartEvent) => {
    const item = items.find((entry) => entry.id === active.id)
    if (!item) return
    const touch = isTouchStart(activatorEvent)
    if (touch) liftHaptic()
    // Una fila abierta a la izquierda se cierra: arrastrar es otra cosa.
    actions.setSwipeOpenId(undefined)
    setLifted({ item, touch, keyboard: isKeyboardStart(activatorEvent) })
    setOverId(String(active.id))
  }

  const finish = () => {
    lastDrop.current = Date.now()
    setLifted(null)
    setOverId(null)
  }

  const onDragEnd = ({ active, over, delta }: DragEndEvent) => {
    const start = lifted
    finish()
    const moved = Math.hypot(delta.x, delta.y) >= LIFT_TOLERANCE_PX
    // Mantener pulsado y soltar sin mover: el menú de fila, como siempre (R4).
    if (start?.touch && !moved) {
      // Un poco después: si el navegador manda un clic al levantar el dedo, que llegue antes de
      // que exista la hoja (si no, caería en su fondo y la cerraría).
      window.setTimeout(() => {
        actions.openMenu(start.item)
      }, MENU_DELAY_MS)
      return
    }
    if (!over || over.id === active.id) return
    order.drop(String(active.id), String(over.id))
    setSettledId(String(active.id))
    window.clearTimeout(settleTimer.current)
    settleTimer.current = window.setTimeout(() => {
      setSettledId(null)
    }, SETTLE_MS)
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      modifiers={[restrictToVerticalAxis]}
      accessibility={{
        announcements: reorderAnnouncements(ids, titleOf),
        screenReaderInstructions: REORDER_INSTRUCTIONS,
        // Sus avisos (`aria-live`) van al final de la página: dentro de la lista, al abrirse una
        // hoja, la librería que oculta lo de detrás bajaría hasta la propia lista.
        container: document.body,
      }}
      onDragStart={onDragStart}
      onDragOver={({ over }) => {
        setOverId(over ? String(over.id) : null)
      }}
      onDragEnd={onDragEnd}
      onDragCancel={finish}
    >
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        <RowDragContext
          value={{
            ids,
            settledId,
            swallowsClick: () => Date.now() - lastDrop.current < SWALLOW_CLICK_MS,
          }}
        >
          <ul aria-label="Ítems" className="flex flex-col gap-2">
            {items.map((item) => (
              <ItemRow key={item.id} item={item} />
            ))}
          </ul>
        </RowDragContext>
      </SortableContext>
      {createPortal(
        <DragOverlay zIndex={60}>
          {lifted && (
            <LiftedRowContext value={lifted.keyboard ? 'keyboard' : 'pointer'}>
              <ul aria-hidden className="list-none">
                <ItemRow item={lifted.item} />
              </ul>
            </LiftedRowContext>
          )}
        </DragOverlay>,
        document.body,
      )}
      {lifted?.keyboard && (
        <KeyboardDragHint
          label={lifted.item.title}
          position={ids.indexOf(overId ?? lifted.item.id) + 1}
          total={ids.length}
        />
      )}
    </DndContext>
  )
}
