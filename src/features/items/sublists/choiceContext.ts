import { createContext, use } from 'react'

import { useOptionalPrivate } from '@/features/private'
import { personName } from '@/features/sharing'
import { useListSharing } from '@/features/sharing'

import { chooseNote, isChoosing, type OptionMark } from './chooseOne'
import { isPayment, isRecurringPayment, returnsShort } from '../payments/payments'
import { repeatOnDone } from '../dates/recurrence'
import { protectionBlock } from '../notes/protection'
import type { Protection, RowActionsContext } from '../rows/rowActions'
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
 * una»; en una opción aún en juego, «Elegir esta» arriba del todo. En una nota, si está protegida o
 * se puede proteger (5.7, diseño 26). Sin ítem (la hoja cerrada), nada.
 */
export function useRowActionsContext(item: Item | undefined): RowActionsContext {
  const choice = use(ChoiceContext)
  const protection = useProtection(item)
  if (!item) return {}
  if (item.kind === 'sublist') return { chooseOne: item.chooseOne }
  // Un pago (6.4): «Pagado» y, si se repite, cuándo vuelve y «Darse de baja» (diseño 30, B1).
  const payment = paymentContext(item)
  const sublist = choice?.sublist
  if (sublist?.id !== item.parentId || !isChoosing(sublist) || isOutOfMind(item)) {
    return { ...(protection && { protection }), ...(payment && { payment }) }
  }
  return {
    option: { note: chooseNote(item), chosen: sublist.chosenId === item.id },
    ...(protection && { protection }),
    ...(payment && { payment }),
  }
}

function paymentContext(item: Item): RowActionsContext['payment'] {
  if (!isPayment(item)) return undefined
  const recurring = isRecurringPayment(item)
  const next = recurring ? repeatOnDone(item, 'bought') : null
  return { recurring, returns: next ? returnsShort(next) : null }
}

/**
 * Si una nota está protegida, o si se puede proteger y qué falta (C6, C6d, C9). Fuera de la clave
 * privada (piezas sueltas en tests), nada: sin «Proteger».
 */
function useProtection(item: Item | undefined): Protection | undefined {
  const privacy = useOptionalPrivate()
  const { others } = useListSharing(item?.listId)
  if (item?.kind !== 'note' || !privacy) return undefined
  if (item.sealed) return { protected: true }
  return {
    protected: false,
    needsKey: privacy.status === 'ready' && privacy.vault === null,
    blocked: protectionBlock(
      item,
      others.map((person) => personName(person.displayName)),
    ),
  }
}
