import { describe, expect, it } from 'vitest'

import { hasPrices, othersLabel, pendingTotals, priceLine } from './prices'
import type { Item } from './types'

const NOW = new Date(2026, 9, 1, 12)

function compra(overrides: Partial<Item> = {}): Item {
  return {
    id: crypto.randomUUID(),
    listId: 'l',
    kind: 'shopping',
    parentId: null,
    title: 'Algo',
    notes: null,
    status: 'pending',
    priority: null,
    dueAt: null,
    allDay: false,
    recurrence: null,
    position: 1000,
    completedAt: null,
    createdAt: NOW,
    leftInboxId: null,
    leftInboxAt: null,
    url: null,
    urlTitle: null,
    imageUrl: null,
    imagePath: null,
    urlSite: null,
    priceCents: 1000,
    currency: 'EUR',
    priceSource: 'manual',
    previousPriceCents: null,
    priceCheckedAt: null,
    ...overrides,
  }
}

describe('pendingTotals', () => {
  it('suma lo pendiente en euros; otras monedas aparte, por moneda', () => {
    const totals = pendingTotals(
      [
        compra({ priceCents: 1299 }),
        compra({ priceCents: 4900, currency: 'USD' }),
        compra({ priceCents: 100, currency: 'USD' }),
        compra({ status: 'bought', priceCents: 5000 }),
        compra({ priceCents: null }),
        compra({ kind: 'task', status: 'pending', priceCents: 700 }),
      ],
      NOW,
    )
    expect(totals).toEqual({ euros: 1299, others: [{ currency: 'USD', cents: 5000 }] })
    expect(othersLabel(totals.others)).toBe('y 50 US$ aparte')
    expect(othersLabel([])).toBeNull()
  })

  it('lo de dentro de una sublista pausada se calla, como en los contadores', () => {
    const roma = compra({ kind: 'sublist', status: 'paused', priceCents: null })
    const lisboa = compra({ kind: 'sublist', status: 'in_progress', priceCents: null })
    const totals = pendingTotals(
      [roma, lisboa, compra({ parentId: roma.id }), compra({ parentId: lisboa.id })],
      NOW,
    )
    expect(totals.euros).toBe(1000)
  })
})

it('hasPrices: solo si alguna compra tiene precio', () => {
  expect(
    hasPrices([compra({ priceCents: null }), compra({ kind: 'task', priceCents: null })]),
  ).toBe(false)
  expect(hasPrices([compra()])).toBe(true)
})

describe('priceLine', () => {
  it('tienda, origen y cuándo (diseño 16, B1, B7 y D3)', () => {
    expect(
      priceLine(
        { urlSite: 'PcComponentes', priceSource: 'web', priceCheckedAt: new Date(2026, 6, 30) },
        NOW,
      ),
    ).toBe('PcComponentes · de la web · mirado el 30 jul')
    expect(
      priceLine({ urlSite: 'Real Madrid CF', priceSource: 'web', priceCheckedAt: NOW }, NOW),
    ).toBe('Real Madrid CF · de la web · hoy')
    expect(
      priceLine(
        { urlSite: null, priceSource: 'manual', priceCheckedAt: new Date(2026, 8, 21) },
        NOW,
      ),
    ).toBe('puesto a mano · 21 sep')
    expect(
      priceLine(
        { urlSite: null, priceSource: 'manual', priceCheckedAt: new Date(2026, 8, 30, 9) },
        NOW,
      ),
    ).toBe('puesto a mano · ayer')
  })
})
