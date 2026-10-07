import { addMonths, format, isSameDay, startOfMonth, subMonths } from 'date-fns'

import type { PriceRecord, PriceSource } from './types'

/** La gráfica enseña los últimos seis meses (diseño 16, B1: «Histórico de precios · 6 meses»). */
export const HISTORY_MONTHS = 6

/** Un punto de la gráfica en escalón: el precio vale desde `at` hasta el siguiente. */
export interface ChartPoint {
  /** En milisegundos (el eje es de tiempo). */
  at: number
  cents: number
  source: PriceSource
  /** Desde cuándo vale ese precio: lo que dice la etiqueta al tocar el punto. */
  since: number
  /** De qué tienda era, si se sabe (2.2b). */
  store: string | null
  /**
   * Un cambio de precio de verdad, con su punto en la gráfica. Los de los bordes no lo son: el
   * precio que ya regía cuando empieza la ventana y el de hoy, que alargan la línea.
   */
  change: boolean
}

export interface PriceChartData {
  points: ChartPoint[]
  /** Inicio y fin del eje: hace seis meses y ahora. */
  domain: [number, number]
  /** Las marcas del eje: el día 1 de cada mes, con su nombre («abr», «may»). */
  ticks: { at: number; label: string }[]
}

/** Lo que dice la compra de su precio de ahora, para que la gráfica acabe en él aunque falte su fila. */
export interface CurrentPrice {
  cents: number
  currency: string
  source: PriceSource
  checkedAt: Date | null
  store?: string | null
}

/**
 * Los puntos de la gráfica (diseño 16, B1 y B17): uno por cada cambio de los últimos seis meses,
 * el precio que regía cuando empezó la ventana (sin punto) y la línea hasta hoy. Solo cuenta la
 * moneda actual. Si el precio de ahora aún no está en el histórico (se acaba de cambiar sin red),
 * se añade, así lo optimista ya se ve.
 */
export function chartData(
  records: readonly PriceRecord[],
  current: CurrentPrice,
  now: Date = new Date(),
): PriceChartData {
  const start = subMonths(now, HISTORY_MONTHS).getTime()
  const end = now.getTime()
  const rows = records
    .filter((record) => record.currency === current.currency)
    .map((record) => ({
      at: record.recordedAt.getTime(),
      since: record.recordedAt.getTime(),
      cents: record.cents,
      source: record.source,
      store: record.store,
    }))
    .filter((row) => row.at <= end)

  const last = rows.at(-1)
  if (last?.cents !== current.cents) {
    const at = Math.min(current.checkedAt?.getTime() ?? end, end)
    rows.push({
      at,
      since: at,
      cents: current.cents,
      source: current.source,
      store: current.store ?? null,
    })
  }

  const before = rows.filter((row) => row.at < start).at(-1)
  const inside = rows.filter((row) => row.at >= start)
  const points: ChartPoint[] = [
    ...(before ? [{ ...before, at: start, change: false }] : []),
    ...inside.map((row) => ({ ...row, change: true })),
  ]
  const latest = points.at(-1)
  if (latest && latest.at < end) points.push({ ...latest, at: end, change: false })

  return { points, domain: [start, end], ticks: monthTicks(now) }
}

/** El día 1 de cada uno de los seis últimos meses, con su nombre en minúscula y sin punto. */
function monthTicks(now: Date): { at: number; label: string }[] {
  const first = startOfMonth(subMonths(now, HISTORY_MONTHS - 1))
  return Array.from({ length: HISTORY_MONTHS }, (_, index) => {
    const month = addMonths(first, index)
    return { at: month.getTime(), label: format(month, 'MMM').replace('.', '') }
  })
}

/**
 * El primer precio de una compra (el de su primera fila en esta moneda), o `null` si no hay
 * histórico. Con él salen «desde 302 €, su primer precio» y «Ahorraste 43 €» (diseño 16, B18).
 */
export function firstPrice(records: readonly PriceRecord[], currency: string): number | null {
  return records.find((record) => record.currency === currency)?.cents ?? null
}

/** Lo que ahorraste en una compra: lo que bajó desde su primer precio, o 0. */
export function savedCents(first: number | null, paid: number): number {
  return first !== null && first > paid ? first - paid : 0
}

/** Lo que pasó esta mañana con el precio de una compra (diseño 22, P2–P4). */
export interface MorningChange {
  direction: 'down' | 'up'
  /** El precio de antes, con su origen: si era a mano, la web lo ha sustituido (P4). */
  before: PriceRecord
  /** El de ahora: con varias tiendas, `store` dice cuál bajó (T1). */
  after: PriceRecord
}

/**
 * Si el último cambio del precio lo hizo la consulta de esta mañana (`auto` y de hoy): si bajó o
 * subió, y desde qué. `null` si no cambió solo hoy.
 */
export function morningChange(
  records: readonly PriceRecord[],
  currency: string,
  now: Date = new Date(),
): MorningChange | null {
  const rows = records.filter((record) => record.currency === currency)
  const after = rows.at(-1)
  const before = rows.at(-2)
  if (!after || !before || after.source !== 'auto' || !isSameDay(after.recordedAt, now)) {
    return null
  }
  if (after.cents === before.cents) return null
  return { direction: after.cents < before.cents ? 'down' : 'up', before, after }
}
