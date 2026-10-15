import { describe, expect, it } from 'vitest'

import {
  archivedCountLabel,
  archivedSummary,
  counterLabel,
  deleteMessage,
  doneLabel,
  listCounterLabel,
  listStyle,
  menuSummary,
  pendingTotal,
  waitingCount,
} from './templates'
import type { List } from './types'

function list(overrides: Partial<List>): List {
  return {
    id: 'l1',
    name: 'Casa',
    color: 'coral',
    icon: null,
    kind: 'tasks',
    view: 'list',
    position: 1000,
    counters: {
      pending: 0,
      done: 0,
      pendingPriceCents: 0,
      notes: 0,
      kinds: { note: 0, task: 0, shopping: 0, event: 0 },
    },
    archivedAt: null,
    isOwner: true,
    hidden: false,
    ...overrides,
  }
}

describe('counterLabel', () => {
  it.each([
    ['list', 4, '4 pendientes'],
    ['list', 1, '1 pendiente'],
    ['agenda', 2, '2 próximos'],
    ['agenda', 1, '1 próximo'],
    ['inbox', 3, '3 cosas sin ordenar'],
    ['inbox', 1, '1 cosa sin ordenar'],
    ['inbox', 0, 'Nada sin ordenar'],
    ['list', 0, '0 pendientes'],
  ] as const)('%s con %i → «%s»', (style, count, expected) => {
    expect(counterLabel(style, count)).toBe(expected)
  })
})

describe('doneLabel', () => {
  it.each([
    ['list', 2, '2 hechas'],
    ['list', 1, '1 hecha'],
    ['agenda', 1, '1 pasado'],
    ['list', 0, '0 hechas'],
  ] as const)('%s con %i → «%s»', (style, count, expected) => {
    expect(doneLabel(style, count)).toBe(expected)
  })
})

describe('pendingTotal', () => {
  it('en compras con importe, el total en euros', () => {
    const compras = list({
      kind: 'shopping',
      view: 'list',
      counters: {
        pending: 3,
        done: 0,
        pendingPriceCents: 62700,
        notes: 0,
        kinds: { note: 0, task: 0, shopping: 0, event: 0 },
      },
    })
    expect(pendingTotal(compras)).toBe('627\u00a0€')
  })

  it('sin importe, nada', () => {
    expect(pendingTotal(list({ kind: 'shopping' }))).toBeNull()
  })

  it('en cualquier lista con compras con precio (plan 02-fase-2, decisión 6)', () => {
    expect(
      pendingTotal(
        list({
          kind: 'tasks',
          counters: {
            pending: 1,
            done: 0,
            pendingPriceCents: 500,
            notes: 0,
            kinds: { note: 0, task: 0, shopping: 0, event: 0 },
          },
        }),
      ),
    ).toBe('5 €')
  })
})

describe('textos del menú, archivadas y borrado', () => {
  const trabajo = list({
    name: 'Trabajo',
    counters: {
      pending: 6,
      done: 6,
      pendingPriceCents: 0,
      notes: 0,
      kinds: { note: 0, task: 0, shopping: 0, event: 0 },
    },
  })

  it('cabecera del menú: los contadores comunes y el total de ítems (5.5, sin tipo)', () => {
    expect(menuSummary(trabajo)).toBe('6 pendientes · 12 ítems')
    expect(
      menuSummary(
        list({
          counters: {
            pending: 4,
            done: 0,
            pendingPriceCents: 0,
            notes: 2,
            kinds: { note: 2, task: 4, shopping: 0, event: 0 },
          },
        }),
      ),
    ).toBe('4 pendientes · 2 notas · 6 ítems')
    expect(menuSummary(list({}))).toBe('Lista recién creada')
  })

  it('«En mente» cuenta también sus notas, que siguen sin ordenar (5.3)', () => {
    const inbox = list({
      kind: 'inbox',
      name: 'En mente',
      counters: {
        pending: 1,
        done: 0,
        pendingPriceCents: 0,
        notes: 2,
        kinds: { note: 2, task: 1, shopping: 0, event: 0 },
      },
    })
    expect(waitingCount(inbox)).toBe(3)
    expect(menuSummary(inbox)).toBe('3 cosas sin ordenar · 3 ítems')
  })

  it('archivada: con pendientes, o lo hecho si ya no queda nada, y la fecha', () => {
    const compras = list({
      kind: 'shopping',
      view: 'list',
      counters: {
        pending: 2,
        done: 1,
        pendingPriceCents: 0,
        notes: 0,
        kinds: { note: 0, task: 0, shopping: 0, event: 0 },
      },
      archivedAt: new Date(2026, 8, 12),
    })
    expect(archivedSummary(compras)).toBe('2 pendientes · archivada el 12 sep')
    const hechas = list({
      counters: {
        pending: 0,
        done: 31,
        pendingPriceCents: 0,
        notes: 0,
        kinds: { note: 0, task: 0, shopping: 0, event: 0 },
      },
      archivedAt: new Date(2026, 5, 3),
    })
    expect(archivedSummary(hechas)).toBe('31 hechas · archivada el 3 jun')
  })

  it('contador de archivadas en singular y plural', () => {
    expect(archivedCountLabel(1)).toBe('1 lista archivada')
    expect(archivedCountLabel(2)).toBe('2 listas archivadas')
  })

  it('confirmación de borrado según cuántos ítems se pierden', () => {
    expect(deleteMessage(trabajo)).toBe('Se borrará «Trabajo» y sus 12 ítems. No hay vuelta atrás.')
    expect(
      deleteMessage(
        list({
          name: 'Uno',
          counters: {
            pending: 1,
            done: 0,
            pendingPriceCents: 0,
            notes: 0,
            kinds: { note: 0, task: 0, shopping: 0, event: 0 },
          },
        }),
      ),
    ).toBe('Se borrará «Uno» y su ítem. No hay vuelta atrás.')
    expect(deleteMessage(list({ name: 'Vacía' }))).toBe('Se borrará «Vacía». No hay vuelta atrás.')
  })
})

describe('una lista guardada en caché antes de la 5.3', () => {
  it('sin `view`, cuenta como una lista y no rompe Inicio', () => {
    // La forma de antes: sin la vista (ni notas ni totales por tipo en los contadores).
    const old = { ...list({ name: 'Compras' }), view: undefined } as unknown as List
    expect(listStyle(old)).toBe('list')
    expect(listCounterLabel(old)).toBe('Lista recién creada')
  })
})
