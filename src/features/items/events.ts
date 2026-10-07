import {
  addDays,
  differenceInCalendarDays,
  format,
  isSameMonth,
  isSameYear,
  startOfDay,
} from 'date-fns'

import { occurrenceFrom, occurrencesFrom, parseRule, repeats, type Rule } from './recurrence'
import type { Item } from './types'

/**
 * Lo puro de los eventos (sesión 2.4, 03 §items): cuándo un evento ya pasó, la siguiente vez de
 * uno que se repite y los grupos por día de una lista de eventos. Los días son los del
 * dispositivo, como en Hoy: una fecha sin hora se guarda como las 00:00 locales (04 §Fechas).
 */

type EventFields = Pick<Item, 'dueAt' | 'allDay' | 'recurrence'>

/**
 * Si un evento ya pasó: su día acabó (decisión de Fran, 2026-10-02). Uno de hoy sigue en su sitio
 * hasta medianoche aunque su hora haya pasado; uno que se repite nunca pasa, y uno sin fecha
 * tampoco.
 */
export function isPastEvent(
  event: Pick<Item, 'dueAt' | 'recurrence'>,
  now: Date = new Date(),
): boolean {
  if (event.dueAt === null || repeats(event.recurrence)) return false
  return event.dueAt < startOfDay(now)
}

/** Uno de hoy cuya hora ya pasó: se ve atenuado hasta medianoche. Los de todo el día, no. */
export function isEarlierToday(event: EventFields, now: Date = new Date()): boolean {
  const at = occurrence(event, now)
  return at !== null && !event.allDay && differenceInCalendarDays(at, now) === 0 && at < now
}

/**
 * La siguiente vez de uno que se repite: la primera que cae hoy o después, a la misma hora. Si aún
 * no ha empezado, es la primera. Las cuentas, en `recurrence.ts` (3.6).
 */
export function nextOccurrence(first: Date, rule: Rule, now: Date = new Date()): Date {
  return occurrenceFrom(first, rule, startOfDay(now)) ?? first
}

/**
 * Cuándo toca un evento: su fecha o, si se repite, la siguiente vez. `null` si no tiene fecha. Es
 * la fecha de su fila y la de su grupo.
 */
export function occurrence(event: EventFields, now: Date = new Date()): Date | null {
  if (event.dueAt === null) return null
  const rule = parseRule(event.recurrence)
  return rule ? nextOccurrence(event.dueAt, rule, now) : event.dueAt
}

/**
 * Si un evento toca un día concreto, también los que se repiten (Hoy y, en la 2.5, cualquier
 * otro día). Uno que se repite no toca antes de su primera vez.
 */
export function occursOn(event: EventFields, day: Date): boolean {
  if (event.dueAt === null) return false
  const rule = parseRule(event.recurrence)
  if (!rule) return differenceInCalendarDays(event.dueAt, day) === 0
  const at = occurrenceFrom(event.dueAt, rule, startOfDay(day))
  return at !== null && differenceInCalendarDays(at, day) === 0
}

/**
 * Las veces que toca un evento entre dos días (`start` incluido, `end` no), también las de uno que
 * se repite: los puntos del calendario de Hoy (diseño 17, C1 y D4). Uno que se repite no toca
 * antes de su primera vez.
 */
export function occurrencesBetween(event: EventFields, start: Date, end: Date): Date[] {
  const { dueAt } = event
  if (dueAt === null) return []
  const from = startOfDay(start)
  const rule = parseRule(event.recurrence)
  if (!rule) return dueAt >= from && dueAt < end ? [dueAt] : []
  const found: Date[] = []
  for (const at of occurrencesFrom(dueAt, rule, from)) {
    if (at >= end) break
    found.push(at)
  }
  return found
}

/** Hasta cuántos días antes o después un día se nombra por su día de la semana («Jueves 25»). */
const WEEKDAY_DAYS = 6
/** Más allá de cuatro semanas se agrupa por meses (diseño 17, E2). */
const MONTH_AFTER_DAYS = 27

/** «sep», «oct 2027»: el mes corto, con el año si no es el de ahora. */
function shortDate(day: Date, now: Date): string {
  return format(day, isSameYear(day, now) ? 'd MMM' : 'd MMM yyyy')
}

/**
 * El nombre de un día en la lista de eventos (diseño 17, E1): «Hoy · Lunes 22», «Mañana · Martes
 * 23», «Ayer · Domingo 21», el día de la semana hasta seis días antes o después («Jueves 25») y,
 * más allá, con el mes («Sábado 4 oct», «Sábado 4 oct 2027»).
 */
export function dayLabel(day: Date, now: Date = new Date()): string {
  const days = differenceInCalendarDays(day, now)
  const weekday = capitalize(format(day, 'EEEE'))
  const name =
    Math.abs(days) <= WEEKDAY_DAYS
      ? `${weekday} ${format(day, 'd')}`
      : `${weekday} ${shortDate(day, now)}`
  if (days === 0) return `Hoy · ${name}`
  if (days === 1) return `Mañana · ${name}`
  if (days === -1) return `Ayer · ${name}`
  return name
}

/** «Noviembre», «Enero 2027»: el nombre de un mes como grupo (diseño 17, E2 y E3). */
export function monthLabel(day: Date, now: Date = new Date()): string {
  return capitalize(format(day, isSameYear(day, now) ? 'LLLL' : 'LLLL yyyy'))
}

/**
 * Si un día va en el grupo de su mes en vez de en el suyo: lo de dentro de más de cuatro semanas
 * y lo pasado de hace más de seis días (diseño 17, E2 y E3).
 */
export function groupsByMonth(day: Date, now: Date = new Date()): boolean {
  const days = differenceInCalendarDays(day, now)
  return days > MONTH_AFTER_DAYS || days < -WEEKDAY_DAYS
}

export interface EventGroup<T> {
  /** `none` para «Sin fecha»; si no, el día (`2026-10-22`) o el mes (`2026-11`). */
  key: string
  label: string
  /** Un grupo de mes: cada fila dice su día en la columna de la hora (diseño 17, E2). */
  byMonth: boolean
  items: T[]
}

type Groupable = EventFields & Pick<Item, 'position'>

/**
 * Los eventos por días (pantalla 10 y diseño 17, E1–E3): «Sin fecha» arriba y después cada día
 * con algo, con su fecha o, si se repiten, la siguiente vez; lo lejano, por meses. Dentro de un
 * día, primero los de todo el día y luego por hora; a igual hora, el orden de la lista. Con
 * `newestFirst` (el filtro «Pasados»), lo más reciente arriba.
 */
export function groupEvents<T extends Groupable>(
  events: readonly T[],
  now: Date = new Date(),
  { newestFirst = false }: { newestFirst?: boolean } = {},
): EventGroup<T>[] {
  const undated = events.filter((event) => event.dueAt === null)
  const direction = newestFirst ? -1 : 1
  const dated = events
    .flatMap((event) => {
      const at = occurrence(event, now)
      return at ? [{ event, at }] : []
    })
    .sort(
      (a, b) =>
        direction * (startOfDay(a.at).getTime() - startOfDay(b.at).getTime()) ||
        Number(b.event.allDay) - Number(a.event.allDay) ||
        a.at.getTime() - b.at.getTime() ||
        a.event.position - b.event.position,
    )

  const groups: EventGroup<T>[] = []
  if (undated.length > 0) {
    groups.push({
      key: 'none',
      label: 'Sin fecha',
      byMonth: false,
      items: [...undated].sort((a, b) => a.position - b.position),
    })
  }
  for (const { event, at } of dated) {
    const byMonth = groupsByMonth(at, now)
    const key = format(at, byMonth ? 'yyyy-MM' : 'yyyy-MM-dd')
    const last = groups.at(-1)
    if (last?.key === key) last.items.push(event)
    else {
      const label = byMonth ? monthLabel(at, now) : dayLabel(at, now)
      groups.push({ key, label, byMonth, items: [event] })
    }
  }
  return groups
}

/**
 * El día y la hora de un evento en la fila de una lista mixta y en Buscar (diseño 17, E8):
 * «Jue 25 · 11:00», «Hoy · 10:00»; de todo el día, solo el día («Mar 30»); sin fecha, «Sin
 * fecha». Uno que se repite, su siguiente vez.
 */
export function eventWhen(event: EventFields, now: Date = new Date()): string {
  const at = occurrence(event, now)
  if (!at) return 'Sin fecha'
  return event.allDay ? shortDay(at, now) : `${shortDay(at, now)} · ${format(at, 'HH:mm')}`
}

/** La hora de un evento en su fila: «21:00»; de todo el día o sin fecha, nada. */
export function eventTime(event: EventFields): string | null {
  return event.dueAt && !event.allDay ? format(event.dueAt, 'HH:mm') : null
}

/**
 * El día de un evento, corto (diseño 17, E8 y D3): «Hoy», «Mañana», «Jue 25» en el mismo mes,
 * «Lun 6 oct» en otro y «Lun 6 oct 2027» en otro año. Es lo de la fila de una lista mixta y lo de
 * la columna de la hora en un grupo de mes («Sáb» y «15», en dos líneas).
 */
export function shortDay(day: Date, now: Date = new Date()): string {
  const days = differenceInCalendarDays(day, now)
  if (days === 0) return 'Hoy'
  if (days === 1) return 'Mañana'
  const weekday = capitalize(format(day, 'EEE').replace('.', ''))
  const date = isSameMonth(day, now) ? format(day, 'd') : shortDate(day, now)
  return `${weekday} ${date}`
}

/** El día de la ficha: «Jueves 25 sep», «Lunes 4 ene 2027» (diseño 17, F1). */
export function longDay(day: Date, now: Date = new Date()): string {
  return capitalize(format(day, isSameYear(day, now) ? 'EEEE d MMM' : 'EEEE d MMM yyyy'))
}

/**
 * La vez después de la que enseña la ficha, en uno que se repite (diseño 17, F1 y F5):
 * «Siguiente: sábado 25 oct» o, en otro año, «Siguiente: 23 sep de 2027».
 */
export function followingLabel(event: EventFields, now: Date = new Date()): string | null {
  const rule = parseRule(event.recurrence)
  if (!rule || event.dueAt === null) return null
  const current = occurrence(event, now)
  if (!current) return null
  const next = occurrenceFrom(event.dueAt, rule, addDays(startOfDay(current), 1))
  if (!next) return null
  const text = isSameYear(next, now) ? format(next, 'EEEE d MMM') : format(next, "d MMM 'de' yyyy")
  return `Siguiente: ${text}`
}

/** La ficha de uno que ya pasó (diseño 17, F10): «Fue el viernes 12 a las 21:30.». */
export function pastLabel(event: EventFields, now: Date = new Date()): string | null {
  if (event.dueAt === null) return null
  const day = isSameMonth(event.dueAt, now)
    ? format(event.dueAt, 'EEEE d')
    : format(
        event.dueAt,
        isSameYear(event.dueAt, now) ? "EEEE d 'de' MMMM" : "EEEE d 'de' MMMM 'de' yyyy",
      )
  const time = event.allDay ? '' : ` a las ${format(event.dueAt, 'HH:mm')}`
  return `Fue el ${day}${time}.`
}

/**
 * La hora escrita en escritorio (diseño 17, D2): «21», «2130», «21:30», «9.30» o «9h». `null` si
 * no es una hora.
 */
export function parseTime(text: string): { hours: number; minutes: number } | null {
  const clean = text.trim().toLowerCase().replace(/h$/, '')
  const match = /^(\d{1,2})(?:[:.h]?(\d{2}))?$/.exec(clean)
  if (!match) return null
  const hours = Number(match[1])
  const minutes = match[2] ? Number(match[2]) : 0
  if (hours > 23 || minutes > 59) return null
  return { hours, minutes }
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1)
}
