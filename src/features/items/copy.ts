import { differenceInCalendarDays, format, isSameYear } from 'date-fns'

import { counterLabel, KIND_TEMPLATES, type List, type ListKind } from '@/features/lists'
import { formatCaptureAge } from '@/lib/date'

import { moveLossLabel, type MoveLoss } from './move'
import { isFinalStatus, STATUS_LABELS } from './status'
import type { Item } from './types'

/** Cómo se llama lo primero que se añade, para el texto del vacío («Escribe la primera tarea…»). */
const FIRST_ITEM: Record<Exclude<ListKind, 'inbox'>, { noun: string; placeholder: string }> = {
  tasks: { noun: 'la primera tarea', placeholder: 'Primera tarea…' },
  shopping: { noun: 'el primer producto', placeholder: 'Primer producto…' },
  events: { noun: 'el primer evento', placeholder: 'Primer evento…' },
  custom: { noun: 'lo primero', placeholder: 'Primer elemento…' },
}

export function firstItemNoun(kind: ListKind): string {
  return FIRST_ITEM[kind === 'inbox' ? 'tasks' : kind].noun
}

/** Texto del campo de añadir: «¿Qué tienes en mente?», «Primera tarea…» o «Añadir a Casa…». */
export function addPlaceholder(list: List, empty: boolean): string {
  if (list.kind === 'inbox') return '¿Qué tienes en mente?'
  return empty ? FIRST_ITEM[list.kind].placeholder : `Añadir a ${list.name}…`
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

/** Cómo se llama un ítem del tipo en la línea de aviso de mover («Se guarda como evento…»). */
const ITEM_NOUN: Record<ListKind, string> = {
  inbox: 'captura',
  tasks: 'tarea',
  shopping: 'producto',
  events: 'evento',
  custom: 'elemento',
}

/**
 * Línea de aviso de «Mover a…»: lo que se pierde si se pierde algo (diseño 06) y, al ordenar
 * desde «En mente», cómo se guardará (diseño 05: «Se guarda como evento en Agenda. Podrás
 * ponerle fecha después.»).
 */
export function moveHint(from: ListKind, to: List, loss: MoveLoss): string | null {
  const lost = moveLossLabel(loss)
  if (lost) return lost
  if (from !== 'inbox') return null
  const saved = `Se guarda como ${ITEM_NOUN[to.kind]} en ${to.name}.`
  if (to.kind === 'events') return `${saved} Podrás ponerle fecha después.`
  return saved
}

/** Subtítulo de un destino en la hoja: «Tareas · 4 pendientes», «Sin ordenar · 5 cosas». */
export function destinationSummary(list: List): string {
  if (list.kind === 'inbox') {
    const count = list.counters.pending
    return `Sin ordenar · ${count} ${count === 1 ? 'cosa' : 'cosas'}`
  }
  return `${KIND_TEMPLATES[list.kind].label} · ${counterLabel(list.kind, list.counters.pending)}`
}

/** Línea del detalle básico que anticipa la ficha completa (diseño 06, T10 y T11). */
export function upcomingFieldsNote(kind: ListKind): string | null {
  if (kind === 'shopping')
    return 'Imagen, precio y tienda llegarán con la ficha completa de Compras.'
  if (kind === 'events') {
    return 'Fecha, hora y recordatorio llegarán con la ficha completa de Eventos.'
  }
  return null
}
