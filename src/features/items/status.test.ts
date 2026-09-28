import { describe, expect, it } from 'vitest'

import type { ListKind } from '@/features/lists'

import {
  checkboxState,
  initialStatus,
  isFinalStatus,
  isOutOfMind,
  isValidStatus,
  nextStatusOnToggle,
  STATUSES_BY_KIND,
  type ItemStatus,
} from './status'

describe('estados por tipo', () => {
  it.each([
    ['inbox', ['pending', 'done']],
    ['tasks', ['pending', 'in_progress', 'done']],
    ['shopping', ['pending', 'bought', 'discarded']],
    ['events', ['upcoming', 'cancelled']],
    ['custom', ['pending', 'done']],
  ] as const)('%s admite %j (los del trigger items_validate)', (kind, statuses) => {
    expect(STATUSES_BY_KIND[kind]).toEqual(statuses)
  })

  it('cada tipo nace en su primer estado', () => {
    expect(initialStatus('tasks')).toBe('pending')
    expect(initialStatus('inbox')).toBe('pending')
    expect(initialStatus('events')).toBe('upcoming')
  })

  it('rechaza estados de otro tipo', () => {
    expect(isValidStatus('tasks', 'in_progress')).toBe(true)
    expect(isValidStatus('inbox', 'in_progress')).toBe(false)
    expect(isValidStatus('shopping', 'done')).toBe(false)
    expect(isValidStatus('events', 'pending')).toBe(false)
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

describe('tocar el checkbox', () => {
  it.each<[ListKind, ItemStatus, ItemStatus]>([
    ['tasks', 'pending', 'done'],
    ['tasks', 'in_progress', 'done'],
    ['tasks', 'done', 'pending'],
    ['inbox', 'pending', 'done'],
    ['inbox', 'done', 'pending'],
    ['custom', 'pending', 'done'],
    ['shopping', 'pending', 'bought'],
    ['shopping', 'bought', 'pending'],
    ['shopping', 'discarded', 'pending'],
    ['events', 'upcoming', 'cancelled'],
    ['events', 'cancelled', 'upcoming'],
  ])('en %s, %s → %s', (kind, from, to) => {
    expect(nextStatusOnToggle(kind, from)).toBe(to)
  })

  it('el resultado siempre es un estado válido del tipo', () => {
    for (const [kind, statuses] of Object.entries(STATUSES_BY_KIND) as [
      ListKind,
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
    expect(isOutOfMind({ status: 'done', dueAt: null, recurrence: null }, 'tasks', now)).toBe(true)
    expect(isOutOfMind({ status: 'pending', dueAt: null, recurrence: null }, 'tasks', now)).toBe(
      false,
    )
  })

  it('una tarea atrasada sigue pendiente', () => {
    expect(
      isOutOfMind({ status: 'pending', dueAt: yesterday, recurrence: null }, 'tasks', now),
    ).toBe(false)
  })

  it('un evento pasado sin repetición cuenta como fuera; con repetición, no', () => {
    expect(
      isOutOfMind({ status: 'upcoming', dueAt: yesterday, recurrence: null }, 'events', now),
    ).toBe(true)
    expect(
      isOutOfMind({ status: 'upcoming', dueAt: yesterday, recurrence: 'yearly' }, 'events', now),
    ).toBe(false)
    expect(
      isOutOfMind({ status: 'upcoming', dueAt: tomorrow, recurrence: null }, 'events', now),
    ).toBe(false)
  })
})
