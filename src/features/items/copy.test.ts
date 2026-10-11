import { describe, expect, it } from 'vitest'

import type { List } from '@/features/lists'

import { addPlaceholder, destinationSummary, itemMoment } from './copy'

const now = new Date(2026, 8, 25, 18, 0)

function list(kind: List['kind'], name: string, pending = 3, notes = 0): List {
  return {
    id: name,
    name,
    color: 'coral',
    icon: null,
    kind,
    view: kind === 'events' ? 'agenda' : 'list',
    position: 1000,
    counters: {
      pending,
      done: 0,
      pendingPriceCents: 0,
      notes,
      kinds: { note: 0, task: 0, shopping: 0, event: 0 },
    },
    archivedAt: null,
    isOwner: true,
  }
}

describe('itemMoment', () => {
  it.each([
    [
      { status: 'pending', completedAt: null, createdAt: new Date(2026, 8, 25, 17, 55) },
      'capturada hace 5 min',
    ],
    [
      { status: 'pending', completedAt: null, createdAt: new Date(2026, 8, 24, 10) },
      'capturada ayer',
    ],
    [
      { status: 'pending', completedAt: null, createdAt: new Date(2026, 8, 22, 10) },
      'capturada el martes',
    ],
    [
      { status: 'pending', completedAt: null, createdAt: new Date(2026, 8, 14, 10) },
      'creada el 14 sep',
    ],
    [
      { status: 'done', completedAt: new Date(2026, 8, 25, 9), createdAt: new Date(2026, 8, 14) },
      'hecha hoy',
    ],
    [
      { status: 'bought', completedAt: new Date(2026, 8, 24, 9), createdAt: new Date(2026, 8, 14) },
      'comprado ayer',
    ],
  ] as const)('%j → «%s»', (item, expected) => {
    expect(itemMoment(item, now)).toBe(expected)
  })
})

describe('destinationSummary', () => {
  it('lista o agenda y su contador; la inbox, lo que tiene sin ordenar, notas incluidas (5.3)', () => {
    expect(destinationSummary(list('tasks', 'Casa', 4))).toBe('Lista · 4 pendientes')
    expect(destinationSummary(list('events', 'Agenda', 2))).toBe('Agenda · 2 próximos')
    expect(destinationSummary(list('inbox', 'En mente', 3, 2))).toBe('Sin ordenar · 5 cosas')
  })
})

describe('addPlaceholder', () => {
  it('«En mente», la primera cosa del tipo que propone la lista, o «Añadir a…»', () => {
    expect(addPlaceholder(list('inbox', 'En mente'), true, 'note')).toBe('¿Qué tienes en mente?')
    expect(addPlaceholder(list('list', 'Casa'), true, 'task')).toBe('Primera tarea…')
    expect(addPlaceholder(list('list', 'Compras'), true, 'shopping')).toBe('Primer producto…')
    expect(addPlaceholder(list('list', 'Casa'), false, 'task')).toBe('Añadir a Casa…')
  })
})
