import { formatCents } from '@/lib/money'

import { linkDomain } from './links'
import type { Item, ItemLink, ItemLinkPatch } from './types'

/**
 * Varias tiendas en una compra (2.2b, diseño 19) y varios enlaces en lo demás (4.6, diseño 23,
 * D11–D13). Con uno, el enlace (y el precio de una compra) son los del ítem, como en la 2.1. Con
 * dos o más viven en `item_links`, y el ítem se queda con el primero; una compra, además, con el
 * precio de la más barata. Esto es lo mismo que hace el trigger `item_links_sync`, para lo
 * optimista.
 */

/** Si el ítem tiene dos o más enlaces (`item_links`), sea del tipo que sea. */
export function hasLinks(item: Pick<Item, 'links'>): boolean {
  return item.links.length >= 2
}

/** Si una compra tiene la lista «Dónde comprarlo». */
export function hasStores(item: Pick<Item, 'kind' | 'links'>): boolean {
  return item.kind === 'shopping' && hasLinks(item)
}

/** El nombre de una tienda: el que da la web o, si no, su dominio. */
export function storeName(link: Pick<ItemLink, 'urlSite' | 'url'>): string {
  return link.urlSite?.trim() ? link.urlSite : linkDomain(link.url)
}

/** La más barata con precio, primero en euros (lo que suma el total). `null` si ninguna tiene. */
export function cheapestLink(links: readonly ItemLink[]): ItemLink | null {
  const priced = links.filter((link) => link.priceCents !== null)
  priced.sort(
    (a, b) =>
      Number(a.currency !== 'EUR') - Number(b.currency !== 'EUR') ||
      (a.priceCents ?? 0) - (b.priceCents ?? 0) ||
      a.position - b.position,
  )
  return priced[0] ?? null
}

/**
 * El ítem con estos enlaces, con lo que haría `item_links_sync`: el primero es el suyo y, en una
 * compra, cuenta el precio de la más barata (salvo comprada, que se queda con lo pagado). Con uno
 * solo, ese vuelve al ítem y la lista se vacía. Lo que no es compra no tiene precio: el que guarden
 * sus enlaces no se toca.
 */
export function withLinks(item: Item, links: readonly ItemLink[], now: Date = new Date()): Item {
  const sorted = [...links].sort((a, b) => a.position - b.position)
  const priced = item.kind === 'shopping' && item.status !== 'bought'
  if (sorted.length === 1) {
    const [only] = sorted
    if (!only) return item
    return {
      ...item,
      links: [],
      url: only.url,
      urlTitle: only.urlTitle,
      urlSite: only.urlSite,
      priceLinkId: null,
      priceStore: null,
      ...(priced ? priceFrom(item, only, now) : {}),
    }
  }
  if (sorted.length === 0) return { ...item, links: [] }

  const [first] = sorted
  const next: Item = {
    ...item,
    links: sorted,
    url: first?.url ?? item.url,
    urlTitle: first?.urlTitle ?? null,
    urlSite: first?.urlSite ?? null,
  }
  return priced ? withCheapest(next, now) : next
}

/** La compra con el precio de su tienda más barata, o sin precio si ninguna lo da. */
function withCheapest(item: Item, now: Date): Item {
  const best = cheapestLink(item.links)
  if (!best) return { ...item, priceCents: null, priceLinkId: null, priceStore: null }
  return {
    ...item,
    ...priceFrom(item, best, now),
    priceLinkId: best.id,
    priceStore: storeName(best),
  }
}

/**
 * Lo que vuelve a ser compra con varias tiendas guardadas recupera el precio de la más barata
 * (como el trigger `items_kind_links`): pasar una compra a tarea y volver no pierde nada (4.6).
 */
export function regainCheapest(before: Item, after: Item, now: Date = new Date()): Item {
  if (after.kind !== 'shopping' || before.kind === 'shopping' || !hasLinks(after)) return after
  return withCheapest({ ...after, previousPriceCents: null }, now)
}

/** Los campos de precio de la compra cuando pasa a ser el de una tienda (como el trigger). */
function priceFrom(item: Item, link: ItemLink, now: Date): Partial<Item> {
  const changed = link.priceCents !== item.priceCents
  return {
    priceCents: link.priceCents,
    currency: link.currency,
    priceSource: link.priceSource,
    priceCheckedAt: link.priceCents === null ? null : (link.priceCheckedAt ?? now),
    previousPriceCents: changed
      ? link.priceCents === null
        ? null
        : item.priceCents
      : item.previousPriceCents,
  }
}

/** Una tienda con un cambio aplicado. */
export function patchLink(link: ItemLink, patch: ItemLinkPatch): ItemLink {
  const next = { ...link, ...patch }
  // Como el trigger (3.8): un precio de la web pone la tienda en seguimiento.
  if (patch.priceSource === 'web' && next.priceCents !== null) next.priceTracking = 'on'
  return next
}

/**
 * La primera tienda, sacada de la compra: al añadir la segunda, las dos pasan a `item_links` y la
 * de siempre conserva su título, su nombre, su precio y de dónde salió.
 */
export function linkFromItem(item: Item, id: string): ItemLink | null {
  if (!item.url) return null
  return {
    id,
    url: item.url,
    urlTitle: item.urlTitle,
    urlSite: item.urlSite,
    priceCents: item.priceCents,
    currency: item.currency,
    priceSource: item.priceSource,
    priceCheckedAt: item.priceCheckedAt,
    priceTracking: item.priceTracking,
    position: 1000,
  }
}

/** Una tienda recién pegada, al final, todavía sin buscar. */
export function newLink(id: string, url: string, after: readonly ItemLink[]): ItemLink {
  const last = after.reduce((max, link) => Math.max(max, link.position), 0)
  return {
    id,
    url,
    urlTitle: null,
    urlSite: null,
    priceCents: null,
    currency: 'EUR',
    priceSource: null,
    priceCheckedAt: null,
    priceTracking: null,
    position: last + 1000,
  }
}

/** Dos enlaces son la misma tienda si van al mismo sitio (sin «www.», mayúsculas ni el final). */
export function sameLink(a: string, b: string): boolean {
  const key = (url: string) => {
    try {
      const parsed = new URL(url)
      return `${parsed.hostname.replace(/^www\./, '')}${parsed.pathname.replace(/\/+$/, '')}`.toLowerCase()
    } catch {
      return url.toLowerCase()
    }
  }
  return key(a) === key(b)
}

/** Las tiendas de una compra, aunque tenga una sola (su enlace) o ninguna. */
export function storesOf(item: Item): readonly ItemLink[] {
  if (item.links.length > 0) return item.links
  const only = linkFromItem(item, item.id)
  return only ? [only] : []
}

/** «+20 €»: cuánto más cuesta que la más barata, o `null` si es ella, no tiene precio u otra moneda. */
export function extraOver(link: ItemLink, best: ItemLink | null): string | null {
  if (!best || link.id === best.id || link.priceCents === null || best.priceCents === null)
    return null
  if (link.currency !== best.currency) return null
  const extra = link.priceCents - best.priceCents
  return extra > 0 ? `+${formatCents(extra, link.currency)}` : null
}

/**
 * La línea del bloque de precio con varias tiendas (diseño 19, T10 y T5): «En MediaMarkt, la más
 * barata de 3», o «de 3 con precio» si alguna no lo da.
 */
export function cheapestLabel(item: Item): string | null {
  if (!hasStores(item) || !item.priceStore) return null
  const priced = item.links.filter((link) => link.priceCents !== null).length
  const all = item.links.length
  return `En ${item.priceStore}, la más barata de ${String(priced)}${priced < all ? ' con precio' : ''}`
}

/** «en 3 tiendas» en la meta de la fila de una compra (diseño 19, T24); «en 3 enlaces» en lo demás (diseño 23, D12). */
export function linksLabel(item: Pick<Item, 'kind' | 'links'>): string | null {
  if (!hasLinks(item)) return null
  return `en ${String(item.links.length)} ${item.kind === 'shopping' ? 'tiendas' : 'enlaces'}`
}

/** Si una compra se mira sola: con varias tiendas, si alguna se mira; `stopped` si ninguna puede. */
export function alertTracking(item: Item): 'on' | 'stopped' | null {
  const all = hasStores(item) ? item.links.map((link) => link.priceTracking) : [item.priceTracking]
  if (all.includes('on')) return 'on'
  return all.includes('stopped') ? 'stopped' : null
}

/**
 * Debajo de la caja, si alguna tienda ya no se puede seguir (diseño 22, T2): «LG no ha dado el
 * precio tres mañanas seguidas y se ha dejado de mirar. Las otras siguen. Para volver a probar con
 * LG, toca ↻.».
 */
export function stoppedNote(names: readonly string[], total: number): string {
  const all = names.length === total
  const who =
    names.length === 1 ? names[0] : `${names.slice(0, -1).join(', ')} y ${names.at(-1) ?? ''}`
  const verb = names.length === 1 ? 'no ha dado' : 'no han dado'
  const others = all ? '' : names.length === total - 1 ? ' La otra sigue.' : ' Las otras siguen.'
  const retry =
    names.length === 1
      ? `Para volver a probar con ${who ?? ''}, toca ↻.`
      : 'Para volver a probar, toca ↻.'
  return `${who ?? ''} ${verb} el precio tres mañanas seguidas y se ha dejado de mirar.${others} ${retry}`
}
