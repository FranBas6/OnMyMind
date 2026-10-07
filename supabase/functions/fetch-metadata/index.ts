// fetch-metadata (04 §Backend, sesiones 2a.6 y 2.1): el título, la imagen y el precio de una
// página, para enseñar un enlace pegado en un ítem («Camiseta 1.ª equipación», su foto y 100 €).
// El navegador no puede leer otra web (CORS), así que lo hace esta función.
//
// Entrada `{ url }`; salida `{ title, image, siteName, price, domain }` (todo puede ser `null`).
// Sin JavaScript, como mucho 8 s, 2 MB y tres redirecciones, cada una revisada (`allowedUrl`): la
// descarga y la lectura son las de `_shared/`, que comparte con `refresh-prices`.
// Pide la sesión de un usuario: la puerta de Supabase verifica la firma del JWT (`verify_jwt`), pero
// también deja pasar la clave pública `anon`, que va en la app; por eso aquí se mira además que el
// token sea de alguien con sesión (`role = authenticated`). Así no sirve de proxy abierto.

import { allowedUrl, isUserToken, parseMetadata, type PageMetadata } from '../_shared/metadata.ts'
import { fetchPage } from '../_shared/page.ts'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const EMPTY: PageMetadata = { title: null, image: null, siteName: null, price: null }

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (request.method !== 'POST') return json({ error: 'method' }, 405)
  if (!isUserToken(request.headers.get('authorization'))) return json({ error: 'session' }, 401)

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
