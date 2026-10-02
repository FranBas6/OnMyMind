import {
  ITEM_TITLE_MAX_LENGTH,
  linkDomain,
  normalizeLink,
  URL_TITLE_MAX_LENGTH,
  type ItemKind,
  type LinkMetadata,
  type LinkPreviewState,
  type NewItemLink,
} from '@/features/items'

/** Un enlace en lo escrito en la captura, y lo que va con él. */
export interface CaptureLink {
  url: string
  /** Lo escrito además del enlace («Regalo para Ana https://…» → «Regalo para Ana»). */
  rest: string
  /** Solo hay el enlace: el campo lo pinta en índigo (diseño 16, K1). */
  onlyLink: boolean
}

/**
 * Si lo escrito o pegado en la captura lleva un enlace, la hoja entra en «modo enlace» (pantalla
 * 9). Hace falta `https://` o `www.`: en el detalle «amazon.es» vale porque se pide un enlace,
 * pero aquí «Node.js» o «leer el.pais» son cosas que hacer.
 */
export function captureLink(text: string): CaptureLink | null {
  const match = /(?:https?:\/\/|www\.)\S+/i.exec(text)
  if (!match) return null
  const url = normalizeLink(match[0])
  if (!url) return null
  const rest = `${text.slice(0, match.index)} ${text.slice(match.index + match[0].length)}`
    .replace(/\s+/g, ' ')
    .trim()
  return { url, rest, onlyLink: rest === '' }
}

/**
 * El título con el que se guarda: lo escrito además del enlace o, si solo hay el enlace, el de la
 * página. Sin él (buscando, sin red, la web no da nada), el dominio, que pasa a ser el de la página
 * cuando llegue.
 */
export function captureTitle(link: CaptureLink, metadata: LinkMetadata | null): string {
  const page = metadata?.title?.trim() ?? ''
  const title = link.rest || page || linkDomain(link.url)
  return title.slice(0, ITEM_TITLE_MAX_LENGTH)
}

/**
 * Lo que se guarda del enlace. `urlTitle` es `''` si la página se leyó y no tenía título (como en
 * el detalle, así no se vuelve a pedir), y `null` si aún no se sabe. El precio, solo en una compra.
 */
export function capturedLink(
  link: CaptureLink,
  preview: { state: LinkPreviewState; metadata: LinkMetadata | null },
  kind: ItemKind,
): NewItemLink {
  const { metadata } = preview
  return {
    url: link.url,
    urlTitle:
      preview.state === 'ready' ? (metadata?.title?.slice(0, URL_TITLE_MAX_LENGTH) ?? '') : null,
    urlSite: metadata?.siteName?.slice(0, URL_TITLE_MAX_LENGTH) ?? null,
    imageUrl: metadata?.image ?? null,
    price: kind === 'shopping' ? (metadata?.price ?? null) : null,
  }
}
