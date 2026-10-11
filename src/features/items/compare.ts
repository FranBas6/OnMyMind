import { chosenOption, cheapestOption } from './chooseOne'
import { linkDomain } from './links'
import { isOutOfMind } from './status'
import { cheapestLink, hasStores, linksLabel, storeName } from './stores'
import type { Item } from './types'

/**
 * Comparar (5.2, diseño 24, A5–A8 y D2–D4): las opciones de una sublista «para elegir una», una al
 * lado de otra, con solo lo que ya tienen guardado.
 */

/** Lo que se compara: lo que sigue en juego, en su orden. */
export function compareOptions(children: readonly Item[], now: Date = new Date()): Item[] {
  return children
    .filter((child) => !isOutOfMind(child, now))
    .sort((a, b) => a.position - b.position)
}

/** Con menos de dos no hay nada que comparar: «Comparar» se ve en gris (A8b). */
export function canCompare(children: readonly Item[], now: Date = new Date()): boolean {
  return compareOptions(children, now).length >= 2
}

/**
 * La opción con el botón relleno (A5, D2): la elegida o, sin elegida, la más barata. Las demás
 * llevan el botón con borde.
 */
export function leadingOption(sublist: Pick<Item, 'chosenId'>, children: readonly Item[]) {
  const chosen = chosenOption(sublist, children)
  if (chosen && !isOutOfMind(chosen)) return chosen.id
  return cheapestOption(children)?.id ?? null
}

/**
 * Dónde está y en cuántas tiendas (A5): «Amazon · en 3 tiendas», la tienda de su precio o, con una
 * sola, la de su enlace. `null` si no es una compra o no tiene enlace.
 */
export function optionStore(item: Item): string | null {
  if (item.kind !== 'shopping') return null
  if (hasStores(item)) {
    const best = cheapestLink(item.links)
    const name = item.priceStore ?? (best ? storeName(best) : null)
    const count = linksLabel(item)
    return [name, count].filter(Boolean).join(' · ') || null
  }
  if (!item.url) return null
  return item.urlSite?.trim() ? item.urlSite : linkDomain(item.url)
}

/**
 * «Más bajo visto: 189 €» (A5): el precio más bajo de su histórico en su moneda, contando el de
 * ahora. `null` sin precio.
 */
export function lowestSeen(
  item: Pick<Item, 'priceCents' | 'currency'>,
  records: readonly { cents: number; currency: string }[],
): number | null {
  if (item.priceCents === null) return null
  return records
    .filter((record) => record.currency === item.currency)
    .reduce((lowest, record) => Math.min(lowest, record.cents), item.priceCents)
}

/** Lo que explica la vista en escritorio (D2, D3): con cuatro o más, que hay que desplazarse. */
export function compareHint(count: number): string {
  return count >= 4
    ? `${String(count)} opciones. Desliza o usa las flechas para ver el resto.`
    : 'Las opciones una al lado de otra. Solo lo que ya tienen guardado.'
}
