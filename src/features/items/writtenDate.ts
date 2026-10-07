import { format, isSameYear, startOfDay } from 'date-fns'

import type { NaturalDate } from '@/lib/naturalDate'

import type { ItemKind } from './status'

/** La fecha con la que nace un ítem (3.5): su `due_at` y si es de todo el día. */
export interface NewItemDue {
  at: Date
  allDay: boolean
}

/** Lo que se guarda de una fecha escrita: la fecha del ítem y, en una tarea con hora, su aviso. */
export interface WrittenDate {
  due: NewItemDue
  /**
   * Una tarea solo tiene día: si se dijo una hora, es su aviso (decisión de Fran, 2026-10-07). Va
   * en minutos antes de las 00:00 de ese día, como «Ese día a las 9:00» (negativo: después).
   */
  reminderOffsetMinutes: number | null
}

/** Si en un ítem de este tipo se interpreta lo escrito: tareas y eventos (no compras ni notas). */
export function readsWrittenDates(kind: ItemKind): boolean {
  return kind === 'task' || kind === 'event'
}

/**
 * Qué se guarda de lo entendido según el tipo. Un evento, con su hora o de todo el día; una tarea,
 * su día (a las 00:00, como su «Fecha límite») y la hora, si la hay, como aviso. `null` si el tipo
 * no lleva fecha.
 */
export function writtenDateFields(parsed: NaturalDate, kind: ItemKind): WrittenDate | null {
  if (kind === 'event') {
    return { due: { at: parsed.date, allDay: !parsed.hasTime }, reminderOffsetMinutes: null }
  }
  if (kind === 'task') {
    return {
      due: { at: startOfDay(parsed.date), allDay: true },
      reminderOffsetMinutes: parsed.hasTime
        ? -(parsed.date.getHours() * 60 + parsed.date.getMinutes())
        : null,
    }
  }
  return null
}

/** «Vie 9 oct», con el año si no es este («Vie 9 oct 2027»); sin mes, «mié 7». */
function dayText(date: Date, now: Date, withMonth: boolean): string {
  if (!withMonth) return format(date, 'EEE d')
  return format(date, isSameYear(date, now) ? 'EEE d MMM' : 'EEE d MMM yyyy')
}

/**
 * Lo que dice la pastilla (diseño 21, A1–A3): el evento, «Vie 9 oct · 21:00»; la tarea, «Vence
 * mié 7 oct» y, si la hora es su aviso, «Vence mié 7» y aparte «Aviso 10:00» con la campana.
 */
export function writtenDateLabel(
  written: WrittenDate,
  kind: ItemKind,
  now: Date = new Date(),
): { day: string; reminder: string | null } {
  const { at, allDay } = written.due
  if (kind === 'event') {
    const day = capitalize(dayText(at, now, true))
    return { day: allDay ? day : `${day} · ${format(at, 'H:mm')}`, reminder: null }
  }
  const offset = written.reminderOffsetMinutes
  if (offset === null) return { day: `Vence ${dayText(at, now, true)}`, reminder: null }
  const minutes = -offset
  const time = `${String(Math.floor(minutes / 60))}:${String(minutes % 60).padStart(2, '0')}`
  return { day: `Vence ${dayText(at, now, false)}`, reminder: `Aviso ${time}` }
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1)
}
