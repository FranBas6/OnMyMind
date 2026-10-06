import { describe, expect, it } from 'vitest'

import {
  archivedCountLabel,
  archivedSummary,
  counterLabel,
  deleteMessage,
  doneLabel,
  menuSummary,
  pendingTotal,
} from './templates'
import type { List } from './types'

function list(overrides: Partial<List>): List {
  return {
    id: 'l1',
    name: 'Casa',
    color: 'coral',
    icon: null,
    kind: 'tasks',
    position: 1000,
    counters: { pending: 0, done: 0, pendingPriceCents: 0 },
    archivedAt: null,
    isOwner: true,
    ...overrides,
  }
}

describe('counterLabel', () => {
  it.each([
    ['tasks', 4, '4 pendientes'],
    ['tasks', 1, '1 pendiente'],
    ['events', 2, '2 próximos'],
    ['events', 1, '1 próximo'],
    ['inbox', 3, '3 cosas sin ordenar'],
    ['inbox', 1, '1 cosa sin ordenar'],
    ['inbox', 0, 'Nada sin ordenar'],
    ['shopping', 0, '0 pendientes'],
    ['custom', 7, '7 pendientes'],
  ] as const)('%s con %i → «%s»', (kind, count, expected) => {
    expect(counterLabel(kind, count)).toBe(expected)
  })
})

describe('doneLabel', () => {
  it.each([
    ['tasks', 2, '2 hechas'],
    ['tasks', 1, '1 hecha'],
    ['events', 1, '1 pasado'],
    ['shopping', 0, '0 compradas'],
  ] as const)('%s con %i → «%s»', (kind, count, expected) => {
    expect(doneLabel(kind, count)).toBe(expected)
  })
})

describe('pendingTotal', () => {
  it('en compras con importe, el total en euros', () => {
    const compras = list({
      kind: 'shopping',
      counters: { pending: 3, done: 0, pendingPriceCents: 62700 },
    })
    expect(pendingTotal(compras)).toBe('627\u00a0€')
  })

  it('sin importe, nada', () => {
    expect(pendingTotal(list({ kind: 'shopping' }))).toBeNull()
  })

  it('en cualquier lista con compras con precio (plan 02-fase-2, decisión 6)', () => {
    expect(
      pendingTotal(
        list({ kind: 'tasks', counters: { pending: 1, done: 0, pendingPriceCents: 500 } }),
      ),
    ).toBe('5 €')
  })
})

describe('textos del menú, archivadas y borrado', () => {
  const trabajo = list({ name: 'Trabajo', counters: { pending: 6, done: 6, pendingPriceCents: 0 } })

  it('cabecera del menú: tipo, pendientes y total de ítems', () => {
    expect(menuSummary(trabajo)).toBe('Tareas · 6 pendientes · 12 ítems')
  })

  it('archivada: con pendientes, o lo hecho si ya no queda nada, y la fecha', () => {
    const compras = list({
      kind: 'shopping',
      counters: { pending: 2, done: 1, pendingPriceCents: 0 },
      archivedAt: new Date(2026, 8, 12),
    })
    expect(archivedSummary(compras)).toBe('Compras · 2 pendientes · archivada el 12 sep')
    const hechas = list({
      counters: { pending: 0, done: 31, pendingPriceCents: 0 },
      archivedAt: new Date(2026, 5, 3),
    })
    expect(archivedSummary(hechas)).toBe('Tareas · 31 hechas · archivada el 3 jun')
  })

  it('contador de archivadas en singular y plural', () => {
    expect(archivedCountLabel(1)).toBe('1 lista archivada')
    expect(archivedCountLabel(2)).toBe('2 listas archivadas')
  })

  it('confirmación de borrado según cuántos ítems se pierden', () => {
    expect(deleteMessage(trabajo)).toBe('Se borrará «Trabajo» y sus 12 ítems. No hay vuelta atrás.')
    expect(
      deleteMessage(list({ name: 'Uno', counters: { pending: 1, done: 0, pendingPriceCents: 0 } })),
    ).toBe('Se borrará «Uno» y su ítem. No hay vuelta atrás.')
    expect(deleteMessage(list({ name: 'Vacía' }))).toBe('Se borrará «Vacía». No hay vuelta atrás.')
  })
})
