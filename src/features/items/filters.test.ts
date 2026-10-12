import { describe, expect, it } from 'vitest'

import {
  agendaSummary,
  detailSummary,
  filterEvents,
  listSummary,
  matchesAge,
  splitItems,
  statusFilterOptions,
} from './filters'
import type { Item } from './types'

const now = new Date('2026-09-27T12:00:00')

function item(id: string, overrides: Partial<Item> = {}): Item {
  return {
    id,
    listId: 'casa',
    kind: 'task',
    parentId: null,
    chooseOne: false,
    chosenId: null,
    sealed: null,
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
    links: [],
    images: [],
    priceLinkId: null,
    priceStore: null,
    priceTracking: null,
    createdBy: null,
    completedBy: null,
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
  it('etiquetas comunes; la agenda, próximos y pasados (5.3)', () => {
    expect(statusFilterOptions('list').map((option) => option.label)).toEqual([
      'Todas',
      'Pendientes',
      'Hechas',
    ])
    expect(statusFilterOptions('agenda').map((option) => option.label)).toEqual([
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

describe('detailSummary (contadores comunes, diseño 25)', () => {
  it.each([
    ['list', 4, 0, 2, '4 pendientes · 2 hechas'],
    ['list', 4, 3, 2, '4 pendientes · 3 notas · 2 hechas'],
    ['list', 0, 6, 0, '6 notas'],
    ['list', 0, 0, 6, '6 hechas'],
    ['list', 1, 1, 1, '1 pendiente · 1 nota · 1 hecha'],
    ['list', 0, 0, 0, 'Lista recién creada'],
    ['agenda', 3, 1, 0, '3 próximos · 1 nota'],
    ['inbox', 3, 2, 2, '5 cosas sin ordenar'],
    ['inbox', 0, 0, 2, 'Nada sin ordenar'],
  ] as const)('%s con %i, %i notas y %i → «%s»', (style, pending, notes, done, expected) => {
    expect(detailSummary(style, { pending, notes, done })).toBe(expected)
  })
})

describe('listSummary', () => {
  it('cuenta lo pendiente, las notas y lo hecho, y sin nada dice «Lista recién creada»', () => {
    const items = [
      item('Vuelo a Lisboa', { kind: 'note' }),
      item('Reservar el hotel'),
      item('Cambiar euros', { status: 'done', completedAt: now }),
    ]
    expect(listSummary('list', items)).toBe('1 pendiente · 1 nota · 1 hecha')
    expect(listSummary('list', [])).toBe('Lista recién creada')
  })
})

describe('lista de eventos (diseño 17)', () => {
  // Martes 22 de septiembre de 2026, a mediodía.
  const now = new Date(2026, 8, 22, 12, 0)
  const evento = (title: string, overrides: Partial<Item> = {}) =>
    item(title, { kind: 'event', status: 'upcoming', allDay: false, ...overrides })
  const items = [
    evento('Cena de antiguos alumnos', { dueAt: null }),
    evento('Dentista', { dueAt: new Date(2026, 8, 22, 10) }),
    evento('Cumpleaños de Marta', { dueAt: new Date(2026, 8, 23), allDay: true }),
    evento('Cena con los de la uni', {
      dueAt: new Date(2026, 7, 24, 21),
      recurrence: 'monthly',
    }),
    evento('Concierto', { dueAt: new Date(2026, 8, 12, 21, 30) }),
    evento('Reunión de la comunidad', {
      dueAt: new Date(2026, 8, 24, 19),
      status: 'cancelled',
      completedAt: new Date(2026, 8, 20),
    }),
  ]
  const titles = (list: Item[]) => list.map((entry) => entry.title)

  it('«Próximos» es lo que tiene día y aún no ha llegado', () => {
    expect(titles(filterEvents(items, 'upcoming', now))).toEqual([
      'Cumpleaños de Marta',
      'Cena con los de la uni',
    ])
  })

  it('«Pasados» también lleva lo de hoy cuya hora ya pasó; «Cancelados», lo cancelado', () => {
    expect(titles(filterEvents(items, 'past', now))).toEqual(['Dentista', 'Concierto'])
    expect(titles(filterEvents(items, 'cancelled', now))).toEqual(['Reunión de la comunidad'])
  })

  it('la cabecera cuenta los eventos que quedan, lo demás pendiente y las notas (diseño 25, B10)', () => {
    expect(agendaSummary(items, now)).toBe('4 próximos')
    expect(
      agendaSummary(
        [
          ...items,
          item('Pedir cita para la ITV', { dueAt: new Date(2026, 8, 25) }),
          item('Qué preguntar al dentista', { kind: 'note' }),
        ],
        now,
      ),
    ).toBe('4 próximos · 1 pendiente · 1 nota')
    expect(agendaSummary(items.slice(4), now)).toBe('2 pasados')
    expect(agendaSummary([], now)).toBe('Lista recién creada')
  })
})
