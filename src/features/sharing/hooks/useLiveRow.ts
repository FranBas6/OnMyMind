import { isFinalStatus } from '@/features/items/status'
import type { Item } from '@/features/items/types'

import { useArrived, useCompletedLive } from '../liveRows'
import { useItemPerson } from './useSharing'

/**
 * Cómo se ve una fila de una lista compartida (diseño 20): de quién es su inicial (M2), si acaba
 * de entrar de otro (`arrived`, M7) y si otro la acaba de terminar delante de ti (`done`, M8).
 */
export function useLiveRow(item: Item) {
  const person = useItemPerson(item)
  const arrived = useArrived(item.id)
  const done = useCompletedLive().has(item.id) && isFinalStatus(item.status) && person !== null
  return { person, arrived, done }
}
