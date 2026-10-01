import { format, isSameDay, subDays } from 'date-fns'

import { formatCents, priceChange, type PriceChange } from '@/lib/money'

import { isActiveSublistStatus, isOutOfMind } from './status'
import type { Item } from './types'

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

/** Lo que oye un lector de pantalla: «ha bajado un 8 %». */
export function changeDescription(change: PriceChange): string {
  return `${change.direction === 'down' ? 'ha bajado' : 'ha subido'} un ${String(change.percent)} %`
}

/**
 * La línea bajo el precio (diseño 16, B1, B7 y D3): la tienda (solo si la web da su nombre), el
 * origen y cuándo. «PcComponentes · de la web · mirado el 30 jul», «Real Madrid CF · de la web ·
 * hoy», «puesto a mano · 21 sep». El origen se dice siempre: explica por qué lo de la web no pisa
 * lo escrito a mano.
 */
export function priceLine(
  item: Pick<Item, 'urlSite' | 'priceSource' | 'priceCheckedAt'>,
  now: Date = new Date(),
): string {
  const web = item.priceSource === 'web' || item.priceSource === 'auto'
  const parts: string[] = []
  if (item.urlSite) parts.push(item.urlSite)
  parts.push(web ? 'de la web' : 'puesto a mano')
  const at = item.priceCheckedAt
  if (at) {
    const day = isSameDay(at, now)
      ? 'hoy'
      : isSameDay(at, subDays(now, 1))
        ? 'ayer'
        : format(at, at.getFullYear() === now.getFullYear() ? 'd MMM' : 'd MMM yyyy')
    parts.push(web && day !== 'hoy' && day !== 'ayer' ? `mirado el ${day}` : day)
  }
  return parts.join(' · ')
}
