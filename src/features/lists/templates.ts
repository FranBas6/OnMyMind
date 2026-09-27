import { format } from 'date-fns'

import { formatCents } from '@/lib/money'

import type { List, ListKind } from './types'

interface Plural {
  one: string
  other: string
}

interface KindTemplate {
  /** Nombre del tipo en la interfaz («Tareas»). */
  label: string
  /** Descripción corta del selector de tipo (diseño, pantalla 8). */
  description: string
  /** Qué cuenta la lista cuando ya no queda nada pendiente («31 hechas»). */
  doneCounter: Plural
  /** Qué cuenta el contador de pendientes (02 §Inicio, diseño pantalla 2). */
  counter: Plural
}

/**
 * Plantillas de los tipos base. El esquema de campos de cada tipo llega con los formularios
 * de ítem (1.8); aquí solo lo que Inicio necesita saber del tipo. Los estados de cada tipo viven
 * en `features/items/status.ts`.
 */
export const KIND_TEMPLATES: Record<ListKind, KindTemplate> = {
  inbox: {
    label: 'En mente',
    description: 'Lo que capturas sin elegir lista.',
    doneCounter: { one: 'hecha', other: 'hechas' },
    counter: { one: 'cosa sin ordenar', other: 'cosas sin ordenar' },
  },
  tasks: {
    label: 'Tareas',
    description: 'Prioridad, fecha límite y estado.',
    doneCounter: { one: 'hecha', other: 'hechas' },
    counter: { one: 'pendiente', other: 'pendientes' },
  },
  shopping: {
    label: 'Compras',
    description: 'Precio, tienda e histórico de precios.',
    doneCounter: { one: 'comprada', other: 'compradas' },
    counter: { one: 'pendiente', other: 'pendientes' },
  },
  events: {
    label: 'Eventos',
    description: 'Fecha y hora, recordatorio, repetición.',
    doneCounter: { one: 'pasado', other: 'pasados' },
    counter: { one: 'próximo', other: 'próximos' },
  },
  custom: {
    label: 'Personalizada',
    description: 'Tú decides los campos.',
    doneCounter: { one: 'hecha', other: 'hechas' },
    counter: { one: 'pendiente', other: 'pendientes' },
  },
}

/** «4 pendientes», «1 próximo», «3 cosas sin ordenar»; la inbox vacía, «Nada sin ordenar» (05). */
export function counterLabel(kind: ListKind, count: number): string {
  if (kind === 'inbox' && count === 0) return 'Nada sin ordenar'
  const { counter } = KIND_TEMPLATES[kind]
  return `${count} ${count === 1 ? counter.one : counter.other}`
}

/** Lo que ya está fuera de la cabeza: «2 hechas», «1 pasado». */
export function doneLabel(kind: ListKind, count: number): string {
  const { doneCounter } = KIND_TEMPLATES[kind]
  return `${count} ${count === 1 ? doneCounter.one : doneCounter.other}`
}

/** Total pendiente de una lista de compras («627 €»), o `null` si no es de compras o no hay importe. */
export function pendingTotal(list: List): string | null {
  if (list.kind !== 'shopping' || list.counters.pendingPriceCents <= 0) return null
  return formatCents(list.counters.pendingPriceCents)
}

/** Total de ítems de la lista (pendientes y fuera de la cabeza). */
export function itemCount(list: List): number {
  return list.counters.pending + list.counters.done
}

/** «12 ítems», «1 ítem». */
export function itemsLabel(count: number): string {
  return `${count} ${count === 1 ? 'ítem' : 'ítems'}`
}

/** Contador de una lista: lo pendiente o, si no queda nada, lo hecho («31 hechas»). */
function statusLabel(list: List): string {
  if (list.counters.pending > 0 || list.counters.done === 0) {
    return counterLabel(list.kind, list.counters.pending)
  }
  return doneLabel(list.kind, list.counters.done)
}

/** Cabecera del menú ···: «Tareas · 6 pendientes · 12 ítems» (diseño 04 Listas, L3). */
export function menuSummary(list: List): string {
  return [
    KIND_TEMPLATES[list.kind].label,
    counterLabel(list.kind, list.counters.pending),
    itemsLabel(itemCount(list)),
  ].join(' · ')
}

/** Fila de una archivada: «Compras · 2 pendientes · archivada el 12 sep» (L12). */
export function archivedSummary(list: List): string {
  const parts = [KIND_TEMPLATES[list.kind].label, statusLabel(list)]
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
