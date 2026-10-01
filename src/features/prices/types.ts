/** De dónde salió un precio (`price_source`, 03 §item_prices). */
export type PriceSource = 'manual' | 'web' | 'auto'

/** Una fila del histórico de precios de una compra. */
export interface PriceRecord {
  cents: number
  currency: string
  source: PriceSource
  recordedAt: Date
}
