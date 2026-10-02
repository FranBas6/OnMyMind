import { useQuery } from '@tanstack/react-query'
import { useEffect, useRef } from 'react'

import { linkDomain, URL_TITLE_MAX_LENGTH } from '../links'
import { linkMetadataQueryOptions } from '../queries'
import { ITEM_TITLE_MAX_LENGTH } from '../schemas'
import { hasStores } from '../stores'
import type { LinkMetadata } from '../api'
import type { Item, ItemPatch } from '../types'

/** Cómo va el título del enlace (diseño 15). */
export type LinkState = 'ready' | 'searching' | 'offline' | 'unavailable'

/**
 * Cómo va el precio de la web de una compra sin precio (diseño 16, B6–B9): buscándolo, sin red
 * (se buscará al volver), o la web no lo da. `null`: no hay nada que buscar (sin enlace, con
 * precio o no es una compra), o la función no contesta y se probará la próxima vez.
 */
export type WebPriceState = 'searching' | 'offline' | 'none' | null

/**
 * Lo que trae la página de un enlace, una vez por enlace (`fetch-metadata`): el título, el nombre
 * de la web y la imagen, si aún no se habían buscado (2a.6); y, en una compra sin precio, el precio
 * (2.1). Lo de la web nunca pisa lo que ya hay: ni la foto propia ni el precio escrito a mano. Lo
 * capturado sin red lleva el dominio como título hasta que llega el de la página (2.3). Sin red, la
 * consulta espera en pausa y sale sola al volver la conexión.
 */
export function useLinkMetadata(
  item: Item,
  online: boolean,
  onUpdate: (item: Item, patch: ItemPatch) => void,
): { linkState: LinkState; priceState: WebPriceState; siteName: string | null } {
  // Con varias tiendas, cada una busca lo suyo (`Stores`): el enlace del ítem es el de la primera.
  const single = !hasStores(item)
  const needsTitle = single && item.url !== null && item.urlTitle === null
  // Una compra con enlace y sin precio: recién pegado, o algo con enlace que se convierte en compra.
  const needsPrice =
    single && item.kind === 'shopping' && item.url !== null && item.priceCents === null
  const metadata = useQuery({
    ...linkMetadataQueryOptions(item.url ?? ''),
    enabled: needsTitle || needsPrice,
  })

  // Una vez por enlace: si guardar falla y vuelve atrás, no se reintenta en bucle.
  const appliedTitle = useRef<string | null>(null)
  const appliedPrice = useRef<string | null>(null)
  useEffect(() => {
    const data = metadata.data
    if (!data || item.url === null) return
    const patch: ItemPatch = {}
    if (needsTitle && appliedTitle.current !== item.url) {
      appliedTitle.current = item.url
      Object.assign(patch, titlePatch(item, data))
    }
    if (needsPrice && data.price && appliedPrice.current !== item.url) {
      appliedPrice.current = item.url
      Object.assign(patch, pricePatch(data.price))
    }
    if (Object.keys(patch).length > 0) onUpdate(item, patch)
  }, [needsTitle, needsPrice, metadata.data, item, onUpdate])

  const waiting = !online || metadata.fetchStatus === 'paused'
  // No se ha podido preguntar: se ve como sin título y se reintenta al volver a abrirlo.
  const failed = metadata.isError && metadata.fetchStatus === 'idle'
  const linkState: LinkState = !needsTitle
    ? 'ready'
    : waiting
      ? 'offline'
      : failed
        ? 'unavailable'
        : 'searching'
  const priceState: WebPriceState = !needsPrice
    ? null
    : waiting
      ? 'offline'
      : failed
        ? null
        : metadata.data
          ? metadata.data.price
            ? 'searching'
            : 'none'
          : 'searching'

  return {
    linkState,
    priceState,
    siteName: item.urlSite ?? metadata.data?.siteName ?? null,
  }
}

/**
 * El título, el nombre de la web y la imagen de la página, para un enlace que aún no los tiene. La
 * imagen solo si no hay foto. Lo capturado sin red, o guardado antes de que llegara (2.3), lleva
 * el dominio como título: pasa a ser el de la página.
 */
export function titlePatch(item: Item, data: LinkMetadata): ItemPatch {
  const patch: ItemPatch = {
    urlTitle: data.title?.slice(0, URL_TITLE_MAX_LENGTH) ?? '',
    urlSite: data.siteName?.slice(0, URL_TITLE_MAX_LENGTH) ?? null,
  }
  if (!item.imagePath && !item.imageUrl && data.image) patch.imageUrl = data.image
  if (data.title && item.url && item.title === linkDomain(item.url)) {
    patch.title = data.title.slice(0, ITEM_TITLE_MAX_LENGTH)
  }
  return patch
}

/** El precio de la web para una compra que no tiene (2.1): lo escrito a mano nunca se pisa. */
export function pricePatch(price: NonNullable<LinkMetadata['price']>): ItemPatch {
  return { priceCents: price.cents, currency: price.currency, priceSource: 'web' }
}
