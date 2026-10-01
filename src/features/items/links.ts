import type { Item } from './types'

/** El `check` de `items.url_title`. */
export const URL_TITLE_MAX_LENGTH = 300

/**
 * Lo pegado como enlace, listo para guardar, o `null` si no lo parece («Eso no parece un enlace.»,
 * diseño 15, M6). Vale con o sin `https://` («amazon.es/dp/B0»), y de un texto que lleva un enlace
 * dentro («Mira esto: https://…») se queda el enlace.
 */
export function normalizeLink(text: string): string | null {
  const trimmed = text.trim()
  if (!trimmed) return null
  const embedded = /https?:\/\/\S+/i.exec(trimmed)?.[0]
  const candidate = embedded ?? (/\s/.test(trimmed) ? null : trimmed)
  if (!candidate) return null
  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(candidate) ? candidate : `https://${candidate}`
  let url: URL
  try {
    url = new URL(withScheme)
  } catch {
    return null
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null
  // «hola» no es un enlace; «amazon.es» sí.
  if (!/\.[a-z]{2,}$/i.test(url.hostname) && !/^\d+\.\d+\.\d+\.\d+$/.test(url.hostname)) return null
  return url.href
}

/** «shop.realmadrid.com» (sin «www.»). */
export function linkDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

/** «tiendamadridista.es/p/1024»: lo que va debajo cuando la página no da título (M5). */
export function linkPath(url: string): string {
  try {
    const { pathname, search } = new URL(url)
    const path = `${pathname}${search}`.replace(/\/$/, '')
    return `${linkDomain(url)}${path}`
  } catch {
    return url
  }
}

/** El título de la fila del enlace: el de la página o, si no lo da, su dominio. */
export function linkTitle(item: Pick<Item, 'url' | 'urlTitle'>): string | null {
  if (!item.url) return null
  // `''` es «la página no da título»: también va el dominio.
  return (item.urlTitle ?? '') === '' ? linkDomain(item.url) : (item.urlTitle ?? '')
}
