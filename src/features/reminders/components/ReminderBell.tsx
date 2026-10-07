import { format, isSameDay } from 'date-fns'
import { Bell } from 'lucide-react'

import type { Item } from '@/features/items/types'
import { cn } from '@/lib/utils'

import { useItemReminder } from '../hooks/useReminders'
import { reminderRowLabel, reminderShape, showsBell } from '../reminders'

/**
 * La campana de un ítem con aviso en su fila (diseño 18, R13 y D1): solo el icono de 12 px en la
 * meta, junto a la fecha. Si no tiene fecha, lleva el momento del aviso («Lun 13 oct · 17:00»),
 * porque es lo único que dice cuándo. Lo avisado, lo hecho y lo cancelado ya no la llevan.
 * Con día y sin hora (una tarea), si avisa ese mismo día, lleva la hora del aviso: «Mañana ·
 * 🔔 10:00» (diseño 21, A10), que es lo que dice «Llamar al seguro mañana 10h».
 */
export function ReminderBell({ item, className }: { item: Item; className?: string }) {
  const reminder = useItemReminder(item.id)
  if (!reminder || !showsBell(reminder, item)) return null
  const undated = item.dueAt === null
  const sameDay =
    item.dueAt !== null &&
    reminderShape(item) === 'dated' &&
    isSameDay(reminder.remindAt, item.dueAt)
  return (
    <span className={cn('flex items-center gap-1', className)}>
      <Bell aria-hidden className="size-3 shrink-0" strokeWidth={2.4} />
      {undated ? (
        reminderRowLabel(reminder, item)
      ) : sameDay ? (
        <>
          <span className="sr-only">Aviso a las </span>
          {format(reminder.remindAt, 'H:mm')}
        </>
      ) : (
        <span className="sr-only">Con aviso</span>
      )}
    </span>
  )
}
