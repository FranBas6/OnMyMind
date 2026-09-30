import { describe, expect, it } from 'vitest'

import { buildMovePatch, kindAfterMove, moveLoss, moveLossLabel, translateStatus } from './move'

const tarea = {
  kind: 'task' as const,
  status: 'in_progress' as const,
  priority: 'high' as const,
  dueAt: new Date(2026, 8, 25),
  allDay: true,
  recurrence: null,
}

const captura = {
  kind: 'note' as const,
  status: 'pending' as const,
  priority: null,
  dueAt: null,
  allDay: false,
  recurrence: null,
}

describe('translateStatus (la misma regla que translate_item_status)', () => {
  it.each([
    ['in_progress', 'note', 'pending'],
    ['in_progress', 'task', 'in_progress'],
    ['done', 'shopping', 'bought'],
    ['done', 'event', 'cancelled'],
    ['pending', 'event', 'upcoming'],
    ['bought', 'task', 'done'],
    ['discarded', 'note', 'done'],
    ['cancelled', 'shopping', 'bought'],
    ['upcoming', 'task', 'pending'],
  ] as const)('%s → %s queda %s', (status, to, expected) => {
    expect(translateStatus(status, to)).toBe(expected)
  })
})

describe('kindAfterMove (la misma regla que items_adopt_kind)', () => {
  it('lo que sale de «En mente» toma el tipo por defecto del destino', () => {
    expect(kindAfterMove('note', 'shopping')).toBe('shopping')
    expect(kindAfterMove('note', 'events')).toBe('event')
    expect(kindAfterMove('note', 'tasks')).toBe('task')
  })

  it('entre listas normales el tipo no cambia', () => {
    expect(kindAfterMove('task', 'shopping')).toBe('task')
    expect(kindAfterMove('shopping', 'events')).toBe('shopping')
  })

  it('lo que entra en «En mente» vuelve a no tener tipo', () => {
    expect(kindAfterMove('task', 'inbox')).toBe('note')
    expect(kindAfterMove('note', 'inbox')).toBe('note')
  })
})

describe('buildMovePatch', () => {
  it('una tarea en curso que va a «En mente» queda como captura pendiente, sin prioridad ni fecha', () => {
    expect(buildMovePatch(tarea, { id: 'i', kind: 'inbox' })).toEqual({
      listId: 'i',
      kind: 'note',
      status: 'pending',
      priority: null,
      dueAt: null,
      allDay: false,
      recurrence: null,
    })
  })

  it('una tarea que va a Compras sigue siendo una tarea, con su estado, prioridad y fecha', () => {
    expect(buildMovePatch(tarea, { id: 'c', kind: 'shopping' })).toEqual({
      ...tarea,
      listId: 'c',
    })
  })

  it('«leche», de «En mente» a Compras, pasa a ser una compra pendiente', () => {
    expect(buildMovePatch(captura, { id: 'c', kind: 'shopping' })).toMatchObject({
      kind: 'shopping',
      status: 'pending',
    })
  })

  it('una captura hecha que va a Agenda queda como evento cancelado (el primer final)', () => {
    expect(
      buildMovePatch({ ...captura, status: 'done' }, { id: 'a', kind: 'events' }),
    ).toMatchObject({ kind: 'event', status: 'cancelled' })
  })

  it('un evento con repetición la conserva en cualquier lista, salvo en «En mente»', () => {
    const evento = { ...tarea, kind: 'event' as const, status: 'upcoming' as const, priority: null }
    const conRepeticion = { ...evento, recurrence: 'yearly' }
    expect(buildMovePatch(conRepeticion, { id: 't', kind: 'tasks' }).recurrence).toBe('yearly')
    expect(buildMovePatch(conRepeticion, { id: 'i', kind: 'inbox' }).recurrence).toBeNull()
  })
})

describe('aviso de lo que se pierde', () => {
  it.each([
    ['inbox', 'Se quitan la prioridad y la fecha.'],
    ['shopping', null],
    ['events', null],
    ['tasks', null],
  ] as const)('una tarea con prioridad y fecha a %s → %s', (to, expected) => {
    expect(moveLossLabel(moveLoss(tarea, to))).toBe(expected)
  })

  it('solo la fecha', () => {
    expect(moveLossLabel(moveLoss({ priority: null, dueAt: new Date() }, 'inbox'))).toBe(
      'Se quita la fecha.',
    )
  })

  it('una captura sin campos no pierde nada', () => {
    expect(moveLossLabel(moveLoss({ priority: null, dueAt: null }, 'shopping'))).toBeNull()
  })
})
