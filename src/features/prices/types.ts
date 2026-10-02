/** De dónde salió un precio (`price_source`, 03 §item_prices). */
export type PriceSource = 'manual' | 'web' | 'auto'

/** Una fila del histórico de precios de una compra. */
export interface PriceRecord {
  cents: number
  currency: string
  source: PriceSource
  recordedAt: Date
  /** De qué tienda era (2.2b): lo dice la etiqueta al tocar un punto de la gráfica. */
  store: string | null
}
