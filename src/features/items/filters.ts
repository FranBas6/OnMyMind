import { subDays } from 'date-fns'

import { counterLabel, doneLabel, KIND_TEMPLATES, type ListKind } from '@/features/lists'

import { isOutOfMind } from './status'
import type { Item } from './types'

/** Filtro por estado de las listas normales: todo, lo pendiente o lo que ya está fuera. */
export type StatusFilter = 'all' | 'open' | 'closed'
/** Filtro de «En mente», por antigüedad (diseño 05): lo que pesa es lo que lleva tiempo ahí. */
export type AgeFilter = 'all' | 'week' | 'older'
/** Orden de «En mente» en escritorio: «Ordenar: más reciente» alterna con «más antigua». */
export type SortOrder = 'newest' | 'oldest'

export interface FilterOption<T extends string> {
  value: T
  label: string
}

const OPEN_CLOSED_LABELS: Record<ListKind, [open: string, closed: string]> = {
  inbox: ['Pendientes', 'Hechas'],
  tasks: ['Pendientes', 'Hechas'],
  shopping: ['Pendientes', 'Compradas'],
  events: ['Próximos', 'Pasados'],
  custom: ['Pendientes', 'Hechas'],
}

/** «Todas / Pendientes / Hechas», con las etiquetas del tipo (02 §Estados). */
export function statusFilterOptions(kind: ListKind): FilterOption<StatusFilter>[] {
  const [open, closed] = OPEN_CLOSED_LABELS[kind]
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

export const SORT_LABELS: Record<SortOrder, string> = {
  newest: 'más reciente',
  oldest: 'más antigua',
}

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
  /** Solo en «En mente», que se ordena por fecha de captura. */
  sort?: SortOrder
}

const byPosition = (a: Item, b: Item) =>
  a.position - b.position || a.createdAt.getTime() - b.createdAt.getTime()
const byCreated = (order: SortOrder) => (a: Item, b: Item) =>
  order === 'newest'
    ? b.createdAt.getTime() - a.createdAt.getTime()
    : a.createdAt.getTime() - b.createdAt.getTime()
/** Lo último que salió de la cabeza, primero. Un evento pasado no tiene `completedAt`: su fecha. */
const outOfMindAt = (item: Item) => (item.completedAt ?? item.dueAt ?? item.createdAt).getTime()

/**
 * Separa los ítems de una lista en lo pendiente y «Fuera de la cabeza». Las listas normales van
 * por `position`; «En mente», por la fecha de captura (la más reciente arriba, como su tarjeta).
 */
export function splitItems(items: readonly Item[], kind: ListKind, options: SplitOptions = {}) {
  const { now = new Date(), lingering, sort = 'newest' } = options
  const active: Item[] = []
  const outOfMind: Item[] = []
  for (const item of items) {
    if (isOutOfMind(item, now) && !lingering?.has(item.id)) outOfMind.push(item)
    else active.push(item)
  }
  active.sort(kind === 'inbox' ? byCreated(sort) : byPosition)
  outOfMind.sort((a, b) => outOfMindAt(b) - outOfMindAt(a))
  return { active, outOfMind } satisfies SplitItems
}

/**
 * Subtítulo del detalle: «4 pendientes · 2 hechas» y, si la lista no tiene nada, «Tareas · recién
 * creada» (diseño 05). La inbox usa su contador («5 cosas sin ordenar»).
 */
export function detailSummary(kind: ListKind, pending: number, done: number): string {
  if (kind === 'inbox') return counterLabel('inbox', pending)
  if (pending === 0 && done === 0) return `${KIND_TEMPLATES[kind].label} · recién creada`
  return `${counterLabel(kind, pending)} · ${doneLabel(kind, done)}`
}
