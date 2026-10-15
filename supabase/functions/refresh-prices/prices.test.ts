import { describe, expect, it } from 'vitest'

import { formatCents as appFormatCents } from '@/lib/money'
import { parsePush } from '@/sw/push'

import {
  DROPS_URL,
  dropMessage,
  dropsMessage,
  formatCents,
  pagePrice,
  planDrops,
  type PriceDrop,
  sinceWhen,
  toDueCheck,
  toPriceDrop,
} from './prices'

function drop(overrides: Partial<PriceDrop> = {}): PriceDrop {
  return {
    itemId: 'i1',
    listId: 'l1',
    title: 'Auriculares',
    store: 'Keychron',
    beforeCents: 9900,
    afterCents: 7900,
    currency: 'EUR',
    beforeCheckedAt: new Date('2026-10-06T07:00:00Z'),
    recipients: ['ana'],
    concealedFor: [],
    ...overrides,
  }
}

/** `Intl` separa el importe del símbolo con un espacio duro, como en la app. */
const nbsp = (text: string) => text.replace(/ (€|US\$)/g, '\u00a0$1')

const PRODUCT = `<html><head><meta property="og:title" content="K1 Pro"></head><body>
  <script type="application/ld+json">{"@type":"Product","name":"K1 Pro",
  "offers":{"@type":"Offer","price":"79.00","priceCurrency":"EUR"}}</script></body></html>`

describe('lo que da la base', () => {
  it('lo que toca mirar', () => {
    expect(toDueCheck({ target: 'link', id: 'k1', url: 'https://keychron.com/k1' })).toEqual({
      target: 'link',
      id: 'k1',
      url: 'https://keychron.com/k1',
    })
    expect(toDueCheck({ target: 'otro', id: 'k1', url: 'x' })).toBeNull()
    expect(toDueCheck(null)).toBeNull()
  })

  it('una bajada', () => {
    expect(
      toPriceDrop({
        item_id: 'i1',
        list_id: 'l1',
        title: 'Auriculares',
        store: '',
        before_cents: 9900,
        after_cents: 7900,
        currency: 'EUR',
        before_checked_at: '2026-10-06T07:00:00+00:00',
        recipients: ['ana', null],
      }),
    ).toEqual(drop({ store: null }))
    expect(toPriceDrop({ item_id: 'i1' })).toBeNull()
  })

  it('quiénes la tienen oculta (5.8)', () => {
    expect(
      toPriceDrop({
        item_id: 'i1',
        list_id: 'l1',
        title: 'Auriculares',
        store: 'Keychron',
        before_cents: 9900,
        after_cents: 7900,
        currency: 'EUR',
        before_checked_at: '2026-10-06T07:00:00+00:00',
        recipients: ['ana', 'bea'],
        concealed_for: ['ana'],
      })?.concealedFor,
    ).toEqual(['ana'])
  })
})

describe('el precio de la página', () => {
  it('el del JSON-LD, como al pegar el enlace', () => {
    expect(pagePrice({ html: PRODUCT, url: 'https://keychron.com/k1' })).toEqual({
      cents: 7900,
      currency: 'EUR',
    })
  })

  it('sin página, una imagen o sin precio: un fallo', () => {
    expect(pagePrice(null)).toBeNull()
    expect(pagePrice({ image: 'https://keychron.com/k1.jpg' })).toBeNull()
    expect(pagePrice({ html: '<html><title>K1</title></html>', url: 'https://keychron.com' })).toBe(
      null,
    )
  })
})

// Miércoles 7 de octubre a las 9:00 en Madrid.
const NOW = new Date('2026-10-07T07:00:00Z')

describe('el aviso', () => {
  it('una bajada: la compra de título, «Bajó a 79 € en Keychron, 20 € menos que ayer.» (N1)', () => {
    expect(dropMessage(drop(), NOW)).toEqual({
      title: 'Auriculares',
      body: nbsp('Bajó a 79 € en Keychron, 20 € menos que ayer.'),
      url: '/lists/l1?item=i1',
      tag: 'price:i1',
    })
  })

  it('«que antes» si el de antes no era de ayer; sin tienda, con céntimos y en otra moneda', () => {
    expect(
      dropMessage(
        drop({
          store: null,
          beforeCents: 1299,
          afterCents: 999,
          currency: 'USD',
          beforeCheckedAt: new Date('2026-09-30T10:00:00Z'),
        }),
        NOW,
      ).body,
    ).toBe(nbsp('Bajó a 9,99 US$, 3 US$ menos que antes.'))
    expect(sinceWhen(null, NOW)).toBe('que antes')
    // Ayer por la noche en Madrid ya es ayer, aunque en UTC sea otra hora.
    expect(sinceWhen(new Date('2026-10-06T21:30:00Z'), NOW)).toBe('que ayer')
  })

  it('varias la misma mañana: una con todas, que abre «Bajaron esta mañana» (N2)', () => {
    const three = [
      drop(),
      drop({ itemId: 'i2', title: 'Monitor LG', afterCents: 22900, beforeCents: 26000 }),
      drop({ itemId: 'i3', title: 'Zapatillas de trail', afterCents: 6499, beforeCents: 7999 }),
    ]
    expect(dropsMessage(three)).toEqual({
      title: '3 compras bajaron de precio',
      body: nbsp('Auriculares a 79 €, Monitor LG a 229 € y 1 más.'),
      url: DROPS_URL,
      tag: 'price-drops',
    })
    expect(dropsMessage(three.slice(0, 2)).body).toBe(
      nbsp('Auriculares a 79 € y Monitor LG a 229 €.'),
    )
  })

  it('el service worker lo entiende', () => {
    const message = dropMessage(drop(), NOW)
    expect(parsePush(JSON.stringify(message))).toEqual(message)
  })

  it('los importes se escriben como en la app', () => {
    for (const [cents, currency] of [
      [7900, 'EUR'],
      [999, 'EUR'],
      [129950, 'EUR'],
      [4900, 'USD'],
    ] as const) {
      expect(formatCents(cents, currency)).toBe(appFormatCents(cents, currency))
    }
  })
})

describe('a quién', () => {
  it('a cada uno que lo pidió', () => {
    expect(
      planDrops([drop({ recipients: ['ana', 'bea'] })], NOW).map((entry) => entry.userId),
    ).toEqual(['ana', 'bea'])
    expect(planDrops([drop({ recipients: [] })], NOW)).toEqual([])
  })

  it('dos tiendas de la misma compra que mejoran la misma mañana: una bajada, desde el precio de antes', () => {
    const plan = planDrops(
      [
        drop({ beforeCents: 30000, afterCents: 28000, store: 'PcComponentes' }),
        drop({ beforeCents: 28000, afterCents: 27500, store: 'MediaMarkt' }),
      ],
      NOW,
    )
    expect(plan).toHaveLength(1)
    expect(plan[0]?.message.body).toBe(nbsp('Bajó a 275 € en MediaMarkt, 25 € menos que ayer.'))
  })

  it('a quien bajaron varias, una con todas; a quien solo una, la suya', () => {
    const plan = planDrops(
      [drop({ recipients: ['ana', 'bea'] }), drop({ itemId: 'i2', title: 'Monitor LG' })],
      NOW,
    )
    expect(plan.find((entry) => entry.userId === 'ana')?.message.title).toBe(
      '2 compras bajaron de precio',
    )
    expect(plan.find((entry) => entry.userId === 'bea')?.message.title).toBe('Auriculares')
  })

  it('de una lista oculta, sin título ni precio y aparte de lo demás (diseño 27, D6)', () => {
    const plan = planDrops(
      [
        drop({ recipients: ['ana', 'bea'], concealedFor: ['ana'] }),
        drop({ itemId: 'i2', listId: 'l2', title: 'Monitor LG' }),
      ],
      NOW,
    )
    expect(plan.filter((entry) => entry.userId === 'ana').map((entry) => entry.message)).toEqual([
      expect.objectContaining({ title: 'Monitor LG' }),
      {
        title: 'Ha bajado un precio en una lista oculta',
        url: '/lists/l1?item=i1',
        tag: 'price-concealed',
      },
    ])
    expect(plan.find((entry) => entry.userId === 'bea')?.message.title).toBe('Auriculares')
    expect(
      planDrops(
        [
          drop({ concealedFor: ['ana'] }),
          drop({ itemId: 'i2', title: 'Monitor LG', concealedFor: ['ana'] }),
        ],
        NOW,
      ).map((entry) => entry.message.title),
    ).toEqual(['Han bajado 2 precios en listas ocultas'])
  })
})
