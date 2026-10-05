import { describe, expect, it } from 'vitest'

import type { Item } from '@/features/items'

import { reminderFor } from './useReminders'

const now = new Date(2026, 9, 5, 12, 0)
const dentista = {
  id: '00000000-0000-4000-8000-000000000001',
  kind: 'event',
  dueAt: new Date(2026, 9, 8, 10),
  allDay: false,
  recurrence: null,
} as Item

describe('reminderFor', () => {
  it('uno relativo calcula su hora; uno personalizado la lleva tal cual', () => {
    expect(reminderFor(dentista, { offsetMinutes: 60 }, undefined, now)).toMatchObject({
      itemId: dentista.id,
      remindAt: new Date(2026, 9, 8, 9),
      offsetMinutes: 60,
      sentAt: null,
    })
    const custom = new Date(2026, 9, 7, 20)
    expect(reminderFor(dentista, { remindAt: custom }, undefined, now)).toMatchObject({
      remindAt: custom,
      offsetMinutes: null,
    })
  })

  it('cambiar el aviso conserva su id; uno relativo sin fecha no se puede', () => {
    const current = reminderFor(dentista, { offsetMinutes: 60 }, undefined, now)
    if (!current) throw new Error('sin aviso')
    expect(reminderFor(dentista, { offsetMinutes: 10 }, current, now)?.id).toBe(current.id)
    expect(reminderFor({ ...dentista, dueAt: null }, { offsetMinutes: 60 }, undefined, now)).toBe(
      null,
    )
  })
})
