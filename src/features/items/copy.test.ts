import { describe, expect, it } from 'vitest'

import type { List } from '@/features/lists'

import { destinationSummary, itemMoment, moveHint } from './copy'

const now = new Date(2026, 8, 25, 18, 0)

function list(kind: List['kind'], name: string, pending = 3): List {
  return {
    id: name,
    name,
    color: 'coral',
    icon: null,
    kind,
    position: 1000,
    counters: { pending, done: 0, pendingPriceCents: 0 },
    archivedAt: null,
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

describe('moveHint', () => {
  const none = { priority: false, dueAt: false }

  it('lo que se pierde manda sobre todo lo demás', () => {
    expect(moveHint('tasks', list('inbox', 'En mente'), { priority: true, dueAt: true })).toBe(
      'Se quitan la prioridad y la fecha.',
    )
  })

  it('desde «En mente», cómo se guardará', () => {
    expect(moveHint('inbox', list('events', 'Agenda'), none)).toBe(
      'Se guarda como evento en Agenda. Podrás ponerle fecha después.',
    )
    expect(moveHint('inbox', list('shopping', 'Compras tech'), none)).toBe(
      'Se guarda como producto en Compras tech.',
    )
  })

  it('entre listas normales sin pérdidas, nada', () => {
    expect(moveHint('tasks', list('tasks', 'Trabajo'), none)).toBeNull()
  })
})

describe('destinationSummary', () => {
  it('tipo y contador; la inbox, lo que tiene sin ordenar', () => {
    expect(destinationSummary(list('tasks', 'Casa', 4))).toBe('Tareas · 4 pendientes')
    expect(destinationSummary(list('inbox', 'En mente', 5))).toBe('Sin ordenar · 5 cosas')
  })
})
