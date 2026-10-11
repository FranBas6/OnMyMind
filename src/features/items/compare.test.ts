import { describe, expect, it } from 'vitest'

import {
  canCompare,
  compareHint,
  compareOptions,
  leadingOption,
  lowestSeen,
  optionStore,
} from './compare'
import type { Item, ItemLink } from './types'

function item(id: string, overrides: Partial<Item> = {}): Item {
  return {
    id,
    listId: 'compras',
    kind: 'shopping',
    parentId: 'volantes',
    chooseOne: false,
    chosenId: null,
    title: id,
    notes: null,
    status: 'pending',
    priority: null,
    dueAt: null,
    allDay: false,
    recurrence: null,
    position: 1000,
    completedAt: null,
    createdAt: new Date(2026, 9, 11),
    leftInboxId: null,
    leftInboxAt: null,
    url: null,
    urlTitle: null,
    imageUrl: null,
    imagePath: null,
    urlSite: null,
    priceCents: null,
    currency: 'EUR',
    priceSource: null,
    previousPriceCents: null,
    priceCheckedAt: null,
    links: [],
    images: [],
    priceLinkId: null,
    priceStore: null,
    priceTracking: null,
    createdBy: null,
    completedBy: null,
    ...overrides,
  }
}

function link(id: string, url: string, cents: number, position: number): ItemLink {
  return {
    id,
    url,
    urlTitle: null,
    urlSite: null,
    priceCents: cents,
    currency: 'EUR',
    priceSource: 'web',
    priceCheckedAt: null,
    priceTracking: null,
    position,
  }
}

const g29 = item('g29', { priceCents: 19900, position: 2000 })
const g923 = item('g923', { priceCents: 24999, position: 1000 })

describe('comparar (5.2, diseño 24)', () => {
  it('compara lo que sigue en juego, en su orden; con menos de dos, nada', () => {
    const comprada = item('vieja', { status: 'bought' })
    expect(compareOptions([g29, comprada, g923]).map((option) => option.id)).toEqual([
      'g923',
      'g29',
    ])
    expect(canCompare([g29, g923])).toBe(true)
    expect(canCompare([g29, comprada])).toBe(false)
  })

  it('el botón relleno: la elegida o, sin elegida, la más barata', () => {
    expect(leadingOption({ chosenId: null }, [g29, g923])).toBe('g29')
    expect(leadingOption({ chosenId: 'g923' }, [g29, g923])).toBe('g923')
    expect(leadingOption({ chosenId: 'g923' }, [g29, { ...g923, status: 'bought' }])).toBe('g29')
  })

  it('la tienda: la de su precio y en cuántas, o la de su enlace', () => {
    const tiendas = item('t', {
      priceStore: 'Amazon',
      links: [
        link('a', 'https://www.amazon.es/g29', 19900, 1000),
        link('b', 'https://www.pccomponentes.com/g29', 21900, 2000),
        link('c', 'https://www.logitechg.com/g29', 22999, 3000),
      ],
    })
    expect(optionStore(tiendas)).toBe('Amazon · en 3 tiendas')
    expect(
      optionStore(item('u', { url: 'https://www.mediamarkt.es/g923', urlSite: 'MediaMarkt' })),
    ).toBe('MediaMarkt')
    expect(optionStore(item('d', { url: 'https://www.mediamarkt.es/g923' }))).toBe('mediamarkt.es')
    expect(optionStore(item('h', { kind: 'task', url: 'https://booking.com/x' }))).toBeNull()
    expect(optionStore(item('s'))).toBeNull()
  })

  it('el más bajo visto, en su moneda y contando el de ahora', () => {
    const records = [
      { cents: 21900, currency: 'EUR' },
      { cents: 18900, currency: 'EUR' },
      { cents: 100, currency: 'USD' },
    ]
    expect(lowestSeen(g29, records)).toBe(18900)
    expect(lowestSeen(g923, [])).toBe(24999)
    expect(lowestSeen(item('x'), records)).toBeNull()
  })

  it('lo que explica la vista en escritorio', () => {
    expect(compareHint(2)).toBe('Las opciones una al lado de otra. Solo lo que ya tienen guardado.')
    expect(compareHint(4)).toBe('4 opciones. Desliza o usa las flechas para ver el resto.')
  })
})
