// Descargar una página como lo hace OnMyMind (04 §fetch-metadata), compartido por `fetch-metadata`
// y `refresh-prices` (3.8). Sin JavaScript, como mucho 8 s y 2 MB, y hasta tres redirecciones, cada
// una revisada para no llegar a direcciones internas (`allowedUrl`). Con un User-Agent que dice
// quién es: nunca se hace pasar por un navegador ni intenta saltarse un bloqueo (ADR-007).

import { allowedUrl } from './metadata.ts'

const TIMEOUT_MS = 8000
// IKEA pone su `Product` pasado el primer mega de la página (2.1).
const MAX_BYTES = 2_000_000
const MAX_REDIRECTS = 3
export const USER_AGENT = 'Mozilla/5.0 (compatible; OnMyMindBot/1.0; +https://onmymind.pages.dev)'

/** Una página leída, o un enlace que resultó ser una imagen. */
export type FetchedPage = { html: string; url: string; image?: undefined } | { image: string }

/**
 * La página en HTML, siguiendo como mucho tres redirecciones; si la URL es una imagen, su dirección;
 * `null` si no es ninguna de las dos o la web no deja pasar (un 403, la comprobación de robots…).
 * `allow` revisa cada dirección; solo las pruebas en local la cambian, para una tienda falsa en el
 * Mac.
 */
export async function fetchPage(
  start: URL,
  allow: (raw: string) => URL | null = allowedUrl,
): Promise<FetchedPage | null> {
  const signal = AbortSignal.timeout(TIMEOUT_MS)
  let url = start
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const response = await fetch(url, {
      redirect: 'manual',
      signal,
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'text/html,application/xhtml+xml',
        'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
      },
    })
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location')
      await response.body?.cancel()
      const next = location ? allow(new URL(location, url).href) : null
      if (!next) return null
      url = next
      continue
    }
    const type = response.headers.get('content-type') ?? ''
    if (response.ok && /^image\/(jpeg|png|webp|gif|avif)/i.test(type)) {
      await response.body?.cancel()
      return { image: url.href }
    }
    if (!response.ok || !/html/i.test(type)) {
      await response.body?.cancel()
      return null
    }
    return { html: await readLimited(response, type), url: url.href }
  }
  return null
}

/**
 * Lee hasta 2 MB, en la codificación que diga la cabecera (o UTF-8). Sigue tras el `<head>`: el
 * JSON-LD del producto, con su precio, suele ir en el cuerpo (2.1).
 */
async function readLimited(response: Response, type: string): Promise<string> {
  const charset = /charset=([^;]+)/i.exec(type)?.[1]?.trim() ?? 'utf-8'
  let decoder: TextDecoder
  try {
    decoder = new TextDecoder(charset)
  } catch {
    decoder = new TextDecoder('utf-8')
  }
  const reader = response.body?.getReader()
  if (!reader) return ''
  let html = ''
  let bytes = 0
  while (bytes < MAX_BYTES) {
    const { done, value } = await reader.read()
    if (done) break
    bytes += value.byteLength
    html += decoder.decode(value, { stream: true })
  }
  await reader.cancel()
  return html + decoder.decode()
}
