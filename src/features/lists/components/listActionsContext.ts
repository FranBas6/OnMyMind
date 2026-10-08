import { createContext, use } from 'react'

import type { List } from '../types'

export interface ListActions {
  /** `onCreated` recibe la lista recién creada (p. ej. para mover ahí un ítem). */
  openCreate: (options?: { onCreated?: (list: List) => void }) => void
  openEdit: (list: List) => void
  confirmDelete: (list: List) => void
  archive: (list: List) => void
  unarchive: (list: List) => void
  /** «Duplicar» (4.4, diseño 23, C): abre la hoja con el nombre de la copia. */
  duplicate: (list: List) => void
  /**
   * Quién está en la lista (diseño 20): «Compartir» para quien la creó y «Quién está» para quien
   * entró. `confirmLeave` la abre ya preguntando si sales (M3 → M5).
   */
  openPeople: (list: List, options?: { confirmLeave?: boolean }) => void
}

export const ListActionsContext = createContext<ListActions | null>(null)

/** Acciones sobre listas (crear, editar, archivar, desarchivar, borrar); ver `ListActionsProvider`. */
export function useListActions(): ListActions {
  const actions = use(ListActionsContext)
  if (!actions) throw new Error('useListActions necesita un ListActionsProvider por encima')
  return actions
}
