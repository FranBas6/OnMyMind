import { createContext, use } from 'react'

import { chooseNote, isChoosing, type OptionMark } from '../chooseOne'
import type { RowActionsContext } from '../rowActions'
import { isOutOfMind } from '../status'
import type { Item } from '../types'

/**
 * La sublista «para elegir una» abierta en pantalla (5.1, diseño 24) y lo que dice cada opción
 * («Más barata», «+50,99 €», «Elegida»…). Lo pone el detalle de la sublista por encima de sus filas
 * y de su menú; en el resto de pantallas no hay, y las filas se ven como siempre.
 */
export interface Choice {
  sublist: Item
  marks: ReadonlyMap<string, OptionMark>
}

export const ChoiceContext = createContext<Choice | null>(null)

/** Lo que dice esta opción a la derecha, si está en una sublista «para elegir una» abierta. */
export function useOptionMark(item: Pick<Item, 'id'>): OptionMark | null {
  return use(ChoiceContext)?.marks.get(item.id) ?? null
}

/**
 * Lo que cambia en el menú de una fila (A1, A4): en la sublista, «Elegir una» o «Dejar de elegir
 * una»; en una opción aún en juego, «Elegir esta» arriba del todo. Sin ítem (la hoja cerrada), nada.
 */
export function useRowActionsContext(item: Item | undefined): RowActionsContext {
  const choice = use(ChoiceContext)
  if (!item) return {}
  if (item.kind === 'sublist') return { chooseOne: item.chooseOne }
  const sublist = choice?.sublist
  if (sublist?.id !== item.parentId || !isChoosing(sublist) || isOutOfMind(item)) {
    return {}
  }
  return { option: { note: chooseNote(item), chosen: sublist.chosenId === item.id } }
}
