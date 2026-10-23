import { format } from 'date-fns'
import { Calendar, Repeat } from 'lucide-react'
import type { ReactNode } from 'react'

// Por sus rutas y no por el índice: `reminders` usa piezas de `items`.
import { ReminderBell } from '@/features/reminders/components/ReminderBell'
import { useItemReminder } from '@/features/reminders/hooks/useReminders'
import { showsBell } from '@/features/reminders/reminders'
import { useNow } from '@/hooks/useNow'
import { cn } from '@/lib/utils'
import { ItemPersonMark } from '@/features/sharing/components/ItemPersonMark'
import { useItemPerson } from '@/features/sharing/hooks/useSharing'

import { eventTime, isEarlierToday, isPastEvent, occurrence, shortDay } from '../events'
import { recurrenceLabel } from '../recurrence'
import { hasThumb } from '../photos'
import type { Item } from '../types'
import { rowHighlight, useItemActions } from './itemActionsContext'
import { ItemRowDotsMenu } from './ItemRowMenu'
import { FileMeta, RowThumb } from './RowMedia'
import { RowNotes, RowTitle } from './RowTitle'
import { SwipeableRow } from './SwipeableRow'

const META = 'flex items-center gap-1 text-xs font-semibold whitespace-nowrap md:text-[13px]'

/**
 * Fila de un evento en una lista de eventos (diseño 17, E1–E3 y D1): sin checkbox, empieza por la
 * hora en una columna de 56 px (Plus Jakarta 800), o «Todo el día» en dos líneas, o el calendario
 * si no tiene día. En un grupo de mes (`byMonth`), esa columna dice el día («Sáb» y «15») y la hora
 * baja a la meta. Debajo del título, solo lo que añade: «↻ Cada mes», «Poner día» o «Cancelado».
 * Uno de hoy cuya hora ya pasó va con la hora y el título en gris, sin bajar la opacidad. En una
 * lista mixta el evento usa la fila de siempre (`TaskRow`), con su día y su hora en la meta.
 */
export function EventRow({ item, byMonth = false }: { item: Item; byMonth?: boolean }) {
  const actions = useItemActions()
  // Cada minuto: lo de hoy se apaga solo al pasar su hora.
  const now = new Date(useNow(60_000))
  const at = occurrence(item, now)
  // Ya pasó, o es de hoy y su hora ya pasó: hora y título en gris (E1 y E3).
  const earlier = isEarlierToday(item, now) || isPastEvent(item, now)
  const cancelled = item.status === 'cancelled'
  const time = eventTime(item)
  const thumb = hasThumb(item)

  const lead: ReactNode = !at ? (
    <Calendar aria-hidden className="size-[18px] text-muted-foreground" strokeWidth={2.2} />
  ) : byMonth ? (
    <span className={cn('flex flex-col leading-tight', earlier && 'text-subtle-foreground')}>
      <span className="text-[13px] font-semibold">{shortDay(at, now).split(' ')[0]}</span>
      <span className="font-display text-[17px] font-extrabold">{format(at, 'd')}</span>
    </span>
  ) : time ? (
    <span
      className={cn(
        'font-display text-[17px] font-extrabold tracking-[-0.01em]',
        earlier && 'text-subtle-foreground',
      )}
    >
      {time}
    </span>
  ) : (
    <span className="block text-xs leading-tight font-semibold text-muted-foreground">
      Todo
      <br />
      el día
    </span>
  )

  // Para un lector de pantalla, la columna de la izquierda en palabras.
  const spoken = !at
    ? 'Sin fecha.'
    : byMonth
      ? `${shortDay(at, now)}, ${time ?? 'todo el día'}.`
      : time
        ? `A las ${time}.`
        : 'Todo el día.'

  const reminder = useItemReminder(item.id)
  // En una lista compartida, la inicial de quien lo añadió si no fuiste tú (diseño 20, M2).
  const person = useItemPerson(item)
  const meta: ReactNode[] = []
  if (person) {
    meta.push(
      <span key="person" className={META}>
        <ItemPersonMark person={person} item={item} />
      </span>,
    )
  }
  if (!at) {
    meta.push(
      <span key="day" className={cn(META, 'text-primary')}>
        Poner día
      </span>,
    )
  }
  if (byMonth && at) {
    meta.push(
      <span key="time" className={cn(META, 'text-muted-foreground')}>
        {time ?? 'Todo el día'}
      </span>,
    )
  }
  const repeat = recurrenceLabel(item.recurrence, true)
  if (repeat) {
    meta.push(
      <span key="repeat" className={cn(META, 'min-w-0 text-muted-foreground')}>
        <Repeat aria-hidden className="size-3 shrink-0" strokeWidth={2.4} />
        <span className="truncate">{repeat}</span>
      </span>,
    )
  }
  if (showsBell(reminder, item)) {
    meta.push(
      <ReminderBell key="reminder" item={item} className={cn(META, 'text-muted-foreground')} />,
    )
  }
  if (item.files.length > 0) {
    meta.push(<FileMeta key="files" item={item} className={cn(META, 'text-muted-foreground')} />)
  }
  if (cancelled) {
    meta.push(
      <span key="cancelled" className={cn(META, 'text-muted-foreground')}>
        Cancelado
      </span>,
    )
  }

  return (
    <SwipeableRow
      item={item}
      surfaceClassName={cn(
        'group relative flex min-h-14 animate-in items-center gap-3.5 rounded-[18px] border border-border-soft bg-card px-4 py-3.5 duration-200 fade-in hover:border-border hover:shadow-card md:grid md:gap-4 md:rounded-2xl md:py-3 md:pr-3 md:pl-[18px]',
        thumb
          ? 'md:grid-cols-[56px_44px_minmax(0,1fr)_32px]'
          : 'md:grid-cols-[56px_minmax(0,1fr)_32px]',
        rowHighlight(actions, item),
      )}
    >
      <span className="w-14 shrink-0">
        <span className="sr-only">{spoken}</span>
        <span aria-hidden className="block leading-tight">
          {lead}
        </span>
      </span>
      <RowThumb item={item} />
      <div className="min-w-0 flex-1">
        <RowTitle
          item={item}
          className={cn(
            'truncate md:whitespace-normal',
            (earlier || cancelled) && 'text-subtle-foreground',
            cancelled && 'line-through',
          )}
        />
        <RowNotes notes={item.notes} />
        {meta.length > 0 && <div className="mt-1 flex items-center gap-2.5">{meta}</div>}
      </div>
      {actions.isDesktop && <ItemRowDotsMenu item={item} />}
    </SwipeableRow>
  )
}
