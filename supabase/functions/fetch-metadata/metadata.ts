// Lo que se saca de una página para enseñar un enlace (04 §fetch-metadata): título, imagen y
// nombre del sitio, de las etiquetas OpenGraph (y Twitter, o `<title>`, si no las hay). Es puro, sin
// Deno ni red, para probarlo con Vitest desde la app.

export interface PageMetadata {
  title: string | null
  image: string | null
  siteName: string | null
}

/** Un título cabe en `items.url_title` (300). */
const MAX_TITLE = 300
/** Las etiquetas útiles están en el `<head>`: no hace falta mirar más. */
const MAX_HEAD = 512 * 1024

export function parseMetadata(html: string, pageUrl: string): PageMetadata {
  const headEnd = html.search(/<\/head\s*>/i)
  const head = html.slice(0, headEnd >= 0 ? headEnd : MAX_HEAD)

  const meta = new Map<string, string>()
  for (const tag of head.match(/<meta\b[^>]*>/gi) ?? []) {
    const attributes = readAttributes(tag)
    const key = (attributes.property ?? attributes.name ?? '').toLowerCase()
    const content = attributes.content
    // La primera gana: es la que ve quien comparte el enlace.
    if (key && content !== undefined && !meta.has(key)) meta.set(key, content)
  }

  const titleTag = /<title\b[^>]*>([\s\S]*?)<\/title>/i.exec(head)?.[1]
  const title = clean(meta.get('og:title') ?? meta.get('twitter:title') ?? titleTag)
  const image = absoluteUrl(
    meta.get('og:image:secure_url') ??
      meta.get('og:image') ??
      meta.get('og:image:url') ??
      meta.get('twitter:image') ??
      meta.get('twitter:image:src'),
    pageUrl,
  )
  return { title, image, siteName: clean(meta.get('og:site_name')) }
}

/** Los atributos de una etiqueta, con comillas dobles, simples o sin ellas. */
function readAttributes(tag: string): Record<string, string> {
  const attributes: Record<string, string> = {}
  for (const match of tag.matchAll(/([a-zA-Z_:.-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/g)) {
    const name = match[1]?.toLowerCase()
    if (name) attributes[name] = decodeEntities(match[2] ?? match[3] ?? match[4] ?? '')
  }
  return attributes
}

const NAMED: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
}

function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (entity, code: string) => {
    if (code[0] === '#') {
      const value =
        code[1]?.toLowerCase() === 'x' ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10)
      return Number.isFinite(value) && value > 0 && value <= 0x10ffff
        ? String.fromCodePoint(value)
        : entity
    }
    return NAMED[code.toLowerCase()] ?? entity
  })
}

/** Sin espacios de más ni saltos; vacío es «no hay». */
function clean(text: string | undefined): string | null {
  if (text === undefined) return null
  const value = decodeEntities(text).replace(/\s+/g, ' ').trim()
  return value ? value.slice(0, MAX_TITLE) : null
}

/** Una imagen relativa («/img/camiseta.jpg») se resuelve contra la página; solo http(s). */
function absoluteUrl(value: string | undefined, base: string): string | null {
  if (!value?.trim()) return null
  try {
    const url = new URL(value.trim(), base)
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : null
  } catch {
    return null
  }
}

/**
 * Si se puede pedir esa URL: http o https, sin usuario ni contraseña, puertos normales y nunca
 * hacia la máquina o la red interna (que la función no sirva para curiosear donde corre).
 */
export function allowedUrl(raw: string): URL | null {
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    return null
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null
  if (url.username || url.password) return null
  if (url.port && url.port !== '80' && url.port !== '443') return null
  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, '')
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local')) return null
  if (host.endsWith('.internal') || (!host.includes('.') && !host.includes(':'))) return null
  if (isPrivateIp(host)) return null
  return url
}

function isPrivateIp(host: string): boolean {
  const v4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host)
  if (v4) {
    const [a, b] = [Number(v4[1]), Number(v4[2])]
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 100 && b >= 64 && b <= 127)
    )
  }
  if (host.includes(':')) {
    return (
      host === '::1' ||
      host === '::' ||
      /^f[cd]/.test(host) ||
      /^fe[89ab]/.test(host) ||
      host.startsWith('::ffff:')
    )
  }
  return false
}
