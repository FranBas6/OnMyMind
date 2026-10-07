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
  store: z.string().nullable(),
})

/**
 * El histórico de una compra, del más antiguo al más reciente (`item_prices_item_idx`). Viene
 * entero, no solo los seis meses de la gráfica: el precio que regía cuando empieza la ventana y el
 * primero de todos («Ahorraste») salen de las filas de antes.
 */
export async function fetchPriceHistory(itemId: string): Promise<PriceRecord[]> {
  const { data, error } = await supabase
    .from('item_prices')
    .select('price_cents, currency, source, recorded_at, store')
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
      store: row.store,
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

/**
 * Las compras en las que pediste «Avisarme si baja» (3.8): solo las tuyas (RLS). Pocas, todas de
 * una vez.
 */
export async function fetchPriceAlerts(): Promise<string[]> {
  const { data, error } = await supabase.from('price_alerts').select('item_id')
  if (error) throw error
  return data.map((row) => row.item_id)
}

/**
 * Pide o deja de pedir el aviso de una compra. Se puede repetir sin efecto (al volver la red, la
 * cola de la 2.10 lo reenvía): pedirlo dos veces no duplica y quitarlo dos veces no falla.
 */
export async function setPriceAlert(itemId: string, userId: string, on: boolean): Promise<void> {
  const { error } = on
    ? await supabase
        .from('price_alerts')
        .upsert({ item_id: itemId, user_id: userId }, { ignoreDuplicates: true })
    : await supabase.from('price_alerts').delete().eq('item_id', itemId).eq('user_id', userId)
  if (error) throw error
}

/** Una compra que bajó sola esta mañana (diseño 22, N3). */
export interface PriceDrop {
  itemId: string
  listId: string
  listName: string
  title: string
  store: string | null
  imageUrl: string | null
  imagePath: string | null
  priceCents: number
  previousPriceCents: number
  currency: string
}

/** «Bajaron esta mañana»: tus compras con «Avisarme si baja» que bajaron solas hoy. */
export async function fetchPriceDrops(): Promise<PriceDrop[]> {
  const { data, error } = await supabase.rpc('my_price_drops')
  if (error) throw error
  return data.map((row) => ({
    itemId: row.item_id,
    listId: row.list_id,
    listName: row.list_name,
    title: row.title,
    store: row.store,
    imageUrl: row.image_url,
    imagePath: row.image_path,
    priceCents: row.price_cents,
    previousPriceCents: row.previous_price_cents,
    currency: row.currency,
  }))
}
