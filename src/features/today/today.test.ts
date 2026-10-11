import { describe, expect, it } from 'vitest'

import type { Item } from '@/features/items'
import type { List } from '@/features/lists'

import {
  dayEyebrow,
  dayKey,
  dayTitle,
  doneTodayLabel,
  emptyDay,
  groupDay,
  groupToday,
  markedDays,
  monthGrid,
  parseDayKey,
  stripMonth,
  overdueLabel,
  pausedNote,
  showsInToday,
  todayMeta,
} from './today'

// Fechas locales (`new Date(año, mes, día…)`): el test vale en cualquier zona horaria.
const now = new Date(2026, 8, 28, 10, 0)
const at = (day: number, hour = 0, minute = 0) => new Date(2026, 8, day, hour, minute)

function list(id: string, overrides: Partial<List> = {}): List {
  return {
    id,
    name: id,
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
    ...overrides,
  }
}

function item(id: string, overrides: Partial<Item> = {}): Item {
  return {
    id,
    listId: 'casa',
    kind: 'task',
    parentId: null,
    chooseOne: false,
    chosenId: null,
    title: id,
    notes: null,
    status: 'pending',
    priority: null,
    dueAt: at(28),
    allDay: true,
    recurrence: null,
    position: 1000,
    completedAt: null,
    createdAt: at(20),
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

const casa = list('casa', { position: 3000 })
const trabajo = list('trabajo', { position: 2000, color: 'pink' })
const lists = [casa, trabajo]

const titles = (groups: ReturnType<typeof groupToday>) =>
  groups.sections.map((section) => [section.list.id, section.items.map((entry) => entry.id)])

describe('groupToday', () => {
  it('lo de ayer y lo de hoy sí; lo de mañana y lo que no tiene fecha, no', () => {
    const items = [
      item('ayer', { dueAt: at(27) }),
      item('hoy', { dueAt: at(28) }),
      item('mañana', { dueAt: at(29) }),
      item('sin-fecha', { dueAt: null }),
    ]
    expect(titles(groupToday(items, lists, { now }))).toEqual([['casa', ['ayer', 'hoy']]])
  })

  it('agrupa por lista en el orden de las listas', () => {
    const items = [item('grifo'), item('informe', { listId: 'trabajo' })]
    expect(titles(groupToday(items, lists, { now }))).toEqual([
      ['trabajo', ['informe']],
      ['casa', ['grifo']],
    ])
  })

  it('atrasadas primero (la más antigua arriba), luego por prioridad y por posición', () => {
    const items = [
      item('baja', { priority: 'low', position: 1000 }),
      item('sin', { position: 500 }),
      item('alta', { priority: 'high', position: 3000 }),
      item('ayer', { dueAt: at(27) }),
      item('hace-una-semana', { dueAt: at(21) }),
      item('sin-2', { position: 600 }),
    ]
    expect(titles(groupToday(items, lists, { now }))).toEqual([
      ['casa', ['hace-una-semana', 'ayer', 'alta', 'baja', 'sin', 'sin-2']],
    ])
  })

  it('solo tareas de listas que sigan en caché (no capturas, ni compras, ni archivadas)', () => {
    const inbox = list('inbox', { kind: 'inbox' })
    const compras = list('compras', { kind: 'shopping' })
    const items = [
      item('captura', { listId: 'inbox', kind: 'note' }),
      item('leche', { listId: 'compras', kind: 'shopping' }),
      item('archivada', { listId: 'otra' }),
      item('grifo'),
    ]
    expect(titles(groupToday(items, [...lists, inbox, compras], { now }))).toEqual([
      ['casa', ['grifo']],
    ])
  })

  it('una tarea con fecha sale en Hoy aunque viva en una lista de otro tipo (ADR-009)', () => {
    const compras = list('compras', { kind: 'shopping' })
    const items = [item('pedir presupuesto', { listId: 'compras' })]
    expect(titles(groupToday(items, [...lists, compras], { now }))).toEqual([
      ['compras', ['pedir presupuesto']],
    ])
  })

  it('lo terminado hoy pasa a «hechas hoy», lo último primero; lo terminado antes, a ningún sitio', () => {
    const items = [
      item('grifo'),
      item('basura', { status: 'done', completedAt: at(28, 8) }),
      item('dni', { status: 'done', completedAt: at(28, 9) }),
      item('vieja', { dueAt: at(26), status: 'done', completedAt: at(27, 20) }),
    ]
    const groups = groupToday(items, lists, { now })
    expect(titles(groups)).toEqual([['casa', ['grifo']]])
    expect(groups.done.map((entry) => entry.item.id)).toEqual(['dni', 'basura'])
    expect(groups.pending).toBe(1)
  })

  it('un recién terminado se queda en su sección mientras está en `lingering`, sin contar', () => {
    const items = [item('grifo', { status: 'done', completedAt: at(28, 10) })]
    const groups = groupToday(items, lists, { now, lingering: new Set(['grifo']) })
    expect(titles(groups)).toEqual([['casa', ['grifo']]])
    expect(groups.done).toEqual([])
    expect(groups.pending).toBe(0)
  })

  it('usa el día local: a las 23:59 lo de mañana aún no entra; a las 00:01, sí', () => {
    const hoy = item('hoy', { dueAt: at(28) })
    const items = [item('mañana', { dueAt: at(29) }), hoy]
    expect(titles(groupToday(items, lists, { now: at(28, 23, 59) }))).toEqual([['casa', ['hoy']]])
    const nextDay = groupToday(items, lists, { now: at(29, 0, 1) })
    expect(titles(nextDay)).toEqual([['casa', ['hoy', 'mañana']]])
    expect(todayMeta(hoy, at(29, 0, 1)).overdue).toBe('Atrasada · ayer')
  })
})

describe('todayMeta', () => {
  it('lo de hoy va en texto, con la prioridad si la tiene', () => {
    expect(todayMeta(item('a'), now)).toEqual({ overdue: null, detail: 'Vence hoy' })
    expect(todayMeta(item('b', { priority: 'high' }), now)).toEqual({
      overdue: null,
      detail: 'Vence hoy · Prioridad alta',
    })
  })

  it('lo atrasado lleva el chip y, en texto, solo la prioridad', () => {
    expect(todayMeta(item('a', { dueAt: at(27) }), now)).toEqual({
      overdue: 'Atrasada · ayer',
      detail: '',
    })
    expect(todayMeta(item('b', { dueAt: at(27), priority: 'medium' }), now).detail).toBe(
      'Prioridad media',
    )
  })
})

describe('overdueLabel', () => {
  it('ayer, el día de la semana hasta seis días y después la fecha', () => {
    expect(overdueLabel(at(27), now)).toBe('Atrasada · ayer')
    expect(overdueLabel(at(22), now)).toBe('Atrasada · martes')
    expect(overdueLabel(at(21), now)).toBe('Atrasada · 21 sep')
    expect(overdueLabel(new Date(2025, 11, 30), now)).toBe('Atrasada · 30 dic 2025')
  })
})

describe('textos', () => {
  it('dayKey y «N hechas hoy»', () => {
    expect(dayKey(now)).toBe('2026-09-28')
    expect(doneTodayLabel(1)).toBe('1 hecha hoy')
    expect(doneTodayLabel(3)).toBe('3 hechas hoy')
  })
})

describe('showsInToday', () => {
  it('lo suelto en la lista y lo de sublistas activas sale; lo de pausadas o hechas, no', () => {
    expect(showsInToday({ parent: null })).toBe(true)
    expect(showsInToday({ parent: { status: 'in_progress' } })).toBe(true)
    expect(showsInToday({ parent: { status: 'paused' } })).toBe(false)
    expect(showsInToday({ parent: { status: 'done' } })).toBe(false)
  })
})

describe('sublistas en Hoy (diseño 12, A1)', () => {
  const dentro = (id: string, status: string, title = 'OnMyMind') => ({
    ...item(id, { parentId: `p-${id}` }),
    parent: { status, title },
  })

  it('lo de dentro de una sublista activa sale; de una pausada, no, y se dice', () => {
    const groups = groupToday(
      [
        dentro('publicar', 'in_progress'),
        dentro('coliseo', 'paused', 'Roma'),
        dentro('x', 'done', 'Oporto'),
      ],
      lists,
      { now },
    )
    expect(titles(groups)).toEqual([['casa', ['publicar']]])
    expect(groups.pending).toBe(1)
    expect(groups.paused).toEqual(['Roma'])
  })

  it('la meta empieza por la ruta', () => {
    expect(todayMeta(dentro('publicar', 'in_progress'), now, 'Develop').detail).toBe(
      'Develop › OnMyMind · Vence hoy',
    )
    const atrasada = { ...dentro('a', 'pending'), dueAt: at(27), priority: 'high' as const }
    expect(todayMeta(atrasada, now, 'Develop').detail).toBe('Develop › OnMyMind · Prioridad alta')
  })

  it('la línea de las pausadas', () => {
    expect(pausedNote(['Roma'])).toBe('Lo de «Roma» no sale: la sublista está pausada.')
    expect(pausedNote(['Roma', 'Oporto'])).toBe(
      'Lo de «Roma» y «Oporto» no sale: las sublistas están pausadas.',
    )
    expect(pausedNote([])).toBeNull()
  })
})

describe('«Agenda» (diseño 17, H1)', () => {
  const agenda = list('agenda', { kind: 'events', view: 'agenda', color: 'amber', position: 1000 })
  const evento = (id: string, overrides: Partial<Item> = {}) =>
    item(id, { listId: 'agenda', kind: 'event', status: 'upcoming', allDay: false, ...overrides })

  it('los eventos de hoy de cualquier lista, también los que se repiten, por hora y con el de todo el día primero', () => {
    const groups = groupToday(
      [
        evento('Reunión con Lucía', { listId: 'trabajo', dueAt: at(28, 16) }),
        evento('Dentista', { dueAt: at(28, 10) }),
        evento('Cumpleaños de Marta', { dueAt: at(28), allDay: true }),
        evento('Stand-up', { listId: 'trabajo', dueAt: at(1, 12), recurrence: 'daily' }),
        evento('Mañana', { dueAt: at(29, 9) }),
        evento('Cancelado', { dueAt: at(28, 11), status: 'cancelled' }),
        evento('Sin fecha', { dueAt: null }),
      ],
      [agenda, trabajo, casa],
      { now },
    )
    expect(groups.agenda.map((entry) => entry.item.title)).toEqual([
      'Cumpleaños de Marta',
      'Dentista',
      'Stand-up',
      'Reunión con Lucía',
    ])
    expect(groups.agenda[3]?.list.id).toBe('trabajo')
    // No cuentan como lo que queda por hacer ni crean secciones de tareas.
    expect(groups.sections).toEqual([])
    expect(groups.pending).toBe(0)
  })

  it('lo de una sublista pausada no sale', () => {
    const groups = groupToday(
      [{ ...evento('Vuelo', { dueAt: at(28, 7) }), parent: { status: 'paused', title: 'Lisboa' } }],
      [agenda],
      { now },
    )
    expect(groups.agenda).toEqual([])
  })
})

// Otro día en Hoy (2.5, diseño 17, C1–C7). Hoy es el lunes 28 de septiembre de 2026.
const today = at(28)
const event = (id: string, overrides: Partial<Item> = {}) =>
  item(id, { kind: 'event', status: 'upcoming', allDay: false, listId: 'trabajo', ...overrides })

describe('el día de la URL y la rejilla del mes', () => {
  it('`?day=` solo vale si es una fecha de verdad', () => {
    expect(parseDayKey('2026-10-14')).toEqual(new Date(2026, 9, 14))
    expect(parseDayKey('2026-02-30')).toBeNull()
    expect(parseDayKey('mañana')).toBeNull()
    expect(parseDayKey('2026-10-14T10:00')).toBeNull()
  })

  it('la rejilla va de lunes a lunes, con las semanas enteras del mes', () => {
    expect(monthGrid(at(28))).toEqual({ start: at(-6 + 7 - 1), end: new Date(2026, 9, 5) })
    expect(monthGrid(new Date(2026, 10, 15))).toEqual({
      start: new Date(2026, 9, 26),
      end: new Date(2026, 11, 7),
    })
  })

  it('la tira de una semana entre dos meses pide el mes de su lunes, que la incluye entera', () => {
    // La semana del jueves 1 de octubre empieza el lunes 28 de septiembre.
    expect(stripMonth(new Date(2026, 9, 1))).toEqual(new Date(2026, 8, 1))
    expect(monthGrid(stripMonth(new Date(2026, 9, 4))).end).toEqual(new Date(2026, 9, 5))
  })
})

describe('groupDay', () => {
  const thursday = new Date(2026, 9, 1)

  it('un día que viene: sus eventos, también los que se repiten, y lo que vence ese día', () => {
    const items = [
      event('reunion', { dueAt: new Date(2026, 9, 1, 11) }),
      event('yoga', { dueAt: at(3, 19), recurrence: 'weekly', listId: 'casa' }),
      event('cancelado', { dueAt: new Date(2026, 9, 1, 9), status: 'cancelled' }),
      event('otro dia', { dueAt: new Date(2026, 9, 2, 9) }),
      item('demo', { listId: 'trabajo', dueAt: thursday, priority: 'high' }),
      item('hecha', { dueAt: thursday, status: 'done', completedAt: at(28, 9) }),
      item('manana', { dueAt: new Date(2026, 9, 2) }),
    ]
    const groups = groupDay(items, lists, { day: thursday, today })
    expect(groups.agenda.map(({ item }) => item.id)).toEqual(['reunion', 'yoga'])
    expect(titles({ ...groupToday([], lists, { now }), sections: groups.sections })).toEqual([
      ['trabajo', ['demo']],
    ])
    expect(groups.done).toEqual([])
    // El yoga es los jueves (empezó el jueves 3): el miércoles 7, no.
    expect(groupDay(items, lists, { day: new Date(2026, 9, 7), today }).agenda).toEqual([])
  })

  it('un día pasado: sus eventos y «Hecho ese día», no lo que venció y sigue pendiente', () => {
    const friday = at(25)
    const items = [
      event('concierto', { dueAt: at(25, 21, 30) }),
      item('regalo', { status: 'done', dueAt: null, completedAt: at(25, 10) }),
      item('pan', { kind: 'shopping', status: 'bought', dueAt: null, completedAt: at(25, 18) }),
      item('descartado', { kind: 'shopping', status: 'discarded', completedAt: at(25, 12) }),
      item('pendiente', { dueAt: at(25) }),
      item('otro dia', { status: 'done', completedAt: at(24, 10) }),
    ]
    const groups = groupDay(items, lists, { day: friday, today })
    expect(groups.agenda.map(({ item }) => item.id)).toEqual(['concierto'])
    expect(groups.sections).toEqual([])
    expect(groups.done.map(({ item }) => item.id)).toEqual(['pan', 'regalo'])
  })

  it('lo de una lista que ya no está (archivada) no sale', () => {
    const groups = groupDay([item('fuera', { listId: 'archivada', dueAt: thursday })], lists, {
      day: thursday,
      today,
    })
    expect(groups.sections).toEqual([])
  })
})

describe('markedDays', () => {
  it('un punto donde el día no sale vacío', () => {
    const items = [
      event('yoga', { dueAt: at(3, 19), recurrence: 'weekly' }),
      item('demo', { dueAt: new Date(2026, 9, 1) }),
      item('atrasada', { dueAt: at(21) }),
      item('hecha', { status: 'done', dueAt: null, completedAt: at(15, 10) }),
      event('cancelado', { dueAt: at(30), status: 'cancelled' }),
    ]
    const marked = markedDays(items, lists, { ...monthGrid(today), today })
    expect([...marked].sort()).toEqual([
      '2026-09-03',
      '2026-09-10',
      '2026-09-15',
      '2026-09-17',
      '2026-09-24',
      '2026-10-01',
    ])
  })
})

describe('la cabecera de otro día (diseño 17, C2, C4 y C5)', () => {
  it('el título: «Hoy», el día de este mes o con el mes', () => {
    expect(dayTitle(at(28, 15), today)).toBe('Hoy')
    expect(dayTitle(at(25), today)).toBe('Viernes 25')
    expect(dayTitle(new Date(2026, 10, 15), today)).toBe('Domingo 15 nov')
    expect(dayTitle(new Date(2027, 0, 2), today)).toBe('Sábado 2 ene 2027')
  })

  it('la línea de encima, con la distancia hasta cuatro semanas', () => {
    expect(dayEyebrow(today, today)).toBeNull()
    expect(dayEyebrow(at(29), today)).toBe('Hoy es lunes 28 · mañana')
    expect(dayEyebrow(at(27), today)).toBe('Hoy es lunes 28 · ayer')
    expect(dayEyebrow(at(18), today)).toBe('Hoy es lunes 28 · hace 10 días')
    expect(dayEyebrow(new Date(2026, 9, 1), today)).toBe('Hoy es lunes 28 sep · dentro de 3 días')
    expect(dayEyebrow(new Date(2026, 10, 15), today)).toBe('Hoy es lunes 28 sep')
  })

  it('el vacío', () => {
    expect(emptyDay(new Date(2026, 9, 3), today).title).toBe('Nada para el sábado 3 oct.')
    expect(emptyDay(at(25), today)).toEqual({
      title: 'Nada del viernes 25.',
      body: 'Ese día no tenía nada con fecha ni marcaste nada.',
    })
  })
})
