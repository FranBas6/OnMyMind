import { z } from 'zod'

import { supabase } from '@/lib/supabase/client'

import type { PriceRecord } from './types'

/** Una compra cambia de precio pocas veces: con esto sobra (y no se pagina). */
const HISTORY_LIMIT = 200

const recordSchema = z.object({
  price_cents: z.number(),
  currency: z.string(),
  source: z.enum(['manual', 'web', 'auto']),
  recorded_at: z.string(),
})

/**
 * El histórico de una compra, del más antiguo al más reciente (`item_prices_item_idx`). Viene
 * entero, no solo los seis meses de la gráfica: el precio que regía cuando empieza la ventana y el
 * primero de todos («Ahorraste») salen de las filas de antes.
 */
export async function fetchPriceHistory(itemId: string): Promise<PriceRecord[]> {
  const { data, error } = await supabase
    .from('item_prices')
    .select('price_cents, currency, source, recorded_at')
    .eq('item_id', itemId)
    .order('recorded_at')
    .order('id')
    .limit(HISTORY_LIMIT)

  if (error) throw error
  return z
    .array(recordSchema)
    .parse(data)
    .map((row) => ({
      cents: row.price_cents,
      currency: row.currency,
      source: row.source,
      recordedAt: new Date(row.recorded_at),
    }))
}

/**
 * Lo ahorrado (diseño 16, C1): de lo comprado, lo que bajó desde su primer precio, en euros. Lo
 * suma la función `price_savings` en la base, con la RLS de quien pregunta.
 */
export async function fetchSavings(): Promise<number> {
  const { data, error } = await supabase.rpc('price_savings')
  if (error) throw error
  return z.number().int().nonnegative().parse(data)
}
