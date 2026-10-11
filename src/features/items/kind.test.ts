import { describe, expect, it } from 'vitest'

import {
  changeKindPatch,
  isChoosableKind,
  kindChangeLoss,
  kindChangeNotice,
  kindMark,
  parseKindPrefix,
  proposedKind,
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

describe('aviso antes de cambiar (diseño 12, T5)', () => {
  it.each([
    [
      { ...sinNada, priority: 'medium' as const },
      'shopping',
      'Al pasar a Compra se quita la prioridad. Pendiente sigue siendo Pendiente.',
      true,
    ],
    [
      tarea,
      'shopping',
      'Al pasar a Compra se quitan la prioridad y la fecha. En curso pasa a Pendiente.',
      true,
    ],
    [sinNada, 'event', 'Al pasar a Evento no se pierde nada. Pendiente pasa a Próximo.', false],
    [
      { ...sinNada, status: 'bought' as const },
      'task',
      'Al pasar a Tarea no se pierde nada. Comprado pasa a Hecha.',
      false,
    ],
    [
      { ...sinNada, priceCents: 9900 },
      'event',
      'Al pasar a Evento se quita el precio. Pendiente pasa a Próximo.',
      true,
    ],
  ] as const)('%j a %s: «%s»', (item, to, text, losesSomething) => {
    expect(kindChangeNotice(item, to)).toEqual({ text, losesSomething })
  })

  it('con tres cosas, en lista', () => {
    const todo = {
      status: 'upcoming' as const,
      priority: 'high' as const,
      dueAt: new Date(),
      recurrence: 'weekly',
      priceCents: null,
    }
    expect(kindChangeNotice(todo, 'shopping').text).toBe(
      'Al pasar a Compra se quitan la prioridad, la fecha y la repetición. Próximo pasa a Pendiente.',
    )
  })
})

it('solo se eligen tarea, compra y evento', () => {
  expect(ITEM_KINDS.filter(isChoosableKind)).toEqual(['task', 'shopping', 'event'])
})

describe('marca del tipo y prefijos', () => {
  it('la marca sale solo si el ítem no es del tipo que propone su lista', () => {
    expect(kindMark('shopping', 'task')).toBe('Compra')
    expect(kindMark('task', 'shopping')).toBe('Tarea')
    expect(kindMark('shopping', 'shopping')).toBeNull()
    expect(kindMark('task', 'task')).toBeNull()
    expect(kindMark('note', 'note')).toBeNull()
  })

  it.each([
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

  it('vacía, o con solo notas, tarea (la nota llega a la barra en la 5.4); una agenda, evento', () => {
    expect(proposedKind(list('list'))).toBe('task')
    expect(proposedKind(list('list'), [{ kind: 'note' }, { kind: 'note' }])).toBe('task')
    expect(proposedKind(list('list', totals({}), 'agenda'), [])).toBe('event')
    expect(proposedKind(list('list', totals({ task: 2 }), 'agenda'))).toBe('task')
  })
})
