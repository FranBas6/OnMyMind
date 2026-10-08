import { addDays, format, isSameDay, isSameYear, startOfDay } from 'date-fns'

import type { NaturalDate } from '@/lib/naturalDate'

import { formatRule, recurrenceLabel, simpleRule } from './recurrence'
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
  /** «cada martes y viernes» (3.6): la regla de `items.recurrence`; `due` es su primera vez. */
  recurrence: string | null
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
  const recurrence = parsed.repeat
    ? formatRule({
        ...simpleRule(parsed.repeat.freq),
        interval: parsed.repeat.interval,
        weekdays: parsed.repeat.weekdays,
      })
    : null
  if (kind === 'event') {
    return {
      due: { at: parsed.date, allDay: !parsed.hasTime },
      reminderOffsetMinutes: null,
      recurrence,
    }
  }
  if (kind === 'task') {
    return {
      due: { at: startOfDay(parsed.date), allDay: true },
      reminderOffsetMinutes: parsed.hasTime
        ? -(parsed.date.getHours() * 60 + parsed.date.getMinutes())
        : null,
      recurrence,
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
 * Lo que dice la pastilla (diseño 21, A1–A4 y A8): el evento, «Vie 9 oct · 21:00»; la tarea, «Vence
 * mié 7 oct» y, si la hora es su aviso, «Vence mié 7» y aparte «Aviso 10:00» con la campana. Lo
 * que se repite, la regla y desde cuándo: «Cada martes · 19:00 · desde el 13», «Martes y viernes ·
 * desde vie 9». `repeats` cambia el icono.
 */
export function writtenDateLabel(
  written: WrittenDate,
  kind: ItemKind,
  now: Date = new Date(),
): { day: string; reminder: string | null; repeats: boolean } {
  const { at, allDay } = written.due
  const rule = recurrenceLabel(written.recurrence)
  const reminder =
    written.reminderOffsetMinutes === null ? null : `Aviso ${clock(-written.reminderOffsetMinutes)}`
  if (rule) {
    const parts =
      kind === 'event'
        ? [rule, ...(allDay ? [] : [format(at, 'H:mm')]), `desde el ${format(at, 'd')}`]
        : [rule, `desde ${dayText(at, now, false)}`]
    return { day: parts.join(' · '), reminder, repeats: true }
  }
  if (kind === 'event') {
    const day = capitalize(dayText(at, now, true))
    return { day: allDay ? day : `${day} · ${format(at, 'H:mm')}`, reminder: null, repeats: false }
  }
  if (!reminder) return { day: `Vence ${dayText(at, now, true)}`, reminder: null, repeats: false }
  return { day: `Vence ${dayText(at, now, false)}`, reminder, repeats: false }
}

/**
 * La pastilla corta de una línea pegada (diseño 23, B5): «Mañana · 🔔 10:00». El día como se dice
 * («Hoy», «Mañana», «Vie 9») o la regla si se repite; la hora del evento, o la del aviso de la
 * tarea con su campana (`bell`).
 */
export function compactWrittenDateLabel(
  written: WrittenDate,
  kind: ItemKind,
  now: Date = new Date(),
): { day: string; time: string | null; bell: boolean; repeats: boolean } {
  const { at, allDay } = written.due
  const rule = recurrenceLabel(written.recurrence)
  const day =
    rule ??
    (isSameDay(at, now)
      ? 'Hoy'
      : isSameDay(at, addDays(now, 1))
        ? 'Mañana'
        : capitalize(dayText(at, now, false)))
  if (kind === 'event') {
    return { day, time: allDay ? null : format(at, 'H:mm'), bell: false, repeats: rule !== null }
  }
  const reminder = written.reminderOffsetMinutes
  return {
    day,
    time: reminder === null ? null : clock(-reminder),
    bell: reminder !== null,
    repeats: rule !== null,
  }
}

/** Minutos desde las 00:00 como hora: 600 son las «10:00». */
function clock(minutes: number): string {
  return `${String(Math.floor(minutes / 60))}:${String(minutes % 60).padStart(2, '0')}`
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1)
}
