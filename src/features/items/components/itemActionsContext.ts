import { createContext, use } from 'react'

import type { List } from '@/features/lists'

import type { Item, ItemStatus } from '../types'

/**
 * Lo que se puede hacer con un ítem desde su fila, su menú o su detalle. Lo da `ListDetail` a
 * todas las filas, para no pasar media docena de callbacks por cada una.
 */
export interface ItemActions {
  list: List
  isDesktop: boolean
  /** El ítem con el detalle abierto (`?item=`): su fila va resaltada en escritorio. */
  selectedId: string | undefined
  /** El ítem con el menú de fila abierto en móvil: su fila va resaltada. */
  menuItemId: string | undefined
  openDetail: (item: Item) => void
  toggle: (item: Item) => void
  setStatus: (item: Item, status: ItemStatus) => void
  /** Menú de fila en móvil (pulsación larga). */
  openMenu: (item: Item) => void
  startMove: (item: Item, anchor: HTMLElement | null) => void
  remove: (item: Item) => void
  /** La fila abierta a la izquierda al deslizar («Mover» y «Borrar»): solo una a la vez. */
  swipeOpenId: string | undefined
  setSwipeOpenId: (itemId: string | undefined) => void
}

export const ItemActionsContext = createContext<ItemActions | null>(null)

export function useItemActions(): ItemActions {
  const actions = use(ItemActionsContext)
  if (!actions) throw new Error('useItemActions necesita un ItemActionsContext por encima')
  return actions
}

/**
 * Contorno índigo de la fila abierta en el detalle (escritorio) o con el menú abierto (móvil).
 * Va por dentro del borde: la fila recorta lo que se sale al deslizarla.
 */
export function rowHighlight(actions: ItemActions, item: Item): string | false {
  const active =
    (actions.isDesktop && actions.selectedId === item.id) || actions.menuItemId === item.id
  return active && 'outline-2 -outline-offset-2 outline-primary outline-solid'
}
