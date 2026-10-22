import { differenceInCalendarDays, format, isSameYear } from 'date-fns'

import { listCounterLabel, waitingCount, type List } from '@/features/lists'
import { formatCaptureAge } from '@/lib/date'

import { isFinalStatus, STATUS_LABELS } from './status'
import type { Item } from './types'

/**
 * Texto del campo de añadir: «¿Qué tienes en mente?» en «En mente» y, en las demás, «Añadir a
 * Ideas…», también vacía (diseño 25, B5).
 */
export function addPlaceholder(list: List): string {
  if (list.kind === 'inbox') return '¿Qué tienes en mente?'
  return `Añadir a ${list.name}…`
}

/** «hoy», «ayer» o «el 14 sep»: un día pasado, para frases como «hecha hoy». */
function dayPhrase(date: Date, now: Date): string {
  const days = differenceInCalendarDays(now, date)
  if (days === 0) return 'hoy'
  if (days === 1) return 'ayer'
  return `el ${format(date, isSameYear(date, now) ? 'd MMM' : 'd MMM yyyy')}`
}

/** La hora de algo de hoy: « · 14:05»; de otro día, nada. */
function todayTime(date: Date, now: Date, joiner: string): string {
  return differenceInCalendarDays(now, date) === 0 ? `${joiner}${format(date, 'H:mm')}` : ''
}

/**
 * Cuándo se terminó, en «Fuera de la cabeza» (Fran, 2026-10-22): «hecha hoy · 14:05», «comprado
 * ayer», «hecha el 14 sep». Sin el verbo, si la fila ya dice cómo terminó: «hoy · 14:05», «14 sep».
 */
export function doneMoment(
  item: Pick<Item, 'status' | 'completedAt'>,
  now: Date,
  { verb = true }: { verb?: boolean } = {},
): string | null {
  if (!isFinalStatus(item.status) || !item.completedAt) return null
  const day = dayPhrase(item.completedAt, now)
  const time = todayTime(item.completedAt, now, ' · ')
  if (!verb) return `${day.replace(/^el /, '')}${time}`
  return `${STATUS_LABELS[item.status].toLowerCase()} ${day}${time}`
}

/** Días que una captura se cuenta como reciente («capturada ayer») y no por su fecha. */
const RECENT_DAYS = 7

/**
 * Cuándo, en el subtítulo del detalle (diseño 06): «hecha hoy a las 14:05» (con la hora desde el
 * 2026-10-22, Fran) o «comprado ayer», «capturada
 * hace 5 min» o «capturada el martes» si es de esta semana, y si no «creada el 14 sep».
 */
export function itemMoment(
  item: Pick<Item, 'status' | 'completedAt' | 'createdAt'>,
  now: Date = new Date(),
): string {
  if (isFinalStatus(item.status) && item.completedAt) {
    const { completedAt } = item
    return `${STATUS_LABELS[item.status].toLowerCase()} ${dayPhrase(completedAt, now)}${todayTime(completedAt, now, ' a las ')}`
  }
  if (differenceInCalendarDays(now, item.createdAt) < RECENT_DAYS) {
    const age = formatCaptureAge(item.createdAt, now)
    const phrase = /^(ahora|hace|ayer)/.test(age) ? age : `el ${age}`
    return `capturada ${phrase}`
  }
  return `creada ${dayPhrase(item.createdAt, now)}`
}

/** Subtítulo de un destino en la hoja: «4 pendientes · 2 notas», «Sin ordenar · 5 cosas» (5.5). */
export function destinationSummary(list: List): string {
  if (list.kind === 'inbox') {
    const count = waitingCount(list)
    return `Sin ordenar · ${count} ${count === 1 ? 'cosa' : 'cosas'}`
  }
  return listCounterLabel(list)
}
