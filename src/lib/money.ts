/**
 * Céntimos → texto en español: «627 €», «9,99 €», «49 US$». Sin decimales cuando son cero, como en
 * el diseño («3 pendientes · 627 €»).
 */
export function formatCents(cents: number, currency = 'EUR'): string {
  const hasDecimals = cents % 100 !== 0
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency,
    minimumFractionDigits: hasDecimals ? 2 : 0,
    maximumFractionDigits: hasDecimals ? 2 : 0,
  }).format(cents / 100)
}

/** El símbolo de una moneda como lo escribe es-ES: «€», «US$», «£». */
export function currencySymbol(currency: string): string {
  return (
    new Intl.NumberFormat('es-ES', { style: 'currency', currency })
      .formatToParts(0)
      .find((part) => part.type === 'currency')?.value ?? currency
  )
}

/** Un precio cabe en `items.price_cents` (`integer`) con mucho margen: diez millones. */
const MAX_PRICE_CENTS = 1_000_000_000

/**
 * Lo escrito en el campo del precio → céntimos (diseño 16, B3–B5). Vale con coma o con punto
 * («9,99», «9.99»), con miles («1.299,50») y con el símbolo («12 €»). Vacío es quitar el precio
 * (`null`); lo que no se entiende es `undefined` («Eso no parece un precio.»).
 */
export function parsePriceInput(text: string): number | null | undefined {
  const value = text.replace(/[\s€]/g, '')
  if (value === '') return null
  if (!/^[\d.,]+$/.test(value)) return undefined
  const cents = amountToCents(value)
  if (cents === null || cents <= 0 || cents > MAX_PRICE_CENTS) return undefined
  return cents
}

/**
 * Un importe con separadores → céntimos. Con los dos, el último es el decimal; con uno solo, es
 * decimal si lo siguen una o dos cifras y de miles si lo siguen tres («1.299» son 1299 €, no 1,30).
 * Es la misma regla que usa `fetch-metadata` con los precios de las webs.
 */
function amountToCents(value: string): number | null {
  const lastDot = value.lastIndexOf('.')
  const lastComma = value.lastIndexOf(',')
  let integer = value
  let decimals = ''
  if (lastDot >= 0 && lastComma >= 0) {
    const at = Math.max(lastDot, lastComma)
    integer = value.slice(0, at)
    decimals = value.slice(at + 1)
    // Antes del decimal solo puede haber miles con el otro separador: «1.299,50», no «1,2,99».
    const thousands = lastDot > lastComma ? ',' : '.'
    if (integer.includes(lastDot > lastComma ? '.' : ',')) return null
    if (
      !integer
        .split(thousands)
        .slice(1)
        .every((part) => part.length === 3)
    )
      return null
  } else if (lastDot >= 0 || lastComma >= 0) {
    const parts = value.split(lastDot >= 0 ? '.' : ',')
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
  if (!/^\d*$/.test(digits) || !/^\d{1,2}$|^$/.test(decimals) || digits + decimals === '')
    return null
  return Number(digits || '0') * 100 + Number(decimals.padEnd(2, '0'))
}

/** Céntimos → lo que se ve en el campo al editar: «9,99», «99» (sin símbolo, que va aparte). */
export function centsToInput(cents: number): string {
  return cents % 100 === 0 ? String(cents / 100) : (cents / 100).toFixed(2).replace('.', ',')
}

export interface PriceChange {
  direction: 'down' | 'up'
  /** En porcentaje entero, al menos 1: un cambio de céntimos no debe decir «0 %». */
  percent: number
}

/** La variación respecto al precio anterior («↓ 8 %»), o `null` si no hay anterior o es igual. */
export function priceChange(previous: number | null, current: number | null): PriceChange | null {
  if (previous === null || current === null || previous <= 0 || previous === current) return null
  const percent = Math.max(1, Math.round((Math.abs(current - previous) / previous) * 100))
  return { direction: current < previous ? 'down' : 'up', percent }
}
