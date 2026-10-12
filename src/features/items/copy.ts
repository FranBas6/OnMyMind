import { differenceInCalendarDays, format, isSameYear } from 'date-fns'

import { counterLabel, listStyle, STYLE_TEMPLATES, waitingCount, type List } from '@/features/lists'
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

/** Días que una captura se cuenta como reciente («capturada ayer») y no por su fecha. */
const RECENT_DAYS = 7

/**
 * Cuándo, en el subtítulo del detalle (diseño 06): «hecha hoy» (o «comprado ayer»), «capturada
 * hace 5 min» o «capturada el martes» si es de esta semana, y si no «creada el 14 sep».
 */
export function itemMoment(
  item: Pick<Item, 'status' | 'completedAt' | 'createdAt'>,
  now: Date = new Date(),
): string {
  if (isFinalStatus(item.status) && item.completedAt) {
    return `${STATUS_LABELS[item.status].toLowerCase()} ${dayPhrase(item.completedAt, now)}`
  }
  if (differenceInCalendarDays(now, item.createdAt) < RECENT_DAYS) {
    const age = formatCaptureAge(item.createdAt, now)
    const phrase = /^(ahora|hace|ayer)/.test(age) ? age : `el ${age}`
    return `capturada ${phrase}`
  }
  return `creada ${dayPhrase(item.createdAt, now)}`
}

/** Subtítulo de un destino en la hoja: «Lista · 4 pendientes», «Sin ordenar · 5 cosas». */
export function destinationSummary(list: List): string {
  if (list.kind === 'inbox') {
    const count = waitingCount(list)
    return `Sin ordenar · ${count} ${count === 1 ? 'cosa' : 'cosas'}`
  }
  const style = listStyle(list)
  return `${STYLE_TEMPLATES[style].label} · ${counterLabel(style, list.counters.pending)}`
}
