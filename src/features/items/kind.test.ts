import { describe, expect, it } from 'vitest'

import {
  changeKindPatch,
  isChoosableKind,
  kindChangeLoss,
  kindChangedMessage,
  kindChangeNotice,
  kindMark,
  kindProposal,
  parseKindPrefix,
  proposalHint,
  proposedKind,
  revertKindChange,
} from './kind'
import { ITEM_KINDS } from './status'

const tarea = {
  status: 'in_progress' as const,
  priority: 'high' as const,
  dueAt: new Date(2026, 9, 3),
  recurrence: null,
  priceCents: null,
}

const sinNada = {
  status: 'pending' as const,
  priority: null,
  dueAt: null,
  recurrence: null,
  priceCents: null,
}

describe('changeKindPatch', () => {
  it('una tarea en curso que pasa a compra queda pendiente, sin prioridad ni fecha', () => {
    expect(changeKindPatch(tarea, 'shopping')).toEqual({
      kind: 'shopping',
      status: 'pending',
      priority: null,
      dueAt: null,
    })
  })

  it('una tarea con fecha pasa a ser un evento ese mismo día (la fecha no se toca)', () => {
    const patch = changeKindPatch({ ...tarea, status: 'pending' }, 'event')
    expect(patch).toEqual({ kind: 'event', status: 'upcoming', priority: null })
    expect(patch).not.toHaveProperty('dueAt')
  })

  it('una compra comprada pasa a ser una tarea hecha', () => {
    expect(changeKindPatch({ ...sinNada, status: 'bought' }, 'task')).toEqual({
      kind: 'task',
      status: 'done',
    })
  })

  it('un evento con repetición que pasa a tarea conserva la fecha y, desde la 3.6, la repetición', () => {
    const evento = {
      status: 'upcoming' as const,
      priority: null,
      dueAt: new Date(2026, 9, 3, 19, 30),
      recurrence: 'yearly',
      priceCents: null,
    }
    // Su día pasa a ser la fecha límite, sin la hora.
    expect(changeKindPatch(evento, 'task')).toEqual({
      kind: 'task',
      status: 'pending',
      dueAt: new Date(2026, 9, 3),
    })
  })

  it('un evento cancelado que pasa a compra queda comprado (el primer final)', () => {
    expect(changeKindPatch({ ...sinNada, status: 'cancelled' }, 'shopping')).toMatchObject({
      status: 'bought',
    })
  })

  it('una compra con precio que pasa a tarea pierde el precio (solo las compras lo tienen)', () => {
    expect(changeKindPatch({ ...sinNada, priceCents: 27900 }, 'task')).toEqual({
      kind: 'task',
      status: 'pending',
      priceCents: null,
      priceSource: null,
    })
  })
})

describe('deshacer el cambio de tipo (diseño 25, B6b)', () => {
  it('vuelven el tipo, el estado y lo que se quitó', () => {
    const before = {
      ...tarea,
      kind: 'task' as const,
      allDay: true,
      priceSource: null,
    }
    const patch = changeKindPatch(before, 'note')
    expect(revertKindChange(before, patch)).toEqual({
      kind: 'task',
      status: 'in_progress',
      priority: 'high',
      dueAt: tarea.dueAt,
      allDay: true,
    })
    expect(kindChangedMessage('task')).toBe('Ahora es una tarea')
    expect(kindChangedMessage('event')).toBe('Ahora es un evento')
    expect(kindChangedMessage('note')).toBe('Ahora es una nota')
  })
})

describe('lo que se pierde', () => {
  it('solo cuenta lo que el ítem tiene', () => {
    expect(kindChangeLoss(sinNada, 'shopping')).toEqual({
      priority: false,
      dueAt: false,
      recurrence: false,
      price: false,
    })
    expect(kindChangeLoss({ ...sinNada, priority: 'low' }, 'event')).toEqual({
      priority: true,
      dueAt: false,
      recurrence: false,
      price: false,
    })
  })
})

describe('aviso antes de cambiar (diseño 25, B6 y B6c; antes, 12, T5)', () => {
  const now = new Date(2026, 9, 12, 9)
  const as = <T extends object>(kind: 'task' | 'shopping' | 'event' | 'note', item: T) => ({
    ...item,
    kind,
    title: 'Arreglar el grifo',
    notes: null,
  })

  it.each([
    [
      as('task', { ...sinNada, priority: 'medium' as const }),
      'shopping',
      'Se quita la prioridad Media. Pendiente sigue siendo Pendiente.',
      true,
    ],
    [
      as('task', tarea),
      'shopping',
      'Se quitan la prioridad Alta y la fecha (3 oct). En curso pasa a Pendiente.',
      true,
    ],
    [as('task', sinNada), 'event', 'No se pierde nada. Pendiente pasa a Próximo.', false],
    [
      as('shopping', { ...sinNada, status: 'bought' as const }),
      'task',
      'No se pierde nada. Comprado pasa a Hecha.',
      false,
    ],
    [
      as('shopping', { ...sinNada, priceCents: 9900 }),
      'event',
      'Se quita el precio. Pendiente pasa a Próximo.',
      true,
    ],
  ] as const)('%j a %s: «%s»', (item, to, text, losesSomething) => {
    expect(kindChangeNotice(item, to, { now })).toMatchObject({ text, losesSomething })
  })

  it('con tres cosas, en lista', () => {
    const todo = as('event', {
      status: 'upcoming' as const,
      priority: 'high' as const,
      dueAt: now,
      recurrence: 'weekly',
      priceCents: null,
    })
    expect(kindChangeNotice(todo, 'shopping', { now }).text).toBe(
      'Se quitan la prioridad Alta, la fecha (hoy) y la repetición. Próximo pasa a Pendiente.',
    )
  })

  it('de nota a tarea, la primera línea es el título y no se pierde nada (B6)', () => {
    const nota = { ...sinNada, kind: 'note' as const, title: 'Vuelo a Lisboa', notes: 'K7Q2MX' }
    expect(kindChangeNotice(nota, 'task')).toEqual({
      lead: '«Vuelo a Lisboa» será el título y el resto, sus notas.',
      lost: null,
      rest: 'No se pierde nada: gana casilla y contará como pendiente.',
      text: '«Vuelo a Lisboa» será el título y el resto, sus notas. No se pierde nada: gana casilla y contará como pendiente.',
      losesSomething: false,
    })
    expect(kindChangeNotice({ ...nota, notes: null }, 'event').text).toBe(
      '«Vuelo a Lisboa» será el título. No se pierde nada: gana día y hora y contará como próximo.',
    )
  })

  it('de tarea a nota, lo que se pierde va aparte, con el aviso (B6c)', () => {
    const grifo = { ...as('task', tarea), status: 'pending' as const, dueAt: now }
    expect(kindChangeNotice(grifo, 'note', { now, reminder: true })).toMatchObject({
      lead: 'El título será la primera línea y sus notas, el resto.',
      lost: 'Se quitan la prioridad Alta, la fecha (hoy) y el aviso.',
      rest: 'Dejará de contar como pendiente.',
      losesSomething: true,
    })
    expect(kindChangeNotice({ ...grifo, status: 'done' }, 'note', { now }).rest).toBe(
      'Las notas no tienen estado: sale de «Fuera de la cabeza».',
    )
  })
})

it('se eligen nota, tarea, compra y evento (la nota, desde la 5.4)', () => {
  expect(ITEM_KINDS.filter(isChoosableKind)).toEqual(['note', 'task', 'shopping', 'event'])
})

describe('marca del tipo y prefijos', () => {
  it('la marca sale solo si el ítem no es del tipo que propone su lista', () => {
    expect(kindMark('shopping', 'task')).toBe('Compra')
    expect(kindMark('task', 'shopping')).toBe('Tarea')
    expect(kindMark('shopping', 'shopping')).toBeNull()
    expect(kindMark('task', 'task')).toBeNull()
    expect(kindMark('note', 'note')).toBeNull()
    expect(kindMark('note', 'task')).toBeNull()
  })

  it.each([
    ['[ ] Llamar al fontanero', { kind: 'task', title: 'Llamar al fontanero' }],
    ['> Cable HDMI', { kind: 'shopping', title: 'Cable HDMI' }],
    ['@ Dentista', { kind: 'event', title: 'Dentista' }],
    ['  @ Dentista', { kind: 'event', title: 'Dentista' }],
    ['/ Lisboa', { kind: 'sublist', title: 'Lisboa' }],
    ['>sin espacio', null],
    ['Revisar @ Lucía', null],
    ['Tarea normal', null],
  ] as const)('«%s» → %j', (text, expected) => {
    expect(parseKindPrefix(text)).toEqual(expected)
  })
})

describe('el tipo que propone una lista sin tipo (5.3, ADR-012)', () => {
  const totals = (kinds: Partial<Record<'note' | 'task' | 'shopping' | 'event', number>>) => ({
    note: 0,
    task: 0,
    shopping: 0,
    event: 0,
    ...kinds,
  })
  const list = (kind: 'inbox' | 'list', kinds = totals({}), view: 'list' | 'agenda' = 'list') => ({
    kind,
    view,
    counters: {
      pending: 0,
      done: 0,
      notes: 0,
      pendingPriceCents: 0,
      kinds,
    },
  })

  it('«En mente» propone siempre nota', () => {
    expect(proposedKind(list('inbox', totals({ shopping: 9 })))).toBe('note')
  })

  it('una lista propone el tipo que más hay, por sus contadores', () => {
    expect(proposedKind(list('list', totals({ shopping: 5, task: 2 })))).toBe('shopping')
    expect(proposedKind(list('list', totals({ event: 3, task: 1 })))).toBe('event')
  })

  it('con los ítems a mano, cuentan esos (las sublistas no); a igualdad, tarea y luego compra', () => {
    const items = [
      { kind: 'shopping' },
      { kind: 'event' },
      { kind: 'sublist' },
      { kind: 'sublist' },
    ] as const
    expect(proposedKind(list('list', totals({ task: 9 })), items)).toBe('shopping')
    expect(proposedKind(list('list'), [{ kind: 'task' }, { kind: 'shopping' }])).toBe('task')
  })

  it('vacía, o con solo notas, Nota (5.4, diseño 25, B5); una agenda, evento', () => {
    expect(proposedKind(list('list'))).toBe('note')
    expect(proposedKind(list('list'), [{ kind: 'note' }, { kind: 'note' }])).toBe('note')
    expect(proposedKind(list('list', totals({}), 'agenda'), [])).toBe('event')
    expect(proposedKind(list('list', totals({ task: 2 }), 'agenda'))).toBe('task')
  })

  it('las notas no compiten: tres notas y dos tareas proponen tarea (D1)', () => {
    expect(proposedKind(list('list', totals({ note: 3, task: 2, shopping: 1 })))).toBe('task')
  })

  it('el porqué, al pie del selector (B5c, D3)', () => {
    expect(proposalHint(kindProposal(list('list', totals({ shopping: 5, note: 1 }))))).toBe(
      'Esta lista propone Compra porque es lo que más tiene.',
    )
    expect(proposalHint(kindProposal(list('list')))).toBe('Una lista vacía propone Nota.')
    expect(proposalHint(kindProposal(list('list', totals({}), 'agenda')))).toBe(
      'Una agenda vacía propone Evento.',
    )
    expect(proposalHint(kindProposal(list('inbox')))).toBe('En «En mente» todo empieza como nota.')
  })
})
