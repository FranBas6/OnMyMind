import { describe, expect, it } from 'vitest'

import { formatHeaderDate } from './date'

describe('formatHeaderDate', () => {
  it('día de la semana con mayúscula, día y mes en español', () => {
    expect(formatHeaderDate(new Date(2026, 8, 22))).toBe('Martes, 22 de septiembre')
    expect(formatHeaderDate(new Date(2026, 0, 1))).toBe('Jueves, 1 de enero')
  })
})
