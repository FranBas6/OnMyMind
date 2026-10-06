import { createContext, use } from 'react'

import type { List } from '@/features/lists'

import type { Item, ItemStatus } from '../types'

/**
 * Lo que se puede hacer con un ítem desde su fila, su menú o su detalle. Lo da `ItemWorkspace` a
 * todas las filas, para no pasar media docena de callbacks por cada una; `list` lo pone
 * `ListScope` encima de cada grupo de filas (una en el detalle de lista, una por sección en Hoy).
 */
export interface ItemActions {
  /** La lista de estas filas: decide su aspecto (chips, acciones al deslizar). */
  list: List
  /**
   * Si alguna de estas filas lleva precio: en escritorio todas reservan su columna, para que no se
   * muevan las de tareas (diseño 16, D2). Lo pone `ListScope`.
   */
  prices: boolean
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
  /** Duplicar una sublista con lo de dentro (diseño 12, S6). */
  duplicate: (item: Item) => void
  /** Renombrar una sublista: se abre con el nombre listo para editar (su título es editable). */
  rename: (item: Item) => void
  /** La fila abierta a la izquierda al deslizar («Mover» y «Borrar»): solo una a la vez. */
  swipeOpenId: string | undefined
  setSwipeOpenId: (itemId: string | undefined) => void
  /**
   * Ordenar a mano (2.9, diseño 14), donde se puede: el detalle de una lista que no es de eventos.
   * Sin él (Hoy, Buscar, eventos) las filas no se levantan ni tienen «Subir» y «Bajar».
   */
  order: RowOrder | undefined
}

/** El orden a mano de las filas que se ven (lo pone el detalle de lista). */
export interface RowOrder {
  /** Lo que se puede ordenar, en el orden en que se ve («Fuera de la cabeza» no). */
  ids: readonly string[]
  /** Soltar `movedId` donde estaba `overId` (ocupa su sitio). */
  drop: (movedId: string, overId: string) => void
  /** «Subir» y «Bajar» del menú, y ⌥↑ ⌥↓. */
  step: (item: Item, direction: 'up' | 'down') => void
}

/** Todo menos la lista: las acciones valen para ítems de cualquier lista (cada uno usa la suya). */
export type WorkspaceActions = Omit<ItemActions, 'list' | 'prices'>

export const ItemWorkspaceContext = createContext<WorkspaceActions | null>(null)

export function useWorkspaceActions(): WorkspaceActions {
  const actions = use(ItemWorkspaceContext)
  if (!actions) throw new Error('useWorkspaceActions necesita un ItemWorkspace por encima')
  return actions
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
