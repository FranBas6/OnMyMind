import { format } from 'date-fns'

import { formatCents } from '@/lib/money'

import type { List, ListStyle } from './types'

interface Plural {
  one: string
  other: string
}

interface StyleTemplate {
  /** Cómo se llama en la interfaz: «En mente», «Lista» o «Agenda». */
  label: string
  /** Qué cuenta la lista cuando ya no queda nada pendiente («31 hechas»). */
  doneCounter: Plural
  /** Qué cuenta el contador de pendientes (02 §Inicio, diseño pantalla 2). */
  counter: Plural
}

/**
 * Los textos de cada lista (5.3, ADR-012). Las listas ya no tienen tipo: lo que cambia los textos
 * es si es «En mente», una lista o una agenda (su vista). Los estados de cada tipo de ítem viven
 * en `features/items/status.ts`.
 */
export const STYLE_TEMPLATES: Record<ListStyle, StyleTemplate> = {
  inbox: {
    label: 'En mente',
    doneCounter: { one: 'hecha', other: 'hechas' },
    counter: { one: 'cosa sin ordenar', other: 'cosas sin ordenar' },
  },
  list: {
    label: 'Lista',
    doneCounter: { one: 'hecha', other: 'hechas' },
    counter: { one: 'pendiente', other: 'pendientes' },
  },
  agenda: {
    label: 'Agenda',
    doneCounter: { one: 'pasado', other: 'pasados' },
    counter: { one: 'próximo', other: 'próximos' },
  },
}

/** Si una lista es «En mente», una lista o una agenda. */
export function listStyle(list: Pick<List, 'kind' | 'view'>): ListStyle {
  return list.kind === 'inbox' ? 'inbox' : list.view
}

/** «4 pendientes», «1 próximo», «3 cosas sin ordenar»; la inbox vacía, «Nada sin ordenar» (05). */
export function counterLabel(style: ListStyle, count: number): string {
  if (style === 'inbox' && count === 0) return 'Nada sin ordenar'
  const { counter } = STYLE_TEMPLATES[style]
  return `${count} ${count === 1 ? counter.one : counter.other}`
}

/** Lo que ya está fuera de la cabeza: «2 hechas», «1 pasado». */
export function doneLabel(style: ListStyle, count: number): string {
  const { doneCounter } = STYLE_TEMPLATES[style]
  return `${count} ${count === 1 ? doneCounter.one : doneCounter.other}`
}

/**
 * Lo que tiene sin ordenar «En mente»: lo pendiente y las notas, que no son algo por hacer pero
 * siguen ahí (5.3). En las demás listas, lo pendiente.
 */
export function waitingCount(list: Pick<List, 'kind' | 'counters'>): number {
  return list.kind === 'inbox' ? list.counters.pending + list.counters.notes : list.counters.pending
}

/**
 * Total pendiente de una lista («627 €»), o `null` si no hay importe. Cuenta las compras de
 * cualquier lista, no solo las de Compras (plan 02-fase-2, decisión 6), y solo en euros.
 */
export function pendingTotal(list: List): string | null {
  if (list.counters.pendingPriceCents <= 0) return null
  return formatCents(list.counters.pendingPriceCents)
}

/** Total de ítems de la lista (pendientes, notas y fuera de la cabeza). */
export function itemCount(list: List): number {
  return list.counters.pending + list.counters.notes + list.counters.done
}

/** «12 ítems», «1 ítem». */
export function itemsLabel(count: number): string {
  return `${count} ${count === 1 ? 'ítem' : 'ítems'}`
}

/** «3 notas», «1 nota». */
export function notesLabel(count: number): string {
  return `${count} ${count === 1 ? 'nota' : 'notas'}`
}

/** Lo que dice una lista sin nada (diseño 25, B5). */
export const NEW_LIST_LABEL = 'Lista recién creada'

/** Lo que se cuenta de una lista: lo pendiente, las notas y lo que ya está fuera de la cabeza. */
export interface Tally {
  pending: number
  notes: number
  done: number
}

interface TallyOptions {
  /** Lo hecho también cuando hay algo pendiente o alguna nota (la cabecera de la lista). */
  withDone?: boolean
  /** Lo que se dice sin nada; por defecto, «Lista recién creada». */
  empty?: string
}

/**
 * Los contadores comunes de una lista (5.5, diseño 25, B9, B10 y D6): «4 pendientes · 3 notas»,
 * «6 notas», «3 próximos · 1 nota» en una agenda y, si no queda nada más, «2 hechas». Lo que está a
 * cero no se dice. En «En mente», «5 cosas sin ordenar», que cuenta también las notas.
 */
export function tallyLabel(
  style: ListStyle,
  tally: Tally,
  { withDone = false, empty = NEW_LIST_LABEL }: TallyOptions = {},
): string {
  if (style === 'inbox') return counterLabel('inbox', tally.pending + tally.notes)
  const parts: string[] = []
  if (tally.pending > 0) parts.push(counterLabel(style, tally.pending))
  if (tally.notes > 0) parts.push(notesLabel(tally.notes))
  if (tally.done > 0 && (withDone || parts.length === 0)) parts.push(doneLabel(style, tally.done))
  return parts.length > 0 ? parts.join(' · ') : empty
}

/** El contador de una lista con lo que dice la vista `list_counters`: tarjetas, Buscar, «Mover a…». */
export function listCounterLabel(list: List, options?: TallyOptions): string {
  return tallyLabel(listStyle(list), list.counters, options)
}

/** Cabecera del menú ···: «6 pendientes · 2 notas · 12 ítems» (diseño 04 Listas, L3; 5.5). */
export function menuSummary(list: List): string {
  const count = itemCount(list)
  const counter = listCounterLabel(list)
  return count === 0 ? counter : `${counter} · ${itemsLabel(count)}`
}

/** Lo que dice una archivada sin nada dentro. */
const EMPTY_ARCHIVED = 'Vacía'

/** Fila de una archivada: «2 pendientes · 1 nota · archivada el 12 sep» (L12; 5.5, sin el tipo). */
export function archivedSummary(list: List): string {
  const parts = [listCounterLabel(list, { empty: EMPTY_ARCHIVED })]
  if (list.archivedAt) parts.push(`archivada el ${format(list.archivedAt, 'd MMM')}`)
  return parts.join(' · ')
}

/** «2 listas archivadas», «1 lista archivada». */
export function archivedCountLabel(count: number): string {
  return count === 1 ? '1 lista archivada' : `${count} listas archivadas`
}

/** Texto de la confirmación de borrado (L10), con sus singulares. */
export function deleteMessage(list: List): string {
  const count = itemCount(list)
  if (count === 0) return `Se borrará «${list.name}». No hay vuelta atrás.`
  if (count === 1) return `Se borrará «${list.name}» y su ítem. No hay vuelta atrás.`
  return `Se borrará «${list.name}» y sus ${count} ítems. No hay vuelta atrás.`
}

/** Cabecera de la hoja de una archivada en móvil: «Archivada el 12 sep · 2 pendientes · 84 €» (L13). */
export function archivedSheetSummary(list: List): string {
  const parts: string[] = []
  if (list.archivedAt) parts.push(`Archivada el ${format(list.archivedAt, 'd MMM')}`)
  parts.push(listCounterLabel(list, { empty: EMPTY_ARCHIVED }))
  const total = pendingTotal(list)
  if (total) parts.push(total)
  return parts.join(' · ')
}
