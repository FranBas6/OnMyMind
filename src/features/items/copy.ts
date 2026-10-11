import { differenceInCalendarDays, format, isSameYear } from 'date-fns'

import { counterLabel, listStyle, STYLE_TEMPLATES, waitingCount, type List } from '@/features/lists'
import { formatCaptureAge } from '@/lib/date'

import { isFinalStatus, STATUS_LABELS } from './status'
import type { Item, ItemKind } from './types'

/**
 * Cómo se llama lo primero que se añade, por el tipo que propone la lista (`proposedKind`), para el
 * texto del vacío («Escribe la primera tarea…»).
 */
const FIRST_ITEM: Record<ItemKind, { noun: string; placeholder: string }> = {
  note: { noun: 'la primera nota', placeholder: 'Primera nota…' },
  task: { noun: 'la primera tarea', placeholder: 'Primera tarea…' },
  shopping: { noun: 'el primer producto', placeholder: 'Primer producto…' },
  event: { noun: 'el primer evento', placeholder: 'Primer evento…' },
  sublist: { noun: 'lo primero', placeholder: 'Primer elemento…' },
}

export function firstItemNoun(kind: ItemKind): string {
  return FIRST_ITEM[kind].noun
}

/**
 * Texto del campo de añadir: «¿Qué tienes en mente?», «Primera tarea…» (con el tipo que propone la
 * lista) o «Añadir a Casa…».
 */
export function addPlaceholder(list: List, empty: boolean, proposed: ItemKind): string {
  if (list.kind === 'inbox') return '¿Qué tienes en mente?'
  return empty ? FIRST_ITEM[proposed].placeholder : `Añadir a ${list.name}…`
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
