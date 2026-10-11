import { useQueryClient } from '@tanstack/react-query'
import { format } from 'date-fns'
import { Check, Copy, Trash2 } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'

import { ConfirmDialog } from '@/components/ConfirmDialog'
import { useListActions, type List } from '@/features/lists'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import { queryKeys } from '@/lib/queryKeys'
import { showUndoToast } from '@/lib/undoToast'

import { chosenLabel, isChoosing } from '../chooseOne'
import {
  useDeleteItem,
  useInsertItems,
  useMoveItem,
  useSetItemStatus,
  useUndoRepeat,
  useUpdateItem,
} from '../hooks/useItemMutations'
import { repeatOnDone } from '../recurrence'
import { markRepeatDone } from '../repeatMarks'
import { isFinalStatus, nextStatusOnToggle } from '../status'
import {
  childrenOf,
  deleteSublistLabel,
  deleteSublistMessage,
  duplicateSublist,
  positionAfter,
} from '../sublists'
import type { Item, ItemStatus } from '../types'
import {
  ItemActionsContext,
  ItemWorkspaceContext,
  useWorkspaceActions,
  type RowOrder,
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
  /**
   * Abrir una sublista: tocar su fila entra en ella en vez de abrir su detalle (diseño 12). Con
   * `rename`, entra con el nombre listo para editar. Sin él (Hoy), no hay sublistas en pantalla.
   */
  onOpenSublist?: (item: Item, options?: { rename?: boolean }) => void
  /** Ordenar a mano sus filas (2.9): solo el detalle de una lista que no es de eventos. */
  order?: RowOrder
  children: ReactNode
}

interface PendingDelete {
  item: Item
  children: Item[]
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
  onOpenSublist,
  order,
  children,
}: ItemWorkspaceProps) {
  const isDesktop = useMediaQuery('(min-width: 768px)')
  const statusMutation = useSetItemStatus()
  const undoRepeat = useUndoRepeat()
  const updateItem = useUpdateItem()
  const moveItem = useMoveItem()
  const deleteItem = useDeleteItem()
  const insertItems = useInsertItems()
  const queryClient = useQueryClient()
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null)
  const [shownDelete, setShownDelete] = useState<PendingDelete | null>(null)
  if (pendingDelete && pendingDelete !== shownDelete) setShownDelete(pendingDelete)
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
    // Una tarea que se repite no se va: pasa a su siguiente fecha delante de ti y lo dice el aviso,
    // con «Deshacer» (diseño 21, B9 y B10).
    const next = repeatOnDone(item, status)
    if (next && item.dueAt) {
      const occurrence = item.dueAt
      markRepeatDone(item.id, occurrence)
      statusMutation.mutate({ item, status })
      showUndoToast({
        message: `Hecha · vuelve el ${format(next, 'EEEE d')}`,
        onUndo: () => {
          undoRepeat.mutate({ item: { ...item, dueAt: next }, occurrence })
        },
      })
      return
    }
    // Lo que se termina se queda un instante en su sitio antes de irse (06 §Interacción).
    if (isFinalStatus(status) && !isFinalStatus(item.status)) onFinish(item.id)
    statusMutation.mutate({ item, status })
  }

  const move = (item: Item, to: List, parentId: string | null = null) => {
    const from = listOf(item)
    if (!from) return
    // Dentro de la misma lista (a una sublista o «Sacar de…») el detalle puede seguir abierto.
    if (item.id === openItemId && to.id !== from.id) onOpenItem(undefined)
    moveItem.mutate({ item, from, to, parentId })
  }

  /** Los ítems de la lista del ítem, de la caché: ahí está lo de dentro de cada sublista. */
  const listItems = (item: Item) =>
    queryClient.getQueryData<Item[]>(queryKeys.items.byList(item.listId)) ?? items ?? []

  const deleteNow = (item: Item, inside: readonly Item[]) => {
    if (item.id === openItemId) onOpenItem(undefined)
    deleteItem.mutate(item)
    showUndoToast({
      icon: Trash2,
      message: `«${item.title}» borrada`,
      onUndo: () => {
        insertItems.mutate({ items: [item, ...inside], reason: 'restore' })
      },
    })
  }

  // Una sublista con cosas dentro pide confirmación con el recuento (diseño 12, S5).
  const remove = (item: Item) => {
    const inside = item.kind === 'sublist' ? childrenOf(listItems(item), item.id) : []
    if (inside.length > 0) setPendingDelete({ item, children: inside })
    else deleteNow(item, inside)
  }

  /** La sublista «para elegir una» en la que se elige este ítem, si la hay. */
  const choosingSublist = (item: Item) => {
    if (item.parentId === null) return undefined
    const parent = listItems(item).find((entry) => entry.id === item.parentId)
    return parent && isChoosing(parent) ? parent : undefined
  }

  // «Elegir esta» (diseño 24, A4) marca la preferida, y en la elegida, «Quitar elección». No
  // cambia ningún estado ni cierra la sublista (Fran, 2026-10-11). «Deshacer» vuelve a la de antes.
  const choose = (option: Item) => {
    const sublist = choosingSublist(option)
    if (!sublist) return
    const previous = sublist.chosenId
    const chosenId = previous === option.id ? null : option.id
    updateItem.mutate({ item: sublist, patch: { chosenId } })
    showUndoToast({
      icon: Check,
      message: chosenId ? chosenLabel(option) : 'Elección quitada',
      onUndo: () => {
        updateItem.mutate({ item: { ...sublist, chosenId }, patch: { chosenId: previous } })
      },
    })
  }

  const duplicate = (item: Item) => {
    const all = listItems(item)
    const copies = duplicateSublist(item, childrenOf(all, item.id), {
      newId: () => crypto.randomUUID(),
      position: positionAfter(all, item),
    })
    const [copy] = copies
    if (!copy) return
    insertItems.mutate({ items: copies, reason: 'duplicate' })
    showUndoToast({
      icon: Copy,
      message: `Duplicada como «${copy.title}»`,
      onUndo: () => {
        deleteItem.mutate(copy)
      },
    })
  }

  const actions: WorkspaceActions = {
    isDesktop,
    selectedId: openItemId,
    menuItemId,
    openDetail: (item) => {
      if (item.kind === 'sublist' && onOpenSublist) onOpenSublist(item)
      else onOpenItem(item.id)
    },
    toggle: (item) => {
      const list = listOf(item)
      if (list) setStatus(item, nextStatusOnToggle(item.kind, item.status))
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
    duplicate,
    rename: (item) => {
      onOpenSublist?.(item, { rename: true })
    },
    choose,
    setChooseOne: (sublist, chooseOne) => {
      updateItem.mutate({ item: sublist, patch: { chooseOne } })
    },
    swipeOpenId,
    setSwipeOpenId,
    order,
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
            // «Hecha» en la ficha de una que se repite: como el check de su fila.
            if (patch.status && repeatOnDone(item, patch.status)) {
              setStatus(item, patch.status)
              return
            }
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
          onMove={(item, destination) => {
            move(item, destination.list, destination.sublist?.id ?? null)
          }}
          onMoveToNewList={(item) => {
            openCreate({
              onCreated: (created) => {
                move(item, created)
              },
            })
          }}
        />
      )}
      {shownDelete && (
        <ConfirmDialog
          open={pendingDelete !== null}
          onOpenChange={(open) => {
            if (!open) setPendingDelete(null)
          }}
          title={`¿Borrar «${shownDelete.item.title}»?`}
          description={deleteSublistMessage(shownDelete.children)}
          confirmLabel={deleteSublistLabel(shownDelete.children)}
          onConfirm={() => {
            deleteNow(shownDelete.item, shownDelete.children)
          }}
        />
      )}
    </ItemWorkspaceContext>
  )
}

/**
 * Pone la lista de un grupo de filas encima de las acciones de `ItemWorkspace`, y si alguna de esas
 * filas lleva precio (`hasPrices`).
 */
export function ListScope({
  list,
  prices = false,
  children,
}: {
  list: List
  prices?: boolean
  children: ReactNode
}) {
  const actions = useWorkspaceActions()
  return <ItemActionsContext value={{ ...actions, list, prices }}>{children}</ItemActionsContext>
}
