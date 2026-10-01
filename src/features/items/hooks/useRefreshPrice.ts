import { useState } from 'react'

import { formatCents } from '@/lib/money'

import { fetchLinkMetadata } from '../api'
import type { Item, ItemPatch } from '../types'

/**
 * Cómo fue «Actualizar precio» (diseño 16, B10–B14): buscando, un precio nuevo, el mismo, la web
 * no lo da, la web no deja pasar o no se pudo preguntar.
 */
export type RefreshState =
  | { status: 'idle' }
  | { status: 'searching' }
  | { status: 'new' }
  | { status: 'same'; text: string }
  | { status: 'none' }
  | { status: 'blocked' }
  | { status: 'failed' }

/**
 * «Actualizar precio»: vuelve a mirar la web de la compra cuando se pulsa (ADR-007, capa 2 a
 * demanda). Es una petición nueva cada vez, sin la caché del enlace. El precio de la web sustituye
 * al que hubiera, también al escrito a mano, porque se ha pedido; si es el mismo, solo se apunta
 * que se miró («Sigue a 99 €. Mirado ahora.»). El resultado se dice dentro del bloque, sin toast.
 */
export function useRefreshPrice(item: Item, onUpdate: (item: Item, patch: ItemPatch) => void) {
  const [state, setState] = useState<RefreshState>({ status: 'idle' })

  const refresh = async () => {
    if (!item.url) return
    setState({ status: 'searching' })
    try {
      const metadata = await fetchLinkMetadata(item.url)
      const price = metadata.price
      if (!price) {
        // Sin título ni imagen la página ni siquiera se pudo leer: la web no deja pasar.
        setState({ status: metadata.title || metadata.image ? 'none' : 'blocked' })
        return
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

  return {
    state,
    refresh,
    reset: () => {
      setState({ status: 'idle' })
    },
  }
}
