import { describe, expect, it } from 'vitest'

import type { List } from '@/features/lists'

import { addPlaceholder, destinationSummary, doneMoment, itemMoment } from './copy'

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
    hidden: false,
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
      'hecha hoy a las 9:00',
    ],
    [
      { status: 'bought', completedAt: new Date(2026, 8, 24, 9), createdAt: new Date(2026, 8, 14) },
      'comprado ayer',
    ],
  ] as const)('%j → «%s»', (item, expected) => {
    expect(itemMoment(item, now)).toBe(expected)
  })
})

describe('doneMoment', () => {
  const done = (completedAt: Date, status: 'done' | 'bought' = 'done') => ({ status, completedAt })

  it('cuándo se terminó: con la hora solo si es de hoy (Fran, 2026-10-22)', () => {
    expect(doneMoment(done(new Date(2026, 8, 25, 14, 5)), now)).toBe('hecha hoy · 14:05')
    expect(doneMoment(done(new Date(2026, 8, 24, 9), 'bought'), now)).toBe('comprado ayer')
    expect(doneMoment(done(new Date(2026, 8, 14, 9)), now)).toBe('hecha el 14 sep')
    expect(doneMoment(done(new Date(2025, 11, 30, 9)), now)).toBe('hecha el 30 dic 2025')
  })

  it('sin el verbo, si la fila ya dice cómo terminó', () => {
    const verb = false
    expect(doneMoment(done(new Date(2026, 8, 25, 14, 5)), now, { verb })).toBe('hoy · 14:05')
    expect(doneMoment(done(new Date(2026, 8, 14, 9)), now, { verb })).toBe('14 sep')
  })

  it('nada si no está terminado', () => {
    expect(doneMoment({ status: 'pending', completedAt: null }, now)).toBeNull()
  })
})

describe('destinationSummary', () => {
  it('los contadores comunes; la inbox, lo que tiene sin ordenar, notas incluidas (5.5)', () => {
    expect(destinationSummary(list('tasks', 'Casa', 4))).toBe('4 pendientes')
    expect(destinationSummary(list('tasks', 'Viajes', 3, 2))).toBe('3 pendientes · 2 notas')
    expect(destinationSummary(list('events', 'Agenda', 2))).toBe('2 próximos')
    expect(destinationSummary(list('inbox', 'En mente', 3, 2))).toBe('Sin ordenar · 5 cosas')
  })
})

describe('addPlaceholder', () => {
  it('«En mente», la primera cosa del tipo que propone la lista, o «Añadir a…»', () => {
    expect(addPlaceholder(list('inbox', 'En mente'))).toBe('¿Qué tienes en mente?')
    // También vacía (diseño 25, B5).
    expect(addPlaceholder(list('list', 'Ideas'))).toBe('Añadir a Ideas…')
  })
})
