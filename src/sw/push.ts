/**
 * Lo puro del service worker (2.6): qué enseña un push y adónde lleva al tocarlo. Va aparte de
 * `sw.ts` para probarlo con Vitest.
 *
 * El mensaje es el contrato con quien envía (`send-reminders`, 2.7): un JSON con `title` y, si
 * quiere, `body`, `url` (la ruta de la app que abre, `/lists/<lista>?item=<ítem>`) y `tag` (un
 * aviso nuevo del mismo ítem sustituye al anterior en vez de apilarse).
 */
export interface PushMessage {
  title: string
  body?: string
  url?: string
  tag?: string
}

/** Lo que se enseña si el mensaje no se entiende: mejor un aviso genérico que ninguno. */
const FALLBACK: PushMessage = { title: 'OnMyMind', body: 'Tienes algo pendiente.', url: '/today' }

const text = (value: unknown) => (typeof value === 'string' && value.trim() ? value : undefined)

/** El mensaje de un push, a partir de su texto. */
export function parsePush(raw: string | null | undefined): PushMessage {
  if (!raw) return FALLBACK
  let data: unknown
  try {
    data = JSON.parse(raw)
  } catch {
    return FALLBACK
  }
  if (typeof data !== 'object' || data === null) return FALLBACK
  const fields = data as Record<string, unknown>
  const title = text(fields.title)
  if (!title) return FALLBACK
  return {
    title,
    body: text(fields.body),
    url: safePath(text(fields.url)),
    tag: text(fields.tag),
  }
}

/**
 * Solo rutas de la propia app (`/lists/…`): una URL de fuera o con otro esquema lleva a Hoy, así
 * un mensaje raro no abre otra web.
 */
export function safePath(url: string | undefined): string {
  if (!url?.startsWith('/') || url.startsWith('//')) return '/today'
  return url
}

/** Si un mensaje de la app pide activar la versión nueva («Actualizar», modo `prompt` de 1.15). */
export function isSkipWaiting(data: unknown): boolean {
  return (
    typeof data === 'object' &&
    data !== null &&
    (data as Record<string, unknown>).type === 'SKIP_WAITING'
  )
}
