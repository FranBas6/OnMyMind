import { useState } from 'react'
import { toast } from 'sonner'

import { formatCents } from '@/lib/money'

import { fetchLinkMetadata, type LinkMetadata } from '../api'
import { linkDomain } from '../links'
import { cheapestLink, hasStores, patchLink, storeName } from '../stores'
import type { Item, ItemLink, ItemLinkPatch, ItemPatch } from '../types'

/**
 * Cómo fue «Actualizar precio» (diseño 16, B10–B14, y 19, T16–T19): buscando (en qué tiendas), un
 * precio nuevo, el mismo, la web no lo da, no deja pasar, no se pudo; con varias tiendas, una frase
 * que resume (`summary`) y las que no contestaron (`failedIds`), que enseñan su último precio.
 */
export type RefreshState =
  | { status: 'idle' }
  | { status: 'searching'; ids: readonly string[] }
  | { status: 'new' }
  | { status: 'same'; text: string }
  | { status: 'none' }
  | { status: 'blocked' }
  | { status: 'failed' }
  | {
      status: 'summary'
      text: string
      tone: 'success' | 'muted'
      failedIds: readonly string[]
    }

/** Lo que se sabe de una tienda después de mirar su web. */
type Outcome =
  | { link: ItemLink; result: 'new' | 'same'; patch: ItemLinkPatch }
  | { link: ItemLink; result: 'none' | 'failed' }

/**
 * «Actualizar precio»: vuelve a mirar la web cuando se pulsa (ADR-007, capa 2 a demanda), con una
 * petición nueva cada vez, sin la caché del enlace.
 * - **Una tienda:** el precio de la web sustituye al que hubiera, también al escrito a mano,
 *   porque se ha pedido; si es el mismo, solo se apunta que se miró.
 * - **Varias:** se miran a la vez todas las que no tienen el precio escrito a mano («Actualizar
 *   precio» no lo pisa en esa tienda, diseño 19, T13), y la compra se queda con la más barata.
 *   `refreshLink` mira solo una: el ↻ de una tienda que ya no se podía seguir (diseño 22, T1).
 * - **Si ya no se podía seguir** (3.8) y ahora da precio, vuelve a mirarse cada mañana y se dice:
 *   «Keychron vuelve a mirarse cada mañana» (T4).
 */
export function useRefreshPrice(
  item: Item,
  onUpdate: (item: Item, patch: ItemPatch) => void,
  onUpdateLink: (item: Item, linkId: string, patch: ItemLinkPatch) => void,
) {
  const [state, setState] = useState<RefreshState>({ status: 'idle' })

  const refreshOne = async (url: string) => {
    setState({ status: 'searching', ids: [] })
    try {
      const metadata = await fetchLinkMetadata(url)
      const price = metadata.price
      if (!price) {
        setState({ status: readable(metadata) ? 'none' : 'blocked' })
        return
      }
      if (item.priceTracking === 'stopped') {
        toast(`${item.urlSite ?? linkDomain(url)} vuelve a mirarse cada mañana`)
      }
      if (price.cents === item.priceCents && price.currency === item.currency) {
        onUpdate(item, { priceSource: 'web', priceCheckedAt: new Date() })
        setState({ status: 'same', text: formatCents(price.cents, price.currency) })
        return
      }
      onUpdate(item, { priceCents: price.cents, currency: price.currency, priceSource: 'web' })
      setState({ status: 'new' })
    } catch {
      setState({ status: 'failed' })
    }
  }

  const refreshStores = async (only?: string) => {
    const targets = item.links.filter((link) =>
      only ? link.id === only : link.priceSource !== 'manual',
    )
    setState({ status: 'searching', ids: targets.map((link) => link.id) })
    const now = new Date()
    const outcomes: Outcome[] = await Promise.all(
      targets.map(async (link): Promise<Outcome> => {
        try {
          const metadata = await fetchLinkMetadata(link.url)
          const price = metadata.price
          if (!price) return { link, result: readable(metadata) ? 'none' : 'failed' }
          const same = price.cents === link.priceCents && price.currency === link.currency
          return {
            link,
            result: same ? 'same' : 'new',
            patch: same
              ? { priceSource: 'web', priceCheckedAt: now }
              : {
                  priceCents: price.cents,
                  currency: price.currency,
                  priceSource: 'web',
                  priceCheckedAt: now,
                },
          }
        } catch {
          return { link, result: 'failed' }
        }
      }),
    )
    for (const outcome of outcomes) {
      if (outcome.result === 'new' || outcome.result === 'same') {
        onUpdateLink(item, outcome.link.id, outcome.patch)
        if (outcome.link.priceTracking === 'stopped') {
          toast(`${storeName(outcome.link)} vuelve a mirarse cada mañana`)
        }
      }
    }
    setState(storesSummary(item.links, outcomes))
  }

  return {
    state,
    refresh: async () => {
      if (hasStores(item)) await refreshStores()
      else if (item.url) await refreshOne(item.url)
    },
    refreshLink: (linkId: string) => refreshStores(linkId),
    reset: () => {
      setState({ status: 'idle' })
    },
  }
}

/** Sin título ni imagen la página ni siquiera se pudo leer: la web no deja pasar. */
function readable(metadata: LinkMetadata): boolean {
  return Boolean(metadata.title ?? metadata.image)
}

/** La frase de «Actualizar precio» con varias tiendas (diseño 19, T17–T19). */
export function storesSummary(
  before: readonly ItemLink[],
  outcomes: readonly Outcome[],
): RefreshState {
  const after = before.map((link) => {
    const outcome = outcomes.find((entry) => entry.link.id === link.id)
    return outcome && 'patch' in outcome ? patchLink(link, outcome.patch) : link
  })
  const failed = outcomes.filter((outcome) => outcome.result === 'failed')
  const failedIds = failed.map((outcome) => outcome.link.id)
  const bestBefore = cheapestLink(before)
  const bestAfter = cheapestLink(after)

  if (failed.length > 0) {
    const names = failed.map((outcome) => storeName(outcome.link)).join(', ')
    const verb = failed.length > 1 ? 'no contestaron' : 'no contestó'
    return {
      status: 'summary',
      tone: 'muted',
      text: `${names} ${verb}; se queda con su último precio. Las otras, al día.`,
      failedIds,
    }
  }
  if (
    bestAfter &&
    bestAfter.priceCents !== null &&
    (bestAfter.id !== bestBefore?.id || bestAfter.priceCents !== bestBefore.priceCents)
  ) {
    const price = formatCents(bestAfter.priceCents, bestAfter.currency)
    return {
      status: 'summary',
      tone: 'success',
      text:
        bestAfter.id === bestBefore?.id
          ? `Precio nuevo de la web: ${price} en ${storeName(bestAfter)}.`
          : `${storeName(bestAfter)} bajó a ${price}. Ahora es la más barata.`,
      failedIds,
    }
  }
  const changed = outcomes.some((outcome) => outcome.result === 'new')
  return {
    status: 'summary',
    tone: 'muted',
    text: changed
      ? 'Precios al día. La más barata sigue siendo la misma.'
      : `Siguen igual las ${String(outcomes.length)}. Mirado ahora.`,
    failedIds,
  }
}
