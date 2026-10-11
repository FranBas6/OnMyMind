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

/** Contador de una lista: lo pendiente o, si no queda nada, lo hecho («31 hechas»). */
function statusLabel(list: List): string {
  const style = listStyle(list)
  const waiting = waitingCount(list)
  if (waiting > 0 || list.counters.done === 0) return counterLabel(style, waiting)
  return doneLabel(style, list.counters.done)
}

/** Cabecera del menú ···: «Lista · 6 pendientes · 12 ítems» (diseño 04 Listas, L3). */
export function menuSummary(list: List): string {
  const style = listStyle(list)
  return [
    STYLE_TEMPLATES[style].label,
    counterLabel(style, waitingCount(list)),
    itemsLabel(itemCount(list)),
  ].join(' · ')
}

/** Fila de una archivada: «Lista · 2 pendientes · archivada el 12 sep» (L12). */
export function archivedSummary(list: List): string {
  const parts = [STYLE_TEMPLATES[listStyle(list)].label, statusLabel(list)]
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
  parts.push(statusLabel(list))
  const total = pendingTotal(list)
  if (total) parts.push(total)
  return parts.join(' · ')
}
