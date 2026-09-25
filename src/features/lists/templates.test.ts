import { describe, expect, it } from 'vitest'

import { counterLabel, pendingTotal } from './templates'
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
    ['shopping', 0, '0 pendientes'],
    ['custom', 7, '7 pendientes'],
  ] as const)('%s con %i → «%s»', (kind, count, expected) => {
    expect(counterLabel(kind, count)).toBe(expected)
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

  it('sin importe o en otro tipo de lista, nada', () => {
    expect(pendingTotal(list({ kind: 'shopping' }))).toBeNull()
    expect(
      pendingTotal(
        list({ kind: 'tasks', counters: { pending: 1, done: 0, pendingPriceCents: 500 } }),
      ),
    ).toBeNull()
  })
})
