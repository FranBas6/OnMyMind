import {
  addDays,
  addYears,
  differenceInCalendarDays,
  format,
  isSameDay,
  isSameYear,
} from 'date-fns'

import { occurrence, occurrencesBetween } from '@/features/items/events'
import { parseRule, repeats, ruleSentence } from '@/features/items/recurrence'
import { isFinalStatus } from '@/features/items/status'
import type { Item } from '@/features/items/types'

/**
 * Lo puro de los recordatorios (sesión 2.6, 02 §Configurar recordatorio, decisiones de Fran del
 * 2026-10-05). Un aviso por ítem, solo en tareas y eventos. Uno relativo es un desfase en minutos
 * antes del momento del ítem (`offset_minutes`); la base calcula su hora (`reminder_time`,
 * migración `reminders_and_push`) y esto calcula lo mismo para enseñarlo al instante y para saber
 * qué opciones ya no tienen sentido.
 */

export interface Reminder {
  id: string
  itemId: string
  /** Cuándo avisa (la siguiente vez, si el ítem se repite). */
  remindAt: Date
  /** Minutos antes del momento del ítem; `null` en uno personalizado (día y hora a mano). */
  offsetMinutes: number | null
  /** Cuándo se envió; vuelve a `null` si la hora del aviso cambia. */
  sentAt: Date | null
}

type ReminderItem = Pick<Item, 'kind' | 'dueAt' | 'allDay' | 'recurrence'>

/** Si un ítem puede llevar aviso: tareas y eventos (no compras ni «En mente»). */
export function canHaveReminder(item: Pick<Item, 'kind'>): boolean {
  return item.kind === 'task' || item.kind === 'event'
}

/**
 * Qué avisos admite: con hora (un evento con hora), con día pero sin hora (una tarea con fecha o
 * un evento de todo el día, guardados a las 00:00) o sin fecha (solo «Personalizado…»).
 */
export type ReminderShape = 'timed' | 'dated' | 'undated'

export function reminderShape(item: ReminderItem): ReminderShape {
  if (item.dueAt === null) return 'undated'
  return item.kind === 'event' && !item.allDay ? 'timed' : 'dated'
}

export interface ReminderOption {
  label: string
  offsetMinutes: number
}

/** La hora de los avisos de un día sin hora: las 9:00 (decisión de Fran, 2026-10-05). */
export const DATED_HOUR = 9

/** Las de la pantalla 12 del concepto, para lo que tiene hora. */
const TIMED_OPTIONS: readonly ReminderOption[] = [
  { label: 'A la hora', offsetMinutes: 0 },
  { label: '10 minutos antes', offsetMinutes: 10 },
  { label: '30 minutos antes', offsetMinutes: 30 },
  { label: '1 hora antes', offsetMinutes: 60 },
  { label: '1 día antes', offsetMinutes: 24 * 60 },
]

/** Lo de un día sin hora está a las 00:00: «ese día a las 9:00» es 9 h después. */
const DATED_OPTIONS: readonly ReminderOption[] = [
  { label: `Ese día a las ${DATED_HOUR}:00`, offsetMinutes: -DATED_HOUR * 60 },
  { label: `El día antes a las ${DATED_HOUR}:00`, offsetMinutes: (24 - DATED_HOUR) * 60 },
]

/** Las opciones relativas de un ítem (sin «Sin aviso» ni «Personalizado…», que van siempre). */
export function reminderOptions(item: ReminderItem): readonly ReminderOption[] {
  const shape = reminderShape(item)
  return shape === 'timed' ? TIMED_OPTIONS : shape === 'dated' ? DATED_OPTIONS : []
}

/** Restar minutos en la hora del reloj: «el día antes a las 9:00» no se mueve con el cambio de hora. */
function wallClockMinus(at: Date, minutes: number): Date {
  return new Date(
    at.getFullYear(),
    at.getMonth(),
    at.getDate(),
    at.getHours(),
    at.getMinutes() - minutes,
    at.getSeconds(),
  )
}

/**
 * Cuándo avisaría un aviso relativo, como `reminder_time` en la base: `offsetMinutes` antes del
 * momento del ítem y, si se repite, en la primera vez cuyo aviso aún no ha pasado. `null` sin
 * fecha. Uno que no se repite puede quedar en el pasado (ver `isOptionAvailable`).
 */
export function reminderAt(
  item: ReminderItem,
  offsetMinutes: number,
  now: Date = new Date(),
): Date | null {
  if (item.dueAt === null) return null
  if (item.recurrence === null) return wallClockMinus(item.dueAt, offsetMinutes)
  // El aviso va como mucho un día antes o nueve horas después: basta con mirar desde ayer.
  const times = occurrencesBetween(item, addDays(now, -1), addYears(now, 1))
  for (const at of times) {
    const remind = wallClockMinus(at, offsetMinutes)
    if (remind >= now) return remind
  }
  return null
}

/** Si una opción aún tiene sentido: su aviso no ha pasado («1 día antes» de algo de mañana a las 9). */
export function isOptionAvailable(
  item: ReminderItem,
  offsetMinutes: number,
  now: Date = new Date(),
): boolean {
  const at = reminderAt(item, offsetMinutes, now)
  return at !== null && at > now
}

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1)

/**
 * El nombre del aviso en la fila de la ficha: el de su opción («1 hora antes»), o, si es
 * personalizado o ya no está entre las opciones (cambió el tipo de fecha), su día y su hora
 * («Lun 13 oct · 17:00»). Los textos finales llegan con el diseño 18.
 */
export function reminderLabel(
  reminder: Pick<Reminder, 'offsetMinutes' | 'remindAt'>,
  item: ReminderItem,
  now: Date = new Date(),
): string {
  const option = reminderOptions(item).find(
    (candidate) => candidate.offsetMinutes === reminder.offsetMinutes,
  )
  if (option) return option.label
  const day = format(
    reminder.remindAt,
    isSameYear(reminder.remindAt, now) ? 'EEE d MMM' : 'EEE d MMM yyyy',
  )
  return `${capitalize(day)} · ${format(reminder.remindAt, 'HH:mm')}`
}

/** Lo corto de cada desfase, para la fila de la ficha (diseño 18, R2–R4). */
const SHORT_LABELS: Record<number, string> = {
  0: 'A la hora',
  10: '10 min antes',
  30: '30 min antes',
  60: '1 h antes',
  [24 * 60]: '1 día antes',
  [-DATED_HOUR * 60]: 'Ese día',
  [(24 - DATED_HOUR) * 60]: 'El día antes',
}

const time = (at: Date) => format(at, 'HH:mm')
/** «9:00» sin el cero delante, como dibuja el diseño para lo de un día sin hora. */
const datedTime = () => `${DATED_HOUR}:00`

/**
 * Lo que dice la fila «Aviso» de la ficha (diseño 18, R2–R5): «1 h antes · 09:00», «Ese día ·
 * 9:00», «El día antes · 9:00» o, uno personalizado, «Lun 13 oct · 17:00». Si se repite, la hora
 * es la de la siguiente vez.
 */
export function reminderRowLabel(
  reminder: Pick<Reminder, 'offsetMinutes' | 'remindAt'>,
  item: ReminderItem,
  now: Date = new Date(),
): string {
  const offset = reminder.offsetMinutes
  const short = offset === null ? undefined : SHORT_LABELS[offset]
  const fits = reminderOptions(item).some((option) => option.offsetMinutes === offset)
  if (!short || !fits) return reminderLabel(reminder, item, now)
  return `${short} · ${reminderShape(item) === 'dated' ? datedTime() : time(reminder.remindAt)}`
}

/**
 * Cuándo sonaría una opción, a su derecha (diseño 18, R6, R7 y R11): la hora si es el mismo día
 * que el ítem («09:50»), con el día si no («Mié 24 · 10:00»), y solo el día en lo de un día sin
 * hora («Mié 1 oct»). `null` si ya pasó («Ya pasó» lo pone la hoja).
 */
export function optionWhen(
  item: ReminderItem,
  offsetMinutes: number,
  now: Date = new Date(),
): string | null {
  const at = reminderAt(item, offsetMinutes, now)
  if (!at || at <= now) return null
  if (reminderShape(item) === 'dated') return capitalize(format(at, 'EEE d MMM'))
  const moment = occurrence(item, now)
  return moment && isSameDay(at, moment)
    ? time(at)
    : `${capitalize(format(at, 'EEE d'))} · ${time(at)}`
}

/** El día de un ítem en la hoja: «hoy», «mañana» o «jueves 25 sep». */
function dayName(day: Date, now: Date): string {
  const days = differenceInCalendarDays(day, now)
  if (days === 0) return 'hoy'
  if (days === 1) return 'mañana'
  return format(day, isSameYear(day, now) ? 'EEEE d MMM' : 'EEEE d MMM yyyy')
}

/**
 * La línea bajo «Aviso» en la hoja (diseño 18, R6–R8): «Dentista · jueves 25 sep a las 10:00»,
 * «Pagar el alquiler · vence el miércoles 1 oct», «Cumpleaños de Ana · lunes 3 nov» o «Llamar
 * al seguro · sin fecha». Lo que se repite, con su siguiente vez.
 */
export function reminderSheetSubtitle(
  item: ReminderItem & Pick<Item, 'title'>,
  now: Date = new Date(),
): string {
  const at = occurrence(item, now)
  if (!at) return `${item.title} · sin fecha`
  const shape = reminderShape(item)
  if (shape === 'timed') return `${item.title} · ${dayName(at, now)} a las ${time(at)}`
  const day = dayName(at, now)
  return item.kind === 'task'
    ? `${item.title} · vence ${day === 'hoy' || day === 'mañana' ? day : `el ${day}`}`
    : `${item.title} · ${day}`
}

/**
 * Bajo la caja, en lo que se repite con aviso (diseño 18, R4): «Avisa cada año. El próximo, el
 * domingo 2 nov a las 9:00.». `null` si no se repite o no tiene aviso relativo.
 */
export function repeatingReminderNote(
  reminder: Pick<Reminder, 'offsetMinutes' | 'remindAt'>,
  item: ReminderItem,
  now: Date = new Date(),
): string | null {
  const rule = parseRule(item.recurrence)
  if (!rule || reminder.offsetMinutes === null) return null
  const at = reminder.remindAt
  const hour = reminderShape(item) === 'dated' ? datedTime() : time(at)
  const day = format(at, isSameYear(at, now) ? 'EEEE d MMM' : 'EEEE d MMM yyyy')
  return `Avisa ${ruleSentence(rule)}. El próximo, el ${day} a las ${hour}.`
}

/** Cómo se llama este dispositivo en los textos: «este iPhone», «este iPad», «este móvil» o «este navegador». */
export function deviceName(userAgent: string, maxTouchPoints: number): string {
  if (/iPhone|iPod/.test(userAgent)) return 'este iPhone'
  if (userAgent.includes('iPad') || (userAgent.includes('Macintosh') && maxTouchPoints > 1)) {
    return 'este iPad'
  }
  // Android (diseño 23, A1): «Avisos en este móvil».
  if (userAgent.includes('Android')) return 'este móvil'
  return 'este navegador'
}

/**
 * El aviso dicho en una frase, para «Para que «Dentista» te avise 1 h antes…» (diseño 18, A1):
 * «1 h antes», «a la hora», «ese día a las 9:00» o «el lunes 13 oct a las 17:00».
 */
export function reminderPhrase(
  reminder: Pick<Reminder, 'offsetMinutes' | 'remindAt'>,
  item: ReminderItem,
): string {
  const offset = reminder.offsetMinutes
  const short = offset === null ? undefined : SHORT_LABELS[offset]
  const fits = reminderOptions(item).some((option) => option.offsetMinutes === offset)
  if (short && fits) {
    const lower = short.charAt(0).toLowerCase() + short.slice(1)
    return reminderShape(item) === 'dated' ? `${lower} a las ${datedTime()}` : lower
  }
  return `el ${format(reminder.remindAt, 'EEEE d MMM')} a las ${time(reminder.remindAt)}`
}

/**
 * Si la fila de un ítem lleva la campana (diseño 18, R13): tiene aviso y aún va a sonar. Lo
 * avisado (salvo lo que se repite, que pasa a la siguiente vez), lo hecho y lo cancelado, no.
 */
export function showsBell(
  reminder: Pick<Reminder, 'sentAt'> | undefined,
  item: Pick<Item, 'status' | 'recurrence'>,
): reminder is Pick<Reminder, 'sentAt'> {
  if (!reminder || isFinalStatus(item.status)) return false
  return reminder.sentAt === null || repeats(item.recurrence)
}
