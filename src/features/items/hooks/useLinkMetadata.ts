import { useQuery } from '@tanstack/react-query'
import { useEffect, useRef } from 'react'

import { formatCents } from '@/lib/money'

import { linkDomain, URL_TITLE_MAX_LENGTH } from '../links'
import { linkMetadataQueryOptions } from '../queries'
import { ITEM_TITLE_MAX_LENGTH } from '../schemas'
import { hasLinks } from '../stores'
import type { LinkMetadata } from '../api'
import type { Item, ItemLink, ItemLinkPatch, ItemPatch } from '../types'

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
  // Con varios enlaces, cada uno busca lo suyo (`useItemLinkMetadata`): el del ítem es el primero.
  const single = !hasLinks(item)
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

/**
 * Lo que trae la web de un enlace de la lista (`item_links`) recién pegado, una vez, como el enlace
 * de la 2a.6: su título y el nombre de la web; en una tienda de una compra, además su precio, si aún
 * no tiene (2.2b). Sin red espera y sale al volver la conexión. Fuera de las compras no hay precio,
 * aunque la web lo dé (4.6).
 */
export function useItemLinkMetadata(
  link: ItemLink,
  current: Item,
  onUpdate: (patch: ItemLinkPatch) => void,
  onNotice?: (text: string) => void,
) {
  const needs = link.urlTitle === null
  const metadata = useQuery({ ...linkMetadataQueryOptions(link.url), enabled: needs })
  const applied = useRef(false)
  useEffect(() => {
    const data = metadata.data
    if (!needs || !data || applied.current) return
    applied.current = true
    const patch: ItemLinkPatch = {
      urlTitle: data.title?.slice(0, URL_TITLE_MAX_LENGTH) ?? '',
      urlSite: data.siteName?.slice(0, URL_TITLE_MAX_LENGTH) ?? null,
    }
    if (current.kind === 'shopping' && link.priceCents === null && data.price) {
      patch.priceCents = data.price.cents
      patch.currency = data.price.currency
      patch.priceSource = 'web'
      patch.priceCheckedAt = new Date()
      // La nueva pasa a ser la más barata (diseño 19, T4): se dice cuánto menos y que quién.
      if (
        current.priceCents !== null &&
        data.price.currency === current.currency &&
        data.price.cents < current.priceCents
      ) {
        const name = data.siteName ?? linkDomain(link.url)
        const before = current.priceStore ?? current.urlSite ?? linkDomain(current.url ?? '')
        onNotice?.(
          `${name} es la más barata: ${formatCents(current.priceCents - data.price.cents, current.currency)} menos que ${before}.`,
        )
      }
    }
    onUpdate(patch)
  }, [needs, metadata.data, link, current, onUpdate, onNotice])

  return {
    searching: needs && metadata.fetchStatus === 'fetching',
    waiting: needs && metadata.fetchStatus === 'paused',
  }
}
