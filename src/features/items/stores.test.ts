import { describe, expect, it } from 'vitest'

import {
  alertTracking,
  cheapestLabel,
  cheapestLink,
  extraOver,
  hasLinks,
  hasStores,
  linkFromItem,
  newLink,
  sameLink,
  stoppedNote,
  storeName,
  linksLabel,
  regainCheapest,
  withLinks,
} from './stores'
import type { Item, ItemLink } from './types'

const NOW = new Date(2026, 9, 2, 12)

const compra: Item = {
  id: 'monitor',
  listId: 'compras',
  kind: 'shopping',
  parentId: null,
  chooseOne: false,
  chosenId: null,
  sealed: null,
  title: 'Monitor LG 27"',
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
  url: 'https://www.pccomponentes.com/lg',
  urlTitle: 'Monitor LG 27UQ850',
  imageUrl: null,
  imagePath: null,
  urlSite: 'PcComponentes',
  priceCents: 26900,
  currency: 'EUR',
  priceSource: 'web',
  previousPriceCents: 28300,
  priceCheckedAt: new Date(2026, 6, 30),
  links: [],
  images: [],
  priceLinkId: null,
  priceStore: null,
  priceTracking: null,
  createdBy: null,
  completedBy: null,
}

const tienda = (id: string, price: number | null, extra: Partial<ItemLink> = {}): ItemLink => ({
  id,
  url: `https://www.${id}.es/lg`,
  urlTitle: 'LG',
  urlSite: null,
  priceCents: price,
  currency: 'EUR',
  priceSource: price === null ? null : 'web',
  priceCheckedAt: NOW,
  priceTracking: price === null ? null : 'on',
  position: 1000,
  ...extra,
})

describe('de una tienda a varias', () => {
  it('la primera sale de la compra, con lo suyo; la nueva va detrás, sin buscar', () => {
    const first = linkFromItem(compra, 'l1')
    expect(first).toMatchObject({
      url: compra.url,
      urlSite: 'PcComponentes',
      priceCents: 26900,
      priceSource: 'web',
      position: 1000,
    })
    expect(newLink('l2', 'https://www.mediamarkt.es/lg', first ? [first] : [])).toMatchObject({
      position: 2000,
      urlTitle: null,
      priceCents: null,
    })
    expect(linkFromItem({ ...compra, url: null }, 'l1')).toBeNull()
  })

  it('con dos tiendas manda la más barata, y el enlace es el de la primera', () => {
    const first = linkFromItem(compra, 'pc')
    if (!first) throw new Error('sin enlace')
    const next = withLinks(
      compra,
      [first, tienda('mediamarkt', 24900, { urlSite: 'MediaMarkt', position: 2000 })],
      NOW,
    )
    expect(hasStores(next)).toBe(true)
    expect(next).toMatchObject({
      priceCents: 24900,
      previousPriceCents: 26900,
      priceLinkId: 'mediamarkt',
      priceStore: 'MediaMarkt',
      url: compra.url,
    })
    expect(linksLabel(next)).toBe('en 2 tiendas')
    expect(cheapestLabel(next)).toBe('En MediaMarkt, la más barata de 2')
  })

  it('una tienda sin precio no cuenta, y se dice «con precio»', () => {
    const next = withLinks(compra, [
      tienda('mediamarkt', 24900, { urlSite: 'MediaMarkt' }),
      tienda('amazon', null, { position: 2000 }),
      tienda('lg', 29900, { position: 3000 }),
    ])
    expect(next.priceCents).toBe(24900)
    expect(cheapestLabel(next)).toBe('En MediaMarkt, la más barata de 2 con precio')
  })

  it('comprada, cambiar tiendas no toca lo pagado', () => {
    const bought = { ...compra, status: 'bought' as const }
    expect(withLinks(bought, [tienda('a', 100), tienda('b', 50, { position: 2 })]).priceCents).toBe(
      26900,
    )
  })

  it('con una sola tienda vuelve a ser como antes', () => {
    const next = withLinks({ ...compra, links: [tienda('a', 1)] }, [
      tienda('lg', 29900, { urlSite: 'LG' }),
    ])
    expect(next).toMatchObject({
      links: [],
      urlSite: 'LG',
      priceCents: 29900,
      priceLinkId: null,
      priceStore: null,
      priceTracking: null,
      createdBy: null,
      completedBy: null,
    })
    expect(hasStores(next)).toBe(false)
  })

  it('sin ninguna con precio, la compra se queda sin precio', () => {
    expect(withLinks(compra, [tienda('a', null), tienda('b', null)]).priceCents).toBeNull()
  })
})

describe('para enseñarlas', () => {
  it('la más barata, en euros antes que en otra moneda', () => {
    expect(cheapestLink([tienda('a', 2000), tienda('b', 1500, { currency: 'USD' })])?.id).toBe('a')
    expect(cheapestLink([tienda('a', null)])).toBeNull()
  })

  it('cuánto más cuesta cada una que la más barata', () => {
    const best = tienda('mm', 24900)
    expect(extraOver(tienda('pc', 26900), best)).toBe('+20 €')
    expect(extraOver(best, best)).toBeNull()
    expect(extraOver(tienda('am', null), best)).toBeNull()
  })

  it('el nombre de la web o el dominio; el mismo sitio aunque cambie «www.» o la barra final', () => {
    expect(storeName({ urlSite: 'MediaMarkt', url: 'https://www.mediamarkt.es/x' })).toBe(
      'MediaMarkt',
    )
    expect(storeName({ urlSite: null, url: 'https://www.mediamarkt.es/x' })).toBe('mediamarkt.es')
    expect(sameLink('https://www.mediamarkt.es/lg/', 'https://MediaMarkt.es/lg')).toBe(true)
    expect(sameLink('https://www.mediamarkt.es/lg', 'https://www.mediamarkt.es/otro')).toBe(false)
  })
})

describe('ya no se puede seguir (3.8, diseño 22, T2)', () => {
  it('lo dice de la tienda que se dejó de mirar, y si las otras siguen', () => {
    expect(stoppedNote(['LG'], 3)).toBe(
      'LG no ha dado el precio tres mañanas seguidas y se ha dejado de mirar. Las otras siguen. Para volver a probar con LG, toca ↻.',
    )
    expect(stoppedNote(['LG'], 2)).toBe(
      'LG no ha dado el precio tres mañanas seguidas y se ha dejado de mirar. La otra sigue. Para volver a probar con LG, toca ↻.',
    )
    expect(stoppedNote(['LG', 'Amazon'], 2)).toBe(
      'LG y Amazon no han dado el precio tres mañanas seguidas y se ha dejado de mirar. Para volver a probar, toca ↻.',
    )
  })

  it('una compra se mira sola si alguna tienda se mira; en pausa si ninguna puede', () => {
    const conTiendas = (a: ItemLink['priceTracking'], b: ItemLink['priceTracking']) => ({
      ...compra,
      links: [tienda('a', 100, { priceTracking: a }), tienda('b', 200, { priceTracking: b })],
    })
    expect(alertTracking(conTiendas('on', 'stopped'))).toBe('on')
    expect(alertTracking(conTiendas('stopped', null))).toBe('stopped')
    expect(alertTracking(conTiendas(null, null))).toBeNull()
    expect(alertTracking({ ...compra, priceTracking: 'on' })).toBe('on')
  })
})

describe('varios enlaces en lo que no es compra (4.6)', () => {
  const tarea: Item = {
    ...compra,
    kind: 'task',
    title: 'Reformar la cocina',
    url: 'https://www.pinterest.es/cocinas',
    urlTitle: 'Ideas de cocinas pequeñas',
    urlSite: 'Pinterest',
    priceCents: null,
    priceSource: null,
    previousPriceCents: null,
    priceCheckedAt: null,
  }

  it('el primero es el de la tarea, sin precio aunque un enlace lo traiga', () => {
    const first = linkFromItem(tarea, 'l1')
    if (!first) throw new Error('sin enlace')
    const next = withLinks(tarea, [
      first,
      tienda('leroymerlin', 18900, { position: 2000 }),
      tienda('cocinasmartin', null, { position: 3000 }),
    ])
    expect(hasLinks(next)).toBe(true)
    expect(hasStores(next)).toBe(false)
    expect(next).toMatchObject({
      url: 'https://www.pinterest.es/cocinas',
      priceCents: null,
      priceLinkId: null,
    })
    expect(linksLabel(next)).toBe('en 3 enlaces')
  })

  it('al quedar uno, vuelve a la tarea sin precio', () => {
    const next = withLinks({ ...tarea, links: [tienda('a', null)] }, [tienda('leroymerlin', 18900)])
    expect(next).toMatchObject({
      links: [],
      url: 'https://www.leroymerlin.es/lg',
      priceCents: null,
    })
  })

  it('una compra de dos tiendas que pasa a tarea y vuelve recupera el precio de la más barata', () => {
    const stores = [
      tienda('pccomponentes', 26900, { urlSite: 'PcComponentes' }),
      tienda('mediamarkt', 24900, { urlSite: 'MediaMarkt', position: 2000 }),
    ]
    const asTask: Item = { ...tarea, links: stores, priceLinkId: 'mediamarkt' }
    const back = regainCheapest(asTask, { ...asTask, kind: 'shopping' }, NOW)
    expect(back).toMatchObject({
      priceCents: 24900,
      previousPriceCents: null,
      priceSource: 'web',
      priceLinkId: 'mediamarkt',
      priceStore: 'MediaMarkt',
    })
    // Seguir siendo tarea, o volver con un solo enlace, no toca nada.
    expect(regainCheapest(asTask, { ...asTask, title: 'Monitor' })).toMatchObject({
      priceCents: null,
    })
    expect(regainCheapest(tarea, { ...tarea, kind: 'shopping' }).priceCents).toBeNull()
  })
})
