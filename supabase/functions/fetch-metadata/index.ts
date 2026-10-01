// fetch-metadata (04 §Backend, sesión 2a.6): el título y la imagen de una página, para enseñar un
// enlace pegado en un ítem («Camiseta 1.ª equipación» y su foto). El navegador no puede leer otra
// web (CORS), así que lo hace esta función.
//
// Entrada `{ url }`; salida `{ title, image, siteName, domain }` (todo puede ser `null`). Sin
// JavaScript, como mucho 8 s, 1 MB y tres redirecciones, cada una revisada (`allowedUrl`). Pide
// sesión: la puerta de Supabase verifica el JWT (`verify_jwt`, por defecto), así no sirve de proxy
// abierto. El precio (JSON-LD `Product`) llega con Compras (2.1).

import { allowedUrl, parseMetadata, type PageMetadata } from './metadata.ts'

const TIMEOUT_MS = 8000
const MAX_BYTES = 1_000_000
const MAX_REDIRECTS = 3
const USER_AGENT = 'Mozilla/5.0 (compatible; OnMyMindBot/1.0; +https://onmymind.pages.dev)'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const EMPTY: PageMetadata = { title: null, image: null, siteName: null }

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (request.method !== 'POST') return json({ error: 'method' }, 405)

  let raw: unknown
  try {
    raw = ((await request.json()) as { url?: unknown }).url
  } catch {
    return json({ error: 'body' }, 400)
  }
  const start = typeof raw === 'string' ? allowedUrl(raw) : null
  if (!start) return json({ error: 'url' }, 400)

  const domain = start.hostname.replace(/^www\./, '')
  try {
    const page = await fetchPage(start)
    if (!page) return json({ ...EMPTY, domain })
    // El enlace es una imagen («Copiar dirección de la imagen»): esa es la foto.
    if (page.image) return json({ ...EMPTY, image: page.image, domain })
    return json({ ...parseMetadata(page.html, page.url), domain })
  } catch {
    // Una web caída, lenta o que no deja pasar: se queda el dominio, sin error (diseño 15, M5).
    return json({ ...EMPTY, domain })
  }
})

/**
 * La página en HTML, siguiendo como mucho tres redirecciones; si la URL es una imagen, su dirección;
 * `null` si no es ninguna de las dos o falla.
 */
async function fetchPage(
  start: URL,
): Promise<{ html: string; url: string; image?: undefined } | { image: string } | null> {
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
      const next = location ? allowedUrl(new URL(location, url).href) : null
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

/** Lee hasta 1 MB, en la codificación que diga la cabecera (o UTF-8). */
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
    // Con el `<head>` ya leído no hace falta el resto de la página.
    if (/<\/head\s*>/i.test(html)) break
  }
  await reader.cancel()
  return html + decoder.decode()
}
