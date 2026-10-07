// refresh-prices (sesión 3.8; ADR-007, capa 3): vuelve a mirar el precio de las compras cuya tienda
// lo dio alguna vez y avisa si baja. La llama `pg_cron` cada 10 minutos de 9:00 a 12:00 en Madrid
// (`invoke_refresh_prices`, migración `price_refresh`), con la cabecera `x-cron-secret` de la 2.7;
// sin ella, o con otra, 401. Sin la puerta de JWT (`verify_jwt = false`): la llama la base.
//
// En cada llamada mira unas pocas compras (`price_checks_due`), de una en una y con pausas, con el
// User-Agent de OnMyMind y sin saltarse ningún bloqueo (`_shared/page.ts`). Lo que ve lo guarda
// `record_price_check`: el precio como `auto`, o un fallo más. De las bajadas, el aviso a quien lo
// pidió, con el envío de `_shared/webpush.ts`. Lo puro, en `prices.ts`.

import { createClient } from 'npm:@supabase/supabase-js@2.116.0'

import { allowedUrl } from '../_shared/metadata.ts'
import { fetchPage } from '../_shared/page.ts'
import { deliver } from '../_shared/webpush.ts'
import { pagePrice, planDrops, type PriceDrop, toDueCheck, toPriceDrop } from './prices.ts'

/** Cuántas compras mira cada llamada: con 8 s como mucho por página, cabe de sobra en un minuto. */
const BATCH = 5
/** La pausa entre una página y la siguiente. */
const PAUSE_MS = 1500
/** Un aviso de precio puede esperar: si el móvil está apagado, el servicio lo guarda medio día. */
const DROP_TTL_SECONDS = 12 * 60 * 60

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  { auth: { persistSession: false, autoRefreshToken: false } },
)

/**
 * Qué direcciones se pueden pedir. Siempre las públicas (`allowedUrl`), salvo en las pruebas en local
 * con `REFRESH_PRICES_LOCAL_STORES=true`, que dejan llegar a una tienda falsa en el Mac. Nunca se
 * pone en la nube.
 */
const allow =
  Deno.env.get('REFRESH_PRICES_LOCAL_STORES') === 'true'
    ? (raw: string) => {
        try {
          const url = new URL(raw)
          return url.protocol === 'http:' || url.protocol === 'https:' ? url : null
        } catch {
          return null
        }
      }
    : allowedUrl

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

Deno.serve(async (request) => {
  if (request.method !== 'POST') return json({ error: 'method' }, 405)
  const secret = request.headers.get('x-cron-secret')
  if (!secret) return json({ error: 'secret' }, 401)
  const { data: valid, error: verifyError } = await supabase.rpc('verify_cron_secret', {
    p_secret: secret,
  })
  if (verifyError) return json({ error: 'verify' }, 500)
  if (valid !== true) return json({ error: 'secret' }, 401)

  const { data: due, error: dueError } = await supabase.rpc('price_checks_due', {
    p_limit: BATCH,
  })
  if (dueError) {
    console.error('due', dueError.message)
    return json({ error: 'due' }, 500)
  }
  const checks = ((due ?? []) as unknown[]).map(toDueCheck).filter((check) => check !== null)

  const drops: PriceDrop[] = []
  let prices = 0
  let failures = 0
  for (const [index, check] of checks.entries()) {
    if (index > 0) await sleep(PAUSE_MS)
    const start = allow(check.url)
    let price: { cents: number; currency: string } | null = null
    if (start) {
      try {
        price = pagePrice(await fetchPage(start, allow))
      } catch {
        // Una web caída, lenta o que corta la conexión: un fallo de esta mañana.
      }
    }
    const { data, error } = await supabase.rpc('record_price_check', {
      p_target: check.target,
      p_id: check.id,
      p_price_cents: price?.cents ?? null,
      p_currency: price?.currency ?? 'EUR',
    })
    if (error) {
      console.error('record', error.message)
      continue
    }
    if (price) prices += 1
    else failures += 1
    for (const row of (data ?? []) as unknown[]) {
      const drop = toPriceDrop(row)
      if (drop) drops.push(drop)
    }
  }

  const outbox = planDrops(drops).map(({ userId, message }) => ({
    userId,
    message,
    ttl: DROP_TTL_SECONDS,
    urgent: false,
  }))
  try {
    const { sent, removed } = await deliver(
      supabase,
      Deno.env.get('VAPID_PRIVATE_KEY') ?? '',
      outbox,
    )
    return json({ checked: checks.length, prices, failures, drops: drops.length, sent, removed })
  } catch (error) {
    console.error(String(error))
    return json({ error: 'push' }, 500)
  }
})
