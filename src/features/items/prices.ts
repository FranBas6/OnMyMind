import { format, isSameDay, subDays } from 'date-fns'

import { formatCents, priceChange, type PriceChange } from '@/lib/money'

import { isActiveSublistStatus, isOutOfMind } from './status'
import type { Item } from './types'

/** Menos de esto es «ahora». */
const JUST_NOW_MS = 2 * 60 * 1000

/** Lo que suman las compras pendientes con precio: los euros y, aparte, otras monedas. */
export interface PriceTotals {
  /** En céntimos de euro: es lo que dice el total («Total 627 €»). */
  euros: number
  /** Cada moneda que no suma, con lo suyo («y 49 US$ aparte»). */
  others: { currency: string; cents: number }[]
}

/**
 * El total de una lista o de una sublista (diseño 16, A1–A3), con las reglas de `list_counters`:
 * las compras pendientes con precio, en cualquier lista (decisión 6 del plan), y nada de lo de
 * dentro de una sublista pausada o hecha. Solo suman los euros; lo demás va aparte (decisión 7).
 */
export function pendingTotals(items: readonly Item[], now: Date = new Date()): PriceTotals {
  const silenced = new Set(
    items
      .filter((item) => item.kind === 'sublist' && !isActiveSublistStatus(item.status))
      .map((item) => item.id),
  )
  const totals: PriceTotals = { euros: 0, others: [] }
  for (const item of items) {
    if (item.kind !== 'shopping' || item.priceCents === null || isOutOfMind(item, now)) continue
    if (item.parentId !== null && silenced.has(item.parentId)) continue
    if (item.currency === 'EUR') {
      totals.euros += item.priceCents
      continue
    }
    const other = totals.others.find((entry) => entry.currency === item.currency)
    if (other) other.cents += item.priceCents
    else totals.others.push({ currency: item.currency, cents: item.priceCents })
  }
  return totals
}

/** «y 49 US$ aparte», o `null` si todo va en euros. */
export function othersLabel(others: PriceTotals['others']): string | null {
  if (others.length === 0) return null
  return `y ${others.map((entry) => formatCents(entry.cents, entry.currency)).join(' y ')} aparte`
}

/**
 * Si alguna fila de estas lleva precio: en escritorio todas reservan su columna, para que las de
 * tareas no se muevan (diseño 16, D2). Una lista sin precios se ve como antes.
 */
export function hasPrices(items: readonly Item[]): boolean {
  return items.some((item) => item.kind === 'shopping' && item.priceCents !== null)
}

/** El precio de una compra y su variación, o `null` si no es una compra con precio. */
export function itemPrice(item: Item): { text: string; change: PriceChange | null } | null {
  if (item.kind !== 'shopping' || item.priceCents === null) return null
  return {
    text: formatCents(item.priceCents, item.currency),
    change: priceChange(item.previousPriceCents, item.priceCents),
  }
}

/** «↓ 8 %» / «↑ 3 %»: la variación en la fila, en texto. */
export function changeLabel(change: PriceChange): string {
  return `${change.direction === 'down' ? '↓' : '↑'} ${String(change.percent)} %`
}

/**
 * El chip de un precio que se miró solo (diseño 22, P2): lo que cambió en euros y en porcentaje,
 * «↓ 20 € · 20 %».
 */
export function changeAmountLabel(
  change: PriceChange,
  previous: number,
  current: number,
  currency: string,
): string {
  const arrow = change.direction === 'down' ? '↓' : '↑'
  return `${arrow} ${formatCents(Math.abs(previous - current), currency)} · ${String(change.percent)} %`
}

/** Lo que oye un lector de pantalla: «ha bajado un 8 %». */
export function changeDescription(change: PriceChange): string {
  return `${change.direction === 'down' ? 'ha bajado' : 'ha subido'} un ${String(change.percent)} %`
}

/** De dónde salió un precio, como lo dice su línea (diseño 22): el reloj, ↻ o el lápiz. */
export type OriginKind = 'auto' | 'web' | 'manual' | 'stopped'

export interface PriceOrigin {
  kind: OriginKind
  /**
   * «comprobado solo · hoy», «bajó esta mañana · comprobado solo», «de la web · mirado el 30 jul»,
   * «puesto a mano · 21 sep». Si ya no se puede seguir, lo de después de «Ya no se puede seguir»:
   * «último precio el 3 oct» o, en una tienda, «desde el 3 oct».
   */
  text: string
}

/** «ahora», «hoy», «ayer», «30 jul» (o «30 jul 2025» si es de otro año). */
function dayLabel(at: Date, now: Date): string {
  if (now.getTime() - at.getTime() < JUST_NOW_MS) return 'ahora'
  if (isSameDay(at, now)) return 'hoy'
  if (isSameDay(at, subDays(now, 1))) return 'ayer'
  return format(at, at.getFullYear() === now.getFullYear() ? 'd MMM' : 'd MMM yyyy')
}

/**
 * El origen de un precio (diseños 16 y 22): se dice siempre, porque explica por qué lo de la web
 * no pisa lo escrito a mano y si se mira solo. `morning` es si cambió solo esta mañana
 * (`morningChange`); `store` cambia «último precio el» por «desde el» en las tiendas (T1).
 */
export function priceOrigin(
  price: Pick<Item, 'priceSource' | 'priceCheckedAt' | 'priceTracking'>,
  morning: 'down' | 'up' | null = null,
  now: Date = new Date(),
  store = false,
): PriceOrigin {
  const at = price.priceCheckedAt
  if (price.priceTracking === 'stopped') {
    const day = at ? dayLabel(at, now) : null
    const text = !day
      ? ''
      : ['ahora', 'hoy', 'ayer'].includes(day)
        ? `${store ? 'desde' : 'último precio'} ${day}`
        : `${store ? 'desde el' : 'último precio el'} ${day}`
    return { kind: 'stopped', text }
  }
  if (price.priceSource === 'auto') {
    if (morning) {
      return {
        kind: 'auto',
        text: `${morning === 'down' ? 'bajó' : 'subió'} esta mañana · comprobado solo`,
      }
    }
    return { kind: 'auto', text: at ? `comprobado solo · ${dayLabel(at, now)}` : 'comprobado solo' }
  }
  if (price.priceSource === 'web') {
    if (!at) return { kind: 'web', text: 'de la web' }
    const day = dayLabel(at, now)
    // Recién mirado («de la web · ahora», diseño 16, B11 y B12).
    return {
      kind: 'web',
      text: `de la web · ${['ahora', 'hoy', 'ayer'].includes(day) ? day : `mirado el ${day}`}`,
    }
  }
  return { kind: 'manual', text: at ? `puesto a mano · ${dayLabel(at, now)}` : 'puesto a mano' }
}

/**
 * La línea bajo el precio (diseño 16, B1, B7 y D3): la tienda (solo si la web da su nombre), el
 * origen y cuándo. «PcComponentes · de la web · mirado el 30 jul», «Real Madrid CF · de la web ·
 * hoy», «puesto a mano · 21 sep» y, desde la 3.8, «Keychron · comprobado solo · hoy».
 */
export function priceLine(
  item: Pick<Item, 'urlSite' | 'priceSource' | 'priceCheckedAt'> &
    Partial<Pick<Item, 'priceTracking'>>,
  now: Date = new Date(),
): string {
  const origin = priceOrigin({ priceTracking: null, ...item }, null, now)
  return [item.urlSite, origin.text].filter(Boolean).join(' · ')
}
