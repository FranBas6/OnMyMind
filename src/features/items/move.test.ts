import { describe, expect, it } from 'vitest'

import { buildMovePatch, translateStatus } from './move'

const tarea = {
  kind: 'task' as const,
  status: 'in_progress' as const,
  priority: 'high' as const,
  dueAt: new Date(2026, 8, 25),
  allDay: true,
  recurrence: null,
}

const nota = {
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
    // La nota no tiene estado final (5.3): lo terminado queda pendiente.
    ['discarded', 'note', 'pending'],
    ['done', 'note', 'pending'],
    ['cancelled', 'shopping', 'bought'],
    ['upcoming', 'task', 'pending'],
  ] as const)('%s → %s queda %s', (status, to, expected) => {
    expect(translateStatus(status, to)).toBe(expected)
  })
})

describe('buildMovePatch: mover nunca cambia el tipo (ADR-012)', () => {
  it('una tarea en curso que va a «En mente» sigue siendo tarea, con su prioridad y su fecha', () => {
    expect(buildMovePatch(tarea, { id: 'i', kind: 'inbox' })).toEqual({
      ...tarea,
      listId: 'i',
      parentId: null,
    })
  })

  it('una nota que sale de «En mente» sigue siendo nota', () => {
    expect(buildMovePatch(nota, { id: 'c', kind: 'list' })).toEqual({
      ...nota,
      listId: 'c',
      parentId: null,
    })
  })

  it('mover algo de dentro de una sublista a otra lista lo saca de ella (ADR-010)', () => {
    expect(buildMovePatch(tarea, { id: 'c', kind: 'list' }).parentId).toBeNull()
  })

  it('a una sublista va con su id; a «En mente», nunca dentro de nada', () => {
    expect(buildMovePatch(tarea, { id: 'v', kind: 'list' }, 'lisboa').parentId).toBe('lisboa')
    expect(buildMovePatch(tarea, { id: 'i', kind: 'inbox' }, 'lisboa').parentId).toBeNull()
  })

  it('un evento con repetición la conserva en cualquier lista, también en «En mente»', () => {
    const evento = { ...tarea, kind: 'event' as const, status: 'upcoming' as const, priority: null }
    const conRepeticion = { ...evento, recurrence: 'yearly' }
    expect(buildMovePatch(conRepeticion, { id: 't', kind: 'list' }).recurrence).toBe('yearly')
    expect(buildMovePatch(conRepeticion, { id: 'i', kind: 'inbox' }).recurrence).toBe('yearly')
  })
})
