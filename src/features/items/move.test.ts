import { describe, expect, it } from 'vitest'

import { buildMovePatch, moveLoss, moveLossLabel, translateStatus } from './move'

const tarea = {
  status: 'in_progress' as const,
  priority: 'high' as const,
  dueAt: new Date(2026, 8, 25),
  allDay: true,
  recurrence: null,
}

describe('translateStatus', () => {
  it.each([
    ['in_progress', 'inbox', 'pending'],
    ['in_progress', 'tasks', 'in_progress'],
    ['done', 'shopping', 'bought'],
    ['done', 'events', 'cancelled'],
    ['pending', 'events', 'upcoming'],
    ['bought', 'tasks', 'done'],
    ['discarded', 'inbox', 'done'],
    ['cancelled', 'shopping', 'bought'],
    ['upcoming', 'tasks', 'pending'],
  ] as const)('%s → %s queda %s', (status, to, expected) => {
    expect(translateStatus(status, to)).toBe(expected)
  })
})

describe('buildMovePatch', () => {
  it('una tarea en curso que va a «En mente» queda pendiente, sin prioridad ni fecha', () => {
    expect(buildMovePatch(tarea, { id: 'i', kind: 'inbox' })).toEqual({
      listId: 'i',
      status: 'pending',
      priority: null,
      dueAt: null,
      allDay: false,
      recurrence: null,
    })
  })

  it('una tarea hecha que va a Compras queda comprada y pierde prioridad y fecha', () => {
    const patch = buildMovePatch({ ...tarea, status: 'done' }, { id: 'c', kind: 'shopping' })
    expect(patch).toMatchObject({ status: 'bought', priority: null, dueAt: null })
  })

  it('a Eventos se conserva la fecha, como fecha del evento', () => {
    const patch = buildMovePatch(tarea, { id: 'a', kind: 'events' })
    expect(patch).toMatchObject({ status: 'upcoming', priority: null, allDay: true })
    expect(patch.dueAt).toEqual(tarea.dueAt)
  })

  it('entre listas de tareas no se pierde nada', () => {
    expect(buildMovePatch(tarea, { id: 't', kind: 'tasks' })).toEqual({ ...tarea, listId: 't' })
  })

  it('la repetición solo sigue en Eventos', () => {
    const evento = { ...tarea, status: 'upcoming' as const, priority: null, recurrence: 'yearly' }
    expect(buildMovePatch(evento, { id: 'a', kind: 'events' }).recurrence).toBe('yearly')
    expect(buildMovePatch(evento, { id: 't', kind: 'tasks' }).recurrence).toBeNull()
  })
})

describe('aviso de lo que se pierde', () => {
  it.each([
    ['inbox', 'Se quitan la prioridad y la fecha.'],
    ['shopping', 'Se quitan la prioridad y la fecha.'],
    ['events', 'Se quita la prioridad.'],
    ['tasks', null],
  ] as const)('a %s → %s', (to, expected) => {
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
