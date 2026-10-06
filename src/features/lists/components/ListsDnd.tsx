import {
  closestCenter,
  DndContext,
  DragOverlay,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import { SortableContext, type SortingStrategy } from '@dnd-kit/sortable'
import { useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

import {
  isTouchStart,
  liftHaptic,
  LIFT_TOLERANCE_PX,
  REORDER_INSTRUCTIONS,
  reorderAnnouncements,
  useReorderSensors,
} from '@/hooks/useReorderSensors'
import { dropNeighbors, reorder } from '@/lib/reorder'

import { useReorderLists } from '../hooks/useListMutations'
import type { List } from '../types'
import { justDropped, ListDragContext, stampDrop } from './listDragContext'

const SETTLE_MS = 700

/**
 * Ordenar las listas a mano (2.9, diseño 14, I1, D5 y D6): en la rejilla de Inicio y en «Mis
 * listas» del sidebar. «En mente» no está aquí: va fijada aparte. Como en las filas, con el dedo se
 * levanta manteniendo pulsado 0,4 s y, si se suelta sin mover, se abre el menú de la tarjeta
 * (`onPressRelease`); con el ratón, arrastrando. La copia levantada la pinta `renderLifted`; en su
 * sitio queda la ranura punteada. Sin red, el orden cambia igual y se envía al volver.
 */
export function ListsDnd({
  lists,
  strategy,
  renderLifted,
  onPressRelease,
  children,
}: {
  lists: readonly List[]
  strategy: SortingStrategy
  renderLifted: (list: List) => ReactNode
  onPressRelease?: (list: List) => void
  children: ReactNode
}) {
  const sensors = useReorderSensors()
  const reorderLists = useReorderLists()
  const [lifted, setLifted] = useState<{ list: List; touch: boolean } | null>(null)
  const [settledId, setSettledId] = useState<string | null>(null)
  const lastDrop = useRef(0)
  const settleTimer = useRef<number | undefined>(undefined)
  const ids = lists.map((list) => list.id)

  const onDragStart = ({ active, activatorEvent }: DragStartEvent) => {
    const list = lists.find((entry) => entry.id === active.id)
    if (!list) return
    const touch = isTouchStart(activatorEvent)
    if (touch) liftHaptic()
    setLifted({ list, touch })
  }

  const onDragEnd = ({ active, over, delta }: DragEndEvent) => {
    const start = lifted
    stampDrop(lastDrop)
    setLifted(null)
    if (start?.touch && Math.hypot(delta.x, delta.y) < LIFT_TOLERANCE_PX) {
      // Un poco después, para que el clic del navegador al levantar el dedo no caiga en el menú.
      window.setTimeout(() => {
        onPressRelease?.(start.list)
      }, 80)
      return
    }
    if (!over || over.id === active.id) return
    const neighbors = dropNeighbors(ids, String(active.id), String(over.id))
    if (!neighbors) return
    const changes = reorder(lists, String(active.id), neighbors)
    if (changes.length > 0) reorderLists.mutate(changes)
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
      accessibility={{
        announcements: reorderAnnouncements(
          ids,
          (id) => lists.find((list) => list.id === id)?.name ?? '',
        ),
        screenReaderInstructions: REORDER_INSTRUCTIONS,
        container: document.body,
      }}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragCancel={() => {
        stampDrop(lastDrop)
        setLifted(null)
      }}
    >
      <SortableContext items={ids} strategy={strategy}>
        <ListDragContext
          value={{
            settledId,
            swallowsClick: () => justDropped(lastDrop),
          }}
        >
          {children}
        </ListDragContext>
      </SortableContext>
      {createPortal(
        <DragOverlay zIndex={60}>{lifted && renderLifted(lifted.list)}</DragOverlay>,
        document.body,
      )}
    </DndContext>
  )
}
