import { createContext, use } from 'react'

import type { List } from '../types'

export interface ListActions {
  openCreate: () => void
  openEdit: (list: List) => void
  confirmDelete: (list: List) => void
  archive: (list: List) => void
  unarchive: (list: List) => void
}

export const ListActionsContext = createContext<ListActions | null>(null)

/** Acciones sobre listas (crear, editar, archivar, desarchivar, borrar); ver `ListActionsProvider`. */
export function useListActions(): ListActions {
  const actions = use(ListActionsContext)
  if (!actions) throw new Error('useListActions necesita un ListActionsProvider por encima')
  return actions
}
