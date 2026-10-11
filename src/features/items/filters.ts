import { subDays } from 'date-fns'

import {
  counterLabel,
  doneLabel,
  STYLE_TEMPLATES,
  type ListKind,
  type ListStyle,
} from '@/features/lists'
import type { InboxSort } from '@/features/profile/schemas'

import { isEarlierToday, isPastEvent } from './events'
import { isOutOfMind } from './status'
import { countItems, openSublistsLabel } from './sublists'
import type { Item } from './types'

/** Filtro por estado de las listas normales: todo, lo pendiente o lo que ya está fuera. */
export type StatusFilter = 'all' | 'open' | 'closed'
/** Filtro de «En mente», por antigüedad (diseño 05): lo que pesa es lo que lleva tiempo ahí. */
export type AgeFilter = 'all' | 'week' | 'older'
/**
 * Orden de «En mente» (diseño 14, E2): por fecha de captura o «A mi manera» (a mano, por
 * `position`). Se recuerda en la cuenta (`settings.inbox_sort`).
 */
export type SortOrder = InboxSort

export interface FilterOption<T extends string> {
  value: T
  label: string
}

const OPEN_CLOSED_LABELS: Record<ListStyle, [open: string, closed: string]> = {
  inbox: ['Pendientes', 'Hechas'],
  list: ['Pendientes', 'Hechas'],
  agenda: ['Próximos', 'Pasados'],
}

/** «Todas / Pendientes / Hechas», con las etiquetas de la lista (02 §Estados; 5.3, comunes). */
export function statusFilterOptions(style: ListStyle): FilterOption<StatusFilter>[] {
  const [open, closed] = OPEN_CLOSED_LABELS[style]
  return [
    { value: 'all', label: 'Todas' },
    { value: 'open', label: open },
    { value: 'closed', label: closed },
  ]
}

export const AGE_FILTER_OPTIONS: readonly FilterOption<AgeFilter>[] = [
  { value: 'all', label: 'Todas' },
  { value: 'week', label: 'Esta semana' },
  { value: 'older', label: 'Antiguas' },
]

/** Las opciones del menú de ordenar (E2) y el texto corto del botón en escritorio (D7). */
export const SORT_OPTIONS: readonly { value: SortOrder; label: string; short: string }[] = [
  { value: 'newest', label: 'Más reciente primero', short: 'Más reciente' },
  { value: 'oldest', label: 'Más antigua primero', short: 'Más antigua' },
  { value: 'manual', label: 'A mi manera', short: 'A mi manera' },
]

/** Días que una captura cuenta como «de esta semana» (los siete últimos, no la semana natural). */
const RECENT_DAYS = 7

/** Si una captura es de los siete últimos días. */
export function isRecent(item: Item, now: Date = new Date()): boolean {
  return item.createdAt >= subDays(now, RECENT_DAYS)
}

export function matchesAge(item: Item, filter: AgeFilter, now: Date = new Date()): boolean {
  if (filter === 'all') return true
  return filter === 'week' ? isRecent(item, now) : !isRecent(item, now)
}

export interface SplitItems {
  /** Lo que sigue en la cabeza, en el orden de la lista. */
  active: Item[]
  /** «Fuera de la cabeza»: lo terminado, lo último primero. */
  outOfMind: Item[]
}

interface SplitOptions {
  now?: Date
  /**
   * Ítems recién terminados que se quedan un momento en su sitio para que se vea el check antes
   * de que bajen a «Fuera de la cabeza» (06 §Interacción: 400 ms).
   */
  lingering?: ReadonlySet<string>
  /** Solo en «En mente», que se ordena por fecha de captura o a mano. */
  sort?: SortOrder
}

/** El orden de una lista: `position` y, a igualdad, lo más antiguo antes. */
export const byPosition = (a: Item, b: Item) =>
  a.position - b.position || a.createdAt.getTime() - b.createdAt.getTime()
const byCreated = (order: Exclude<SortOrder, 'manual'>) => (a: Item, b: Item) =>
  order === 'newest'
    ? b.createdAt.getTime() - a.createdAt.getTime()
    : a.createdAt.getTime() - b.createdAt.getTime()
/** Lo último que salió de la cabeza, primero. Un evento pasado no tiene `completedAt`: su fecha. */
const outOfMindAt = (item: Item) => (item.completedAt ?? item.dueAt ?? item.createdAt).getTime()

/**
 * Separa los ítems de una lista en lo pendiente y «Fuera de la cabeza». Las listas normales van
 * por `position`; «En mente», por la fecha de captura (la más reciente arriba, como su tarjeta) o,
 * con «A mi manera», también por `position`.
 */
export function splitItems(items: readonly Item[], kind: ListKind, options: SplitOptions = {}) {
  const { now = new Date(), lingering, sort = 'newest' } = options
  const active: Item[] = []
  const outOfMind: Item[] = []
  for (const item of items) {
    if (isOutOfMind(item, now) && !lingering?.has(item.id)) outOfMind.push(item)
    else active.push(item)
  }
  active.sort(kind === 'inbox' && sort !== 'manual' ? byCreated(sort) : byPosition)
  outOfMind.sort((a, b) => outOfMindAt(b) - outOfMindAt(a))
  return { active, outOfMind } satisfies SplitItems
}

/**
 * Subtítulo del detalle: «4 pendientes · 2 hechas» y, si la lista no tiene nada, «Lista · recién
 * creada» (diseño 05). La inbox usa su contador («5 cosas sin ordenar»), que cuenta también las
 * notas: `pending` ya las lleva (`waitingCount`).
 */
export function detailSummary(style: ListStyle, pending: number, done: number): string {
  if (style === 'inbox') return counterLabel('inbox', pending)
  if (pending === 0 && done === 0) return `${STYLE_TEMPLATES[style].label} · recién creada`
  return `${counterLabel(style, pending)} · ${doneLabel(style, done)}`
}

/**
 * Subtítulo de una lista con sus ítems ya cargados. Cuenta como la vista `list_counters`
 * (`countItems`): lo de dentro de las sublistas activas suma y la sublista en sí no. Con sublistas
 * abiertas, en vez de lo hecho dice cuántas hay: «9 pendientes · 3 sublistas» (diseño 12, S1). En
 * «En mente», las notas también están sin ordenar (5.3).
 */
export function listSummary(style: ListStyle, items: readonly Item[]): string {
  const { pending, done, notes } = countItems(items)
  if (style === 'inbox') return detailSummary(style, pending + notes, done)
  if (items.length === 0) return detailSummary(style, pending, done)
  const sublists = openSublistsLabel(items)
  if (sublists) return `${counterLabel(style, pending)} · ${sublists}`
  return `${counterLabel(style, pending)} · ${doneLabel(style, done)}`
}

/**
 * Filtro de una lista de eventos (diseño 17, E1–E5): todo, lo que viene, lo que ya pasó (también lo
 * de hoy cuya hora ya pasó) y lo cancelado.
 */
export type EventFilter = 'all' | 'upcoming' | 'past' | 'cancelled'

export const EVENT_FILTER_OPTIONS: readonly FilterOption<EventFilter>[] = [
  { value: 'all', label: 'Todos' },
  { value: 'upcoming', label: 'Próximos' },
  { value: 'past', label: 'Pasados' },
  { value: 'cancelled', label: 'Cancelados' },
]

/** Un evento que ya pasó, o de hoy cuya hora ya pasó: lo del filtro «Pasados» (E3). */
function isGone(item: Item, now: Date): boolean {
  return item.status !== 'cancelled' && (isPastEvent(item, now) || isEarlierToday(item, now))
}

/**
 * Los eventos de cada filtro (E1–E5). «Próximos» es lo que tiene día y aún no ha llegado; lo sin
 * fecha solo sale en «Todos», arriba.
 */
export function filterEvents(
  items: readonly Item[],
  filter: Exclude<EventFilter, 'all'>,
  now: Date = new Date(),
): Item[] {
  const events = items.filter((item) => item.kind === 'event')
  switch (filter) {
    case 'upcoming':
      return events.filter(
        (item) => item.status !== 'cancelled' && item.dueAt !== null && !isGone(item, now),
      )
    case 'past':
      return events.filter((item) => isGone(item, now))
    case 'cancelled':
      return events.filter((item) => item.status === 'cancelled')
  }
}

/**
 * Cabecera de una lista de eventos (E1): «4 próximos · 1 pasado». Lo sin fecha y lo cancelado no
 * cuentan; sin nada, «Nada todavía» (E6).
 */
export function eventsSummary(items: readonly Item[], now: Date = new Date()): string {
  if (items.length === 0) return 'Nada todavía'
  const upcoming = filterEvents(items, 'upcoming', now).length
  const past = items.filter(
    (item) => item.kind === 'event' && item.status !== 'cancelled' && isPastEvent(item, now),
  ).length
  return `${counterLabel('agenda', upcoming)} · ${doneLabel('agenda', past)}`
}
