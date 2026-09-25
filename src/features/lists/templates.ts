import { formatCents } from '@/lib/money'

import type { List, ListKind } from './types'

interface Plural {
  one: string
  other: string
}

interface KindTemplate {
  /** Nombre del tipo en la interfaz («Tareas»). */
  label: string
  /** Qué cuenta el contador de pendientes (02 §Inicio, diseño pantalla 2). */
  counter: Plural
  /** Estados válidos del tipo (03 §items), con su etiqueta; el primero es el inicial. */
  statuses: readonly { value: string; label: string; final: boolean }[]
}

/**
 * Plantillas de los tipos base. El esquema de campos de cada tipo llega con los formularios
 * de ítem (1.8); aquí solo lo que Inicio y los filtros necesitan saber del tipo.
 */
export const KIND_TEMPLATES: Record<ListKind, KindTemplate> = {
  inbox: {
    label: 'En mente',
    counter: { one: 'cosa sin ordenar', other: 'cosas sin ordenar' },
    statuses: [
      { value: 'pending', label: 'Pendiente', final: false },
      { value: 'done', label: 'Hecha', final: true },
    ],
  },
  tasks: {
    label: 'Tareas',
    counter: { one: 'pendiente', other: 'pendientes' },
    statuses: [
      { value: 'pending', label: 'Pendiente', final: false },
      { value: 'in_progress', label: 'En curso', final: false },
      { value: 'done', label: 'Hecha', final: true },
    ],
  },
  shopping: {
    label: 'Compras',
    counter: { one: 'pendiente', other: 'pendientes' },
    statuses: [
      { value: 'pending', label: 'Pendiente', final: false },
      { value: 'bought', label: 'Comprado', final: true },
      { value: 'discarded', label: 'Descartado', final: true },
    ],
  },
  events: {
    label: 'Eventos',
    counter: { one: 'próximo', other: 'próximos' },
    statuses: [
      { value: 'upcoming', label: 'Próximo', final: false },
      { value: 'cancelled', label: 'Cancelado', final: true },
    ],
  },
  custom: {
    label: 'Personalizada',
    counter: { one: 'pendiente', other: 'pendientes' },
    statuses: [
      { value: 'pending', label: 'Pendiente', final: false },
      { value: 'done', label: 'Hecha', final: true },
    ],
  },
}

/** «4 pendientes», «1 próximo», «3 cosas sin ordenar». */
export function counterLabel(kind: ListKind, count: number): string {
  const { counter } = KIND_TEMPLATES[kind]
  return `${count} ${count === 1 ? counter.one : counter.other}`
}

/** Total pendiente de una lista de compras («627 €»), o `null` si no es de compras o no hay importe. */
export function pendingTotal(list: List): string | null {
  if (list.kind !== 'shopping' || list.counters.pendingPriceCents <= 0) return null
  return formatCents(list.counters.pendingPriceCents)
}
