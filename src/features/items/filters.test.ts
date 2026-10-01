import { describe, expect, it } from 'vitest'

import { detailSummary, matchesAge, splitItems, statusFilterOptions } from './filters'
import type { Item } from './types'

const now = new Date('2026-09-27T12:00:00')

function item(id: string, overrides: Partial<Item> = {}): Item {
  return {
    id,
    listId: 'casa',
    kind: 'task',
    parentId: null,
    title: id,
    notes: null,
    status: 'pending',
    priority: null,
    dueAt: null,
    allDay: false,
    recurrence: null,
    position: 1000,
    completedAt: null,
    createdAt: new Date('2026-09-20T10:00:00'),
    leftInboxId: null,
    leftInboxAt: null,
    url: null,
    urlTitle: null,
    imageUrl: null,
    imagePath: null,
    urlSite: null,
    priceCents: null,
    currency: 'EUR',
    priceSource: null,
    previousPriceCents: null,
    priceCheckedAt: null,
    ...overrides,
  }
}

const ids = (items: Item[]) => items.map((entry) => entry.id)

describe('splitItems', () => {
  it('separa lo terminado en «Fuera de la cabeza», lo último primero', () => {
    const items = [
      item('grifo', { position: 1000 }),
      item('basura', {
        status: 'done',
        position: 2000,
        completedAt: new Date('2026-09-25T10:00:00'),
      }),
      item('dni', { position: 3000, status: 'in_progress' }),
      item('comunidad', {
        status: 'done',
        position: 500,
        completedAt: new Date('2026-09-26T10:00:00'),
      }),
    ]
    const { active, outOfMind } = splitItems(items, 'tasks', { now })
    expect(ids(active)).toEqual(['grifo', 'dni'])
    expect(ids(outOfMind)).toEqual(['comunidad', 'basura'])
  })

  it('ordena por posición y, a igualdad, por antigüedad', () => {
    const items = [
      item('b', { position: 2000 }),
      item('c', { position: 1000, createdAt: new Date('2026-09-22T10:00:00') }),
      item('a', { position: 1000, createdAt: new Date('2026-09-21T10:00:00') }),
    ]
    expect(ids(splitItems(items, 'tasks', { now }).active)).toEqual(['a', 'c', 'b'])
  })

  it('un recién terminado se queda en su sitio mientras está en `lingering`', () => {
    const items = [item('grifo', { status: 'done', completedAt: now })]
    const { active, outOfMind } = splitItems(items, 'tasks', { now, lingering: new Set(['grifo']) })
    expect(ids(active)).toEqual(['grifo'])
    expect(outOfMind).toEqual([])
  })

  it('«En mente» va por fecha de captura, la más reciente arriba o abajo', () => {
    const items = [
      item('vieja', { createdAt: new Date('2026-09-01T10:00:00'), position: 1000 }),
      item('nueva', { createdAt: new Date('2026-09-27T10:00:00'), position: 2000 }),
    ]
    expect(ids(splitItems(items, 'inbox', { now }).active)).toEqual(['nueva', 'vieja'])
    expect(ids(splitItems(items, 'inbox', { now, sort: 'oldest' }).active)).toEqual([
      'vieja',
      'nueva',
    ])
  })

  it('los eventos pasados bajan aunque sigan «próximos»', () => {
    const items = [
      item('cena', { kind: 'event', status: 'upcoming', dueAt: new Date('2026-09-20T21:00:00') }),
      item('viaje', { kind: 'event', status: 'upcoming', dueAt: new Date('2026-10-04T08:00:00') }),
    ]
    const { active, outOfMind } = splitItems(items, 'events', { now })
    expect(ids(active)).toEqual(['viaje'])
    expect(ids(outOfMind)).toEqual(['cena'])
  })
})

describe('filtros', () => {
  it('etiquetas del tipo', () => {
    expect(statusFilterOptions('tasks').map((option) => option.label)).toEqual([
      'Todas',
      'Pendientes',
      'Hechas',
    ])
    expect(statusFilterOptions('events').map((option) => option.label)).toEqual([
      'Todas',
      'Próximos',
      'Pasados',
    ])
  })

  it('«Esta semana» son los siete últimos días; «Antiguas», lo anterior', () => {
    const reciente = item('r', { createdAt: new Date('2026-09-21T12:00:00') })
    const antigua = item('a', { createdAt: new Date('2026-09-20T11:59:00') })
    expect(matchesAge(reciente, 'week', now)).toBe(true)
    expect(matchesAge(antigua, 'week', now)).toBe(false)
    expect(matchesAge(antigua, 'older', now)).toBe(true)
    expect(matchesAge(antigua, 'all', now)).toBe(true)
  })
})

describe('detailSummary', () => {
  it.each([
    ['tasks', 4, 2, '4 pendientes · 2 hechas'],
    ['tasks', 0, 6, '0 pendientes · 6 hechas'],
    ['tasks', 1, 1, '1 pendiente · 1 hecha'],
    ['tasks', 0, 0, 'Tareas · recién creada'],
    ['events', 2, 1, '2 próximos · 1 pasado'],
    ['inbox', 5, 2, '5 cosas sin ordenar'],
    ['inbox', 0, 2, 'Nada sin ordenar'],
  ] as const)('%s con %i y %i → «%s»', (kind, pending, done, expected) => {
    expect(detailSummary(kind, pending, done)).toBe(expected)
  })
})
