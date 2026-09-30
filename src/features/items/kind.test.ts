import { describe, expect, it } from 'vitest'

import {
  changeKindPatch,
  isChoosableKind,
  kindChangeLoss,
  kindChangeNotice,
  kindMark,
  parseKindPrefix,
} from './kind'
import { ITEM_KINDS } from './status'

const tarea = {
  status: 'in_progress' as const,
  priority: 'high' as const,
  dueAt: new Date(2026, 9, 3),
  recurrence: null,
}

const sinNada = { status: 'pending' as const, priority: null, dueAt: null, recurrence: null }

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

  it('un evento con repetición que pasa a tarea conserva la fecha y pierde la repetición', () => {
    const evento = {
      status: 'upcoming' as const,
      priority: null,
      dueAt: tarea.dueAt,
      recurrence: 'yearly',
    }
    expect(changeKindPatch(evento, 'task')).toEqual({
      kind: 'task',
      status: 'pending',
      recurrence: null,
    })
  })

  it('un evento cancelado que pasa a compra queda comprado (el primer final)', () => {
    expect(changeKindPatch({ ...sinNada, status: 'cancelled' }, 'shopping')).toMatchObject({
      status: 'bought',
    })
  })
})

describe('lo que se pierde', () => {
  it('solo cuenta lo que el ítem tiene', () => {
    expect(kindChangeLoss(sinNada, 'shopping')).toEqual({
      priority: false,
      dueAt: false,
      recurrence: false,
    })
    expect(kindChangeLoss({ ...sinNada, priority: 'low' }, 'event')).toEqual({
      priority: true,
      dueAt: false,
      recurrence: false,
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
  ] as const)('%j a %s: «%s»', (item, to, text, losesSomething) => {
    expect(kindChangeNotice(item, to)).toEqual({ text, losesSomething })
  })

  it('con tres cosas, en lista', () => {
    const todo = {
      status: 'upcoming' as const,
      priority: 'high' as const,
      dueAt: new Date(),
      recurrence: 'weekly',
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
  it('la marca sale solo si el ítem no es del tipo por defecto de su lista', () => {
    expect(kindMark('shopping', 'tasks')).toBe('Compra')
    expect(kindMark('task', 'shopping')).toBe('Tarea')
    expect(kindMark('shopping', 'shopping')).toBeNull()
    expect(kindMark('task', 'tasks')).toBeNull()
    expect(kindMark('note', 'inbox')).toBeNull()
  })

  it.each([
    ['> Cable HDMI', { kind: 'shopping', title: 'Cable HDMI' }],
    ['@ Dentista', { kind: 'event', title: 'Dentista' }],
    ['  @ Dentista', { kind: 'event', title: 'Dentista' }],
    ['>sin espacio', null],
    ['Revisar @ Lucía', null],
    ['Tarea normal', null],
  ] as const)('«%s» → %j', (text, expected) => {
    expect(parseKindPrefix(text)).toEqual(expected)
  })
})
