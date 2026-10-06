import { useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'

import { itemMutationKey, OFFLINE_TOLERANT } from '@/features/items/hooks/useItemMutations'
import type { Item } from '@/features/items/types'
import { errorMessage } from '@/lib/errors'
import { durableMutation, useDurableMutation } from '@/lib/mutations'
import { queryKeys } from '@/lib/queryKeys'

import { deleteReminder, saveReminder } from '../api'
import { remindersQueryOptions } from '../queries'
import { reminderAt, type Reminder } from '../reminders'

/** El aviso de un ítem, si tiene. */
export function useItemReminder(itemId: string): Reminder | undefined {
  const { data } = useQuery(remindersQueryOptions)
  return data?.find((reminder) => reminder.itemId === itemId)
}

/** Un aviso relativo (desfase en minutos) o personalizado (día y hora). */
export type ReminderChoice = { offsetMinutes: number } | { remindAt: Date }

/**
 * Pone, cambia o quita el aviso de un ítem, con el patrón optimista de los ítems: se ve al
 * instante, va en su misma fila (sin red espera, también con la app cerrada) y, si el servidor
 * dice que no, vuelve atrás. Al terminar se pide otra vez: la base es la que calcula `remind_at`
 * de uno relativo.
 */
const setReminderMutation = durableMutation(itemMutationKey('reminder'), (queryClient) => {
  const key = queryKeys.reminders
  return {
    ...OFFLINE_TOLERANT,
    mutationFn: ({ next, item }: { item: Item; next: Reminder | null }) =>
      next ? saveReminder(next) : deleteReminder(item.id),
    onMutate: async ({ item, next }) => {
      await queryClient.cancelQueries({ queryKey: key })
      const previous = queryClient.getQueryData<Reminder[]>(key)
      queryClient.setQueryData<Reminder[]>(key, (reminders = []) => [
        ...reminders.filter((reminder) => reminder.itemId !== item.id),
        ...(next ? [next] : []),
      ])
      return { previous }
    },
    onError: (error, _variables, context) => {
      if (context?.previous) queryClient.setQueryData(key, context.previous)
      toast.error(`No se ha podido guardar el aviso. ${errorMessage(error)}`)
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: key })
    },
  }
})

export function useSetReminder() {
  return useDurableMutation(setReminderMutation)
}

/** Las mutaciones de avisos que se registran en el QueryClient (2.10). */
export const reminderMutations = [setReminderMutation]

/** El aviso que se guardaría con una elección; `null` si no tiene sentido (un relativo sin fecha). */
export function reminderFor(
  item: Item,
  choice: ReminderChoice,
  current: Reminder | undefined,
  now: Date = new Date(),
): Reminder | null {
  const remindAt =
    'remindAt' in choice ? choice.remindAt : reminderAt(item, choice.offsetMinutes, now)
  if (!remindAt) return null
  return {
    id: current?.id ?? crypto.randomUUID(),
    itemId: item.id,
    remindAt,
    offsetMinutes: 'offsetMinutes' in choice ? choice.offsetMinutes : null,
    sentAt: null,
  }
}
