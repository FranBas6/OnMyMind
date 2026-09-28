import { Trash2 } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'

import { useListActions, type List } from '@/features/lists'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import { showUndoToast } from '@/lib/undoToast'

import {
  useDeleteItem,
  useMoveItem,
  useRestoreItem,
  useSetItemStatus,
  useUpdateItem,
} from '../hooks/useItemMutations'
import { isFinalStatus, nextStatusOnToggle } from '../status'
import type { Item, ItemStatus } from '../types'
import {
  ItemActionsContext,
  ItemWorkspaceContext,
  useWorkspaceActions,
  type WorkspaceActions,
} from './itemActionsContext'
import { ItemRowMenuSheet } from './ItemRowMenu'
import { ItemSheet } from './ItemSheet'
import { MoveToList, type MoveTarget } from './MoveToList'

interface ItemWorkspaceProps {
  /** Los ítems en pantalla: de aquí salen el del detalle y el del menú de fila. */
  items: readonly Item[] | undefined
  /** La lista de cada ítem: en el detalle de lista, siempre la misma; en Hoy, la suya. */
  listOf: (item: Item) => List | undefined
  /** El ítem abierto en el detalle (`?item=` de la ruta). */
  openItemId: string | undefined
  /** Abre (con id) o cierra (sin él) el detalle: la ruta lo refleja en `?item=`. */
  onOpenItem: (itemId: string | undefined) => void
  /** Al terminar un ítem, para que se quede un momento en su sitio (`useLingering`). */
  onFinish: (itemId: string) => void
  children: ReactNode
}

/**
 * Lo que comparten las pantallas con filas de ítems (el detalle de lista y Hoy): las acciones de
 * cada fila, y encima el detalle del ítem (hoja o panel), el menú de fila y «Mover a…». Cada
 * acción usa la lista del propio ítem (`listOf`), así que una misma pantalla puede mezclar
 * listas. Las filas van dentro de un `ListScope`.
 */
export function ItemWorkspace({
  items,
  listOf,
  openItemId,
  onOpenItem,
  onFinish,
  children,
}: ItemWorkspaceProps) {
  const isDesktop = useMediaQuery('(min-width: 768px)')
  const statusMutation = useSetItemStatus()
  const updateItem = useUpdateItem()
  const moveItem = useMoveItem()
  const deleteItem = useDeleteItem()
  const restoreItem = useRestoreItem()
  const { openCreate } = useListActions()
  const [menuItemId, setMenuItemId] = useState<string | undefined>(undefined)
  const [moveTarget, setMoveTarget] = useState<MoveTarget | null>(null)
  const [swipeOpenId, setSwipeOpenId] = useState<string | undefined>(undefined)
  // La lista del detalle, del menú y de «Mover a…» se recuerda al cerrarlos: sus hojas siguen
  // pintando lo último mientras se animan hacia abajo.
  const [detailList, setDetailList] = useState<List | undefined>(undefined)
  const [menuList, setMenuList] = useState<List | undefined>(undefined)
  const [moveFrom, setMoveFrom] = useState<List | undefined>(undefined)

  const openItem = items?.find((item) => item.id === openItemId)
  const openList = openItem && listOf(openItem)
  if (openList && openList !== detailList) setDetailList(openList)
  const menuItem = items?.find((item) => item.id === menuItemId)

  // `?item=` de algo que ya no está aquí (borrado, movido, un enlace viejo): se quita.
  const staleItemId = items !== undefined && openItemId !== undefined && !openList
  useEffect(() => {
    if (staleItemId) onOpenItem(undefined)
  }, [staleItemId, onOpenItem])

  const setStatus = (item: Item, status: ItemStatus) => {
    // Lo que se termina se queda un instante en su sitio antes de irse (06 §Interacción).
    if (isFinalStatus(status) && !isFinalStatus(item.status)) onFinish(item.id)
    statusMutation.mutate({ item, status })
  }

  const move = (item: Item, to: List) => {
    const from = listOf(item)
    if (!from) return
    if (item.id === openItemId) onOpenItem(undefined)
    moveItem.mutate({ item, from, to })
  }

  const remove = (item: Item) => {
    if (item.id === openItemId) onOpenItem(undefined)
    deleteItem.mutate(item)
    showUndoToast({
      icon: Trash2,
      message: `«${item.title}» borrada`,
      onUndo: () => {
        restoreItem.mutate(item)
      },
    })
  }

  const actions: WorkspaceActions = {
    isDesktop,
    selectedId: openItemId,
    menuItemId,
    openDetail: (item) => {
      onOpenItem(item.id)
    },
    toggle: (item) => {
      const list = listOf(item)
      if (list) setStatus(item, nextStatusOnToggle(list.kind, item.status))
    },
    setStatus,
    openMenu: (item) => {
      setMenuList(listOf(item))
      setMenuItemId(item.id)
    },
    startMove: (item, anchor) => {
      const from = listOf(item)
      if (!from) return
      // En móvil, «Mover a…» sale sobre la lista (diseño 06, T6): el detalle se cierra antes.
      if (!isDesktop && item.id === openItemId) onOpenItem(undefined)
      setMoveFrom(from)
      setMoveTarget({ item, anchor })
    },
    remove,
    swipeOpenId,
    setSwipeOpenId,
  }

  return (
    <ItemWorkspaceContext value={actions}>
      {children}

      {detailList && (
        <ItemSheet
          item={openList ? openItem : undefined}
          list={detailList}
          isDesktop={isDesktop}
          onToggle={actions.toggle}
          onUpdate={(item, patch) => {
            if (patch.status && isFinalStatus(patch.status) && !isFinalStatus(item.status)) {
              onFinish(item.id)
            }
            updateItem.mutate({ item, patch })
          }}
          onMove={actions.startMove}
          onDelete={remove}
          onClose={() => {
            onOpenItem(undefined)
          }}
        />
      )}
      {!isDesktop && menuList && (
        <ListScope list={menuList}>
          <ItemRowMenuSheet
            item={menuItem}
            onClose={() => {
              setMenuItemId(undefined)
            }}
          />
        </ListScope>
      )}
      {moveFrom && (
        <MoveToList
          from={moveFrom}
          target={moveTarget}
          isDesktop={isDesktop}
          onClose={() => {
            setMoveTarget(null)
          }}
          onMove={move}
          onMoveToNewList={(item) => {
            openCreate({
              onCreated: (created) => {
                move(item, created)
              },
            })
          }}
        />
      )}
    </ItemWorkspaceContext>
  )
}

/** Pone la lista de un grupo de filas encima de las acciones de `ItemWorkspace`. */
export function ListScope({ list, children }: { list: List; children: ReactNode }) {
  const actions = useWorkspaceActions()
  return <ItemActionsContext value={{ ...actions, list }}>{children}</ItemActionsContext>
}
