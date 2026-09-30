import { describe, expect, it } from 'vitest'

import {
  checkboxState,
  defaultItemKind,
  initialStatus,
  isActiveSublistStatus,
  isFinalStatus,
  isOutOfMind,
  isValidStatus,
  newItemKindAndStatus,
  nextStatusOnToggle,
  STATUSES_BY_KIND,
  type ItemKind,
  type ItemStatus,
} from './status'

describe('estados por tipo', () => {
  it.each([
    ['note', ['pending', 'done']],
    ['task', ['pending', 'in_progress', 'done']],
    ['shopping', ['pending', 'bought', 'discarded']],
    ['event', ['upcoming', 'cancelled']],
    ['sublist', ['pending', 'in_progress', 'paused', 'done']],
  ] as const)('%s admite %j (los de la función item_statuses)', (kind, statuses) => {
    expect(STATUSES_BY_KIND[kind]).toEqual(statuses)
  })

  it.each([
    ['inbox', 'note'],
    ['tasks', 'task'],
    ['shopping', 'shopping'],
    ['events', 'event'],
    ['custom', 'task'],
  ] as const)('una lista %s crea ítems de tipo %s (default_item_kind)', (listKind, itemKind) => {
    expect(defaultItemKind(listKind)).toBe(itemKind)
  })

  it('lo nuevo nace con el tipo por defecto de la lista y su primer estado', () => {
    expect(newItemKindAndStatus('events')).toEqual({ kind: 'event', status: 'upcoming' })
    expect(newItemKindAndStatus('inbox')).toEqual({ kind: 'note', status: 'pending' })
  })

  it('cada tipo nace en su primer estado', () => {
    expect(initialStatus('task')).toBe('pending')
    expect(initialStatus('note')).toBe('pending')
    expect(initialStatus('event')).toBe('upcoming')
  })

  it('rechaza estados de otro tipo', () => {
    expect(isValidStatus('task', 'in_progress')).toBe(true)
    expect(isValidStatus('note', 'in_progress')).toBe(false)
    expect(isValidStatus('shopping', 'done')).toBe(false)
    expect(isValidStatus('event', 'pending')).toBe(false)
  })

  it.each([
    ['done', true],
    ['bought', true],
    ['discarded', true],
    ['cancelled', true],
    ['pending', false],
    ['in_progress', false],
    ['upcoming', false],
  ] as const)('%s es final: %s', (status, final) => {
    expect(isFinalStatus(status)).toBe(final)
  })
})

describe('sublistas', () => {
  it('pausada no es terminada: no baja a «Fuera de la cabeza»', () => {
    expect(isFinalStatus('paused')).toBe(false)
  })

  it('lo de dentro solo cuenta con la sublista pendiente o en curso', () => {
    expect(isActiveSublistStatus('pending')).toBe(true)
    expect(isActiveSublistStatus('in_progress')).toBe(true)
    expect(isActiveSublistStatus('paused')).toBe(false)
    expect(isActiveSublistStatus('done')).toBe(false)
  })
})

describe('tocar el checkbox', () => {
  it.each<[ItemKind, ItemStatus, ItemStatus]>([
    ['task', 'pending', 'done'],
    ['task', 'in_progress', 'done'],
    ['task', 'done', 'pending'],
    ['note', 'pending', 'done'],
    ['note', 'done', 'pending'],
    ['shopping', 'pending', 'bought'],
    ['shopping', 'bought', 'pending'],
    ['shopping', 'discarded', 'pending'],
    ['event', 'upcoming', 'cancelled'],
    ['event', 'cancelled', 'upcoming'],
  ])('en %s, %s → %s', (kind, from, to) => {
    expect(nextStatusOnToggle(kind, from)).toBe(to)
  })

  it('el resultado siempre es un estado válido del tipo', () => {
    for (const [kind, statuses] of Object.entries(STATUSES_BY_KIND) as [
      ItemKind,
      readonly ItemStatus[],
    ][]) {
      for (const status of statuses) {
        expect(isValidStatus(kind, nextStatusOnToggle(kind, status))).toBe(true)
      }
    }
  })

  it('el checkbox está vacío, a medias o lleno', () => {
    expect(checkboxState('pending')).toBe('empty')
    expect(checkboxState('upcoming')).toBe('empty')
    expect(checkboxState('in_progress')).toBe('half')
    expect(checkboxState('done')).toBe('full')
    expect(checkboxState('bought')).toBe('full')
    expect(checkboxState('discarded')).toBe('crossed')
    expect(checkboxState('cancelled')).toBe('crossed')
  })
})

describe('isOutOfMind', () => {
  const now = new Date('2026-09-27T12:00:00')
  const yesterday = new Date('2026-09-26T12:00:00')
  const tomorrow = new Date('2026-09-28T12:00:00')

  it('los estados finales van a «Fuera de la cabeza»', () => {
    expect(isOutOfMind({ kind: 'task', status: 'done', dueAt: null, recurrence: null }, now)).toBe(
      true,
    )
    expect(
      isOutOfMind({ kind: 'task', status: 'pending', dueAt: null, recurrence: null }, now),
    ).toBe(false)
  })

  it('una tarea atrasada sigue pendiente', () => {
    expect(
      isOutOfMind({ kind: 'task', status: 'pending', dueAt: yesterday, recurrence: null }, now),
    ).toBe(false)
  })

  it('un evento pasado sin repetición cuenta como fuera; con repetición, no', () => {
    expect(
      isOutOfMind({ kind: 'event', status: 'upcoming', dueAt: yesterday, recurrence: null }, now),
    ).toBe(true)
    expect(
      isOutOfMind(
        { kind: 'event', status: 'upcoming', dueAt: yesterday, recurrence: 'yearly' },
        now,
      ),
    ).toBe(false)
    expect(
      isOutOfMind({ kind: 'event', status: 'upcoming', dueAt: tomorrow, recurrence: null }, now),
    ).toBe(false)
  })
})
