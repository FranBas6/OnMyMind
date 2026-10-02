import { describe, expect, it } from 'vitest'

import { chartData, firstPrice, savedCents } from './history'
import type { PriceRecord } from './types'

const NOW = new Date(2026, 8, 14, 12)
const record = (cents: number, date: Date, extra: Partial<PriceRecord> = {}): PriceRecord => ({
  cents,
  currency: 'EUR',
  source: 'web',
  recordedAt: date,
  store: null,
  ...extra,
})

// El de los auriculares del diseño (B1): bajó de 302 a 279 con cambios entre medias.
const auriculares = [
  record(31500, new Date(2026, 1, 10)),
  record(30200, new Date(2026, 3, 2)),
  record(29500, new Date(2026, 5, 21), { source: 'manual' }),
  record(27900, new Date(2026, 6, 30)),
]
const current = {
  cents: 27900,
  currency: 'EUR',
  source: 'web' as const,
  checkedAt: new Date(2026, 6, 30),
}

describe('chartData', () => {
  it('un punto por cambio en seis meses, el que regía al empezar sin punto y la línea hasta hoy', () => {
    const { points, domain } = chartData(auriculares, current, NOW)
    expect(domain).toEqual([new Date(2026, 2, 14, 12).getTime(), NOW.getTime()])
    expect(points.map((point) => [point.cents, point.change])).toEqual([
      [31500, false], // el de febrero, que regía el 14 de marzo
      [30200, true],
      [29500, true],
      [27900, true],
      [27900, false], // hasta hoy
    ])
    expect(points[0]?.at).toBe(domain[0])
    expect(points.at(-1)?.at).toBe(domain[1])
    expect(points[2]?.source).toBe('manual')
  })

  it('las marcas son el día 1 de los seis meses, como en el diseño', () => {
    expect(chartData(auriculares, current, NOW).ticks.map((tick) => tick.label)).toEqual([
      'abr',
      'may',
      'jun',
      'jul',
      'ago',
      'sep',
    ])
  })

  it('si el precio de ahora aún no está en el histórico (sin red), se añade', () => {
    const { points } = chartData(
      auriculares,
      { ...current, cents: 25900, checkedAt: new Date(2026, 8, 14, 11) },
      NOW,
    )
    expect(points.filter((point) => point.change).map((point) => point.cents)).toEqual([
      30200, 29500, 27900, 25900,
    ])
  })

  it('solo cuenta la moneda de ahora', () => {
    const { points } = chartData(
      [record(5000, new Date(2026, 4, 1), { currency: 'USD' }), ...auriculares.slice(2)],
      current,
      NOW,
    )
    expect(points.some((point) => point.cents === 5000)).toBe(false)
  })
})

describe('primer precio y ahorro', () => {
  it('el primero de la moneda; lo ahorrado, solo si bajó', () => {
    expect(firstPrice(auriculares, 'EUR')).toBe(31500)
    expect(firstPrice([], 'EUR')).toBeNull()
    expect(savedCents(30200, 25900)).toBe(4300)
    expect(savedCents(9600, 9900)).toBe(0)
    expect(savedCents(null, 9900)).toBe(0)
  })
})
