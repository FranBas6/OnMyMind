// Lo que se saca de una página para enseñar un enlace (04 §fetch-metadata): título, imagen y
// nombre del sitio, de las etiquetas OpenGraph (y Twitter, o `<title>`, si no las hay), y el precio
// de un producto por capas (ADR-007, sesión 2.1). Es puro, sin Deno ni red, para probarlo con
// Vitest desde la app.

export interface PagePrice {
  /** En céntimos, como `items.price_cents`. */
  cents: number
  /** ISO 4217 («EUR», «USD»). Sin moneda no hay precio: nunca se adivina. */
  currency: string
}

export interface PageMetadata {
  title: string | null
  image: string | null
  siteName: string | null
  price: PagePrice | null
}

/** Un título cabe en `items.url_title` (300). */
const MAX_TITLE = 300
/** Las etiquetas útiles están en el `<head>`; si no se cierra, no se mira más allá de esto. */
const MAX_HEAD = 512 * 1024
/** Un precio por encima de esto es un error de la página (y no cabe en un `integer` de céntimos). */
const MAX_PRICE_CENTS = 1_000_000_000

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
  const siteName = clean(meta.get('og:site_name') ?? meta.get('og:sitename'))
  let title = clean(meta.get('og:title') ?? meta.get('twitter:title') ?? titleTag)
  let image = absoluteUrl(
    meta.get('og:image:secure_url') ??
      meta.get('og:image') ??
      meta.get('og:image:url') ??
      meta.get('twitter:image') ??
      meta.get('twitter:image:src'),
    pageUrl,
  )
  // Un OpenGraph genérico (Amazon da «Amazon» y su logo en cada producto) es peor que nada: con el
  // dominio y una foto puesta a mano se ve mejor. Si el título es solo el nombre de la web, la
  // imagen tampoco es la de la cosa.
  if (title && isSiteName(title, siteName, pageUrl)) {
    title = null
    image = null
  }
  if (image && isLogo(image)) image = null
  return { title, image, siteName, price: parsePrice(html, meta) }
}

/** Si un título es solo el nombre de la web («Amazon» en amazon.es, o su `og:site_name`). */
function isSiteName(title: string, siteName: string | null, pageUrl: string): boolean {
  const key = (text: string) => text.toLowerCase().replace(/[^a-z0-9]/g, '')
  const host = hostOf(pageUrl)?.replace(/^www\./, '') ?? ''
  const brand = host.split('.').at(-2) ?? host
  return key(title) === key(siteName ?? '') || (brand !== '' && key(title) === key(brand))
}

/** El logo o el icono para compartir de la web, no una foto de lo enlazado. */
function isLogo(image: string): boolean {
  const path = new URL(image).pathname.toLowerCase()
  const file = path.split('/').at(-1) ?? ''
  return /share-icons|favicon/.test(path) || /(^|[-_.])logo([-_.]|$)/.test(file)
}

function hostOf(url: string): string | null {
  try {
    return new URL(url).hostname.toLowerCase()
  } catch {
    return null
  }
}

/**
 * El precio de un producto, por capas, de la más fiable a la menos (ADR-007, capa 2):
 * 1. JSON-LD `Product` (suelto, en una lista o dentro de `@graph`): su `offers`.
 * 2. Las meta de producto de Facebook y Shopify (`product:price:amount`) y `og:price:amount`.
 * 3. Microdatos: `itemprop="price"` con su `priceCurrency`.
 * Sin moneda, o con un importe que no se entiende, no hay precio.
 */
export function parsePrice(html: string, meta = new Map<string, string>()): PagePrice | null {
  return (
    jsonLdPrice(html) ??
    metaPrice(meta, 'product:price') ??
    metaPrice(meta, 'og:price') ??
    microdataPrice(html)
  )
}

function jsonLdPrice(html: string): PagePrice | null {
  for (const match of html.matchAll(
    /<script\b[^>]*type\s*=\s*["']?application\/ld\+json["']?[^>]*>([\s\S]*?)<\/script>/gi,
  )) {
    const body = (match[1] ?? '').replace(/^\s*(<!--|<!\[CDATA\[)|(-->|\]\]>)\s*$/g, '')
    let data: unknown
    try {
      data = JSON.parse(body)
    } catch {
      continue
    }
    for (const product of products(data)) {
      const price = offerPrice(product.offers)
      if (price) return price
    }
  }
  return null
}

type Json = Record<string, unknown>
const isObject = (value: unknown): value is Json =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
const asList = (value: unknown): unknown[] => (Array.isArray(value) ? value : [value])

/**
 * Los `Product` de un bloque JSON-LD, estén donde estén: sueltos, en una lista, dentro de `@graph`,
 * como variantes de un `ProductGroup` o como `object` de una acción (MediaMarkt, `BuyAction`).
 */
function products(data: unknown, depth = 0): Json[] {
  if (depth > 6) return []
  const found: Json[] = []
  for (const node of asList(data)) {
    if (!isObject(node)) continue
    const types = asList(node['@type']).map((type) => String(type).toLowerCase())
    if (types.includes('product')) found.push(node)
    for (const [key, value] of Object.entries(node)) {
      if (key !== 'offers' && typeof value === 'object' && value !== null)
        found.push(...products(value, depth + 1))
    }
  }
  return found
}

/** El precio de unas `offers`: la primera oferta con importe y moneda, o el mínimo de un `AggregateOffer`. */
function offerPrice(offers: unknown, depth = 0): PagePrice | null {
  if (depth > 3) return null
  for (const offer of asList(offers)) {
    if (!isObject(offer)) continue
    const currency = offer.priceCurrency
    const direct =
      toPrice(offer.price, currency) ??
      toPrice(offer.lowPrice, currency) ??
      asList(offer.priceSpecification)
        .filter(isObject)
        .map((spec) => toPrice(spec.price, spec.priceCurrency ?? currency))
        .find((price) => price !== null) ??
      null
    if (direct) return direct
    if (offer.offers !== undefined) {
      const nested = offerPrice(offer.offers, depth + 1)
      if (nested) return nested
    }
  }
  return null
}

function metaPrice(meta: Map<string, string>, prefix: string): PagePrice | null {
  return toPrice(meta.get(`${prefix}:amount`), meta.get(`${prefix}:currency`))
}

function microdataPrice(html: string): PagePrice | null {
  let amount: string | undefined
  let currency: string | undefined
  for (const tag of html.match(
    /<[a-z][^>]*\bitemprop\s*=\s*["']?price(?:currency)?["'\s>][^>]*>/gi,
  ) ?? []) {
    const attributes = readAttributes(tag)
    const prop = attributes.itemprop?.toLowerCase()
    if (prop === 'price' && amount === undefined) amount = attributes.content
    if (prop === 'pricecurrency' && currency === undefined) currency = attributes.content
  }
  return toPrice(amount, currency)
}

const CURRENCY_SYMBOLS: Record<string, string> = { '€': 'EUR', '£': 'GBP' }

/** Un importe y una moneda de la página → precio, o `null` si falta algo o no tiene sentido. */
function toPrice(amount: unknown, currency: unknown): PagePrice | null {
  const code = typeof currency === 'string' ? currency.trim() : ''
  const iso = CURRENCY_SYMBOLS[code] ?? code.toUpperCase()
  if (!/^[A-Z]{3}$/.test(iso)) return null
  const cents =
    typeof amount === 'number'
      ? Math.round(amount * 100)
      : typeof amount === 'string'
        ? amountToCents(amount)
        : null
  if (cents === null || !Number.isSafeInteger(cents) || cents <= 0 || cents > MAX_PRICE_CENTS)
    return null
  return { cents, currency: iso }
}

/**
 * «100.00», «1299», «1.299,50», «1,299.50», «19,99 €» → céntimos. Con los dos separadores, el
 * último es el decimal; con uno solo, es decimal si lo siguen una o dos cifras y de miles si lo
 * siguen tres («1.299» son 1299 €, no 1,30).
 */
export function amountToCents(text: string): number | null {
  const value = text.replace(/[^\d.,]/g, '')
  if (!/\d/.test(value)) return null
  const lastDot = value.lastIndexOf('.')
  const lastComma = value.lastIndexOf(',')
  let integer = value
  let decimals = ''
  if (lastDot >= 0 && lastComma >= 0) {
    const at = Math.max(lastDot, lastComma)
    integer = value.slice(0, at)
    decimals = value.slice(at + 1)
  } else if (lastDot >= 0 || lastComma >= 0) {
    const separator = lastDot >= 0 ? '.' : ','
    const parts = value.split(separator)
    const tail = parts.at(-1) ?? ''
    if (parts.length === 2 && tail.length > 0 && tail.length <= 2) {
      integer = parts[0] ?? ''
      decimals = tail
    } else if (parts.slice(1).every((part) => part.length === 3)) {
      integer = parts.join('')
    } else {
      return null
    }
  }
  const digits = integer.replace(/[.,]/g, '')
  if (!/^\d+$/.test(digits || '0') || !/^\d{0,2}$/.test(decimals)) return null
  return Number(digits || '0') * 100 + Number(decimals.padEnd(2, '0'))
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

/**
 * El rol del JWT que trae la petición. La firma ya la ha comprobado la puerta (`verify_jwt`), así
 * que basta con leer su contenido: la clave `anon` dice `anon`; una sesión, `authenticated`.
 */
export function isUserToken(header: string | null): boolean {
  const payload = header?.replace(/^Bearer\s+/i, '').split('.')[1]
  if (!payload) return false
  try {
    const claims: unknown = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')))
    return (
      typeof claims === 'object' &&
      claims !== null &&
      (claims as { role?: unknown }).role === 'authenticated'
    )
  } catch {
    return false
  }
}
