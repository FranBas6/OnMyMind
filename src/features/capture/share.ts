import {
  ITEM_NOTES_MAX_LENGTH,
  ITEM_TITLE_MAX_LENGTH,
  linkDomain,
  normalizeLink,
  type NewItemLink,
} from '@/features/items'

import { captureLink } from './links'

/** Lo que llega al compartir algo a OnMyMind (`/share`, Web Share Target y el Atajo del iPhone). */
export interface SharedData {
  title?: string | undefined
  text?: string | undefined
  url?: string | undefined
}

/** Lo que se guarda en «En mente». */
export interface SharedItem {
  title: string
  link: NewItemLink | null
  notes: string | null
}

/**
 * Lo compartido, listo para guardar en «En mente» (4.7). Cada app lo manda a su manera: Chrome en
 * Android pone el enlace en `text` y el título de la página en `title`; otras mandan «Mira esto
 * https://…» en `text`; el Atajo, solo `url`.
 *   · Con un enlace, el título es lo que acompaña al enlace, o el título que mandó la app, o el
 *     dominio, que pasa a ser el de la página cuando llegue (como la captura de la 2.3).
 *   · Sin enlace, es una nota: la primera línea de título y, si hay más (o no cabe), el texto
 *     entero en las notas.
 * `null` si no llegó nada.
 */
export function sharedItem({ title, text, url }: SharedData): SharedItem | null {
  const sentTitle = clean(title)
  const sentText = text?.trim() ?? ''
  const fromUrl = url ? normalizeLink(url) : null
  const inText = captureLink(sentText)
  const linkUrl = fromUrl ?? inText?.url ?? captureLink(sentTitle)?.url ?? null

  if (linkUrl) {
    // Lo que va con el enlace en el texto, sin el enlace (si vino aparte, el texto entero).
    const rest = fromUrl && !inText ? clean(sentText) : (inText?.rest ?? '')
    const titleText = sameAsLink(rest, linkUrl) ? '' : rest
    const fromApp = sameAsLink(sentTitle, linkUrl) ? '' : sentTitle
    return {
      title: (titleText || fromApp || linkDomain(linkUrl)).slice(0, ITEM_TITLE_MAX_LENGTH),
      link: { url: linkUrl, urlTitle: null, urlSite: null, imageUrl: null, price: null },
      notes: null,
    }
  }

  const body = sentText || sentTitle
  if (!body) return null
  const lines = body
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
  const first = clean(lines[0])
  const fits = lines.length === 1 && first.length <= ITEM_TITLE_MAX_LENGTH
  return {
    title: first.slice(0, ITEM_TITLE_MAX_LENGTH),
    link: null,
    notes: fits ? null : body.slice(0, ITEM_NOTES_MAX_LENGTH),
  }
}

function clean(text: string | undefined): string {
  return (text ?? '').replace(/\s+/g, ' ').trim()
}

/** Si un texto no es más que el enlace (con o sin `https://`, «www.» o la barra final). */
function sameAsLink(text: string, url: string): boolean {
  if (!text) return false
  const link = normalizeLink(text)
  return link !== null && link.replace(/\/$/, '') === url.replace(/\/$/, '')
}
