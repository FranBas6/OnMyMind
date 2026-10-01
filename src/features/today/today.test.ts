import { describe, expect, it } from 'vitest'

import type { Item } from '@/features/items'
import type { List } from '@/features/lists'

import {
  dayKey,
  doneTodayLabel,
  groupToday,
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
    position: 1000,
    counters: { pending: 0, done: 0, pendingPriceCents: 0 },
    archivedAt: null,
    ...overrides,
  }
}

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
