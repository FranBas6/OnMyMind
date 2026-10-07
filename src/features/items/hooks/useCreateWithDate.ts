// Por su ruta y no por el índice: `reminders` usa piezas de `items`.
import { reminderFor, useSetReminder } from '@/features/reminders/hooks/useReminders'

import type { NewItem } from '../api'
import type { WrittenDate } from '../writtenDate'
import { itemFromNew, useCreateItem } from './useItemMutations'

/**
 * Crea un ítem con lo entendido de su fecha escrita (3.5): nace con su fecha y, si es una tarea con
 * hora, con su aviso a esa hora (decisión de Fran, 2026-10-07). El aviso va detrás en la misma fila
 * de mutaciones, así que sin red sale después del alta, también con la app cerrada (2.10).
 */
export function useCreateWithDate() {
  const createItem = useCreateItem()
  const setReminder = useSetReminder()
  return (item: NewItem, written: WrittenDate | null): NewItem => {
    const dated: NewItem = written ? { ...item, due: written.due } : item
    createItem.mutate(dated)
    if (written && written.reminderOffsetMinutes !== null) {
      const created = itemFromNew(dated, dated.position ?? 0)
      const next = reminderFor(created, { offsetMinutes: written.reminderOffsetMinutes }, undefined)
      if (next) setReminder.mutate({ item: created, next })
    }
    return dated
  }
}
