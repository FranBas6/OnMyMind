import { formatCents } from '@/lib/money'

import { linkDomain } from './links'
import type { Item, ItemLink, ItemLinkPatch } from './types'

/**
 * Varias tiendas en una compra (2.2b, diseño 19). Con una sola, el enlace y el precio son los del
 * ítem, como en la 2.1. Con dos o más viven en `item_links`, y la compra se queda con el precio de
 * la más barata. Esto es lo mismo que hace el trigger `item_links_sync`, para lo optimista.
 */

/** Si una compra tiene la lista «Dónde comprarlo». */
export function hasStores(item: Pick<Item, 'kind' | 'links'>): boolean {
  return item.kind === 'shopping' && item.links.length >= 2
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
 * La compra con estas tiendas, con lo que haría `item_links_sync`: el enlace de la primera y el
 * precio de la más barata (salvo comprada, que se queda con lo pagado). Con una sola tienda, esa
 * vuelve al ítem y la lista se vacía.
 */
export function withLinks(item: Item, links: readonly ItemLink[], now: Date = new Date()): Item {
  const sorted = [...links].sort((a, b) => a.position - b.position)
  if (sorted.length === 1) {
    const [only] = sorted
    if (!only) return item
    const bought = item.status === 'bought'
    return {
      ...item,
      links: [],
      url: only.url,
      urlTitle: only.urlTitle,
      urlSite: only.urlSite,
      priceLinkId: null,
      priceStore: null,
      ...(bought ? {} : priceFrom(item, only, now)),
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
  if (item.status === 'bought') return next
  const best = cheapestLink(sorted)
  if (!best) return { ...next, priceCents: null, priceLinkId: null, priceStore: null }
  return {
    ...next,
    ...priceFrom(item, best, now),
    priceLinkId: best.id,
    priceStore: storeName(best),
  }
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
  return { ...link, ...patch }
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

/** «en 3 tiendas» en la meta de la fila (diseño 19, T24). */
export function storesLabel(item: Pick<Item, 'kind' | 'links'>): string | null {
  return hasStores(item) ? `en ${String(item.links.length)} tiendas` : null
}
