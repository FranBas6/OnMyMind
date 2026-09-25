import { describe, expect, it } from 'vitest'

import { formatCaptureAge, formatHeaderDate } from './date'

describe('formatHeaderDate', () => {
  it('día de la semana con mayúscula, día y mes en español', () => {
    expect(formatHeaderDate(new Date(2026, 8, 22))).toBe('Martes, 22 de septiembre')
    expect(formatHeaderDate(new Date(2026, 0, 1))).toBe('Jueves, 1 de enero')
  })
})

describe('formatCaptureAge', () => {
  // Jueves, 25 de septiembre de 2026, a las 18:00
  const now = new Date(2026, 8, 25, 18, 0)

  it.each([
    [new Date(2026, 8, 25, 17, 59, 40), 'ahora'],
    [new Date(2026, 8, 25, 17, 55), 'hace 5 min'],
    [new Date(2026, 8, 25, 16, 0), 'hace 2 h'],
    [new Date(2026, 8, 25, 0, 30), 'hace 17 h'],
    [new Date(2026, 8, 24, 23, 50), 'ayer'],
    [new Date(2026, 8, 22, 10, 0), 'martes'],
    [new Date(2026, 8, 19, 10, 0), 'sábado'],
    [new Date(2026, 8, 18, 10, 0), '18 sep'],
    [new Date(2025, 11, 24, 10, 0), '24 dic 2025'],
  ])('%s → «%s»', (date, expected) => {
    expect(formatCaptureAge(date, now)).toBe(expected)
  })
})
