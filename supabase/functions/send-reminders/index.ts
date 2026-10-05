// send-reminders (04 §send-reminders, sesión 2.7): envía los avisos vencidos y el resumen de Hoy.
// La llama `pg_cron` cada minuto con `pg_net` (migración `send_reminders_cron`), con la cabecera
// `x-cron-secret`; sin ella, o con otra, 401. No pasa por la puerta de JWT de Supabase
// (`verify_jwt = false` en config.toml): quien llama es la base, no un usuario.
//
// Dentro usa `service_role` (la ponen las edge functions en el entorno, nunca sale de aquí): tiene
// que leer los avisos y las suscripciones de todos. Lo que toca enviar lo reclaman
// `claim_due_reminders` y `claim_daily_summaries`, que lo marcan a la vez; los textos salen de
// `messages.ts`. Push con `@negrel/webpush` (WebCrypto, sin Node; cierra el punto de 08): el
// `web-push` de npm no funciona en el edge runtime.

import { createClient } from 'npm:@supabase/supabase-js@2.116.0'
import * as webpush from 'jsr:@negrel/webpush@0.5.0'

import {
  groupByUser,
  isGoneStatus,
  planReminder,
  type PushMessage,
  summaryMessage,
  toDueReminder,
  toSummaryEntry,
  VAPID_PUBLIC_KEY,
  VAPID_SUBJECT,
  vapidJwk,
} from './messages.ts'

interface Subscription {
  id: string
  user_id: string
  endpoint: string
  p256dh: string
  auth: string
}

/** Un aviso que llega tarde ya no sirve: el servicio de push lo tira si el móvil no lo recoge. */
const REMINDER_TTL_SECONDS = 60 * 60
const SUMMARY_TTL_SECONDS = 4 * 60 * 60

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  { auth: { persistSession: false, autoRefreshToken: false } },
)

const vapidKeys = await webpush.importVapidKeys(
  vapidJwk(VAPID_PUBLIC_KEY, Deno.env.get('VAPID_PRIVATE_KEY') ?? ''),
)

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (request) => {
  if (request.method !== 'POST') return json({ error: 'method' }, 405)
  const secret = request.headers.get('x-cron-secret')
  if (!secret) return json({ error: 'secret' }, 401)
  const { data: valid, error: verifyError } = await supabase.rpc('verify_cron_secret', {
    p_secret: secret,
  })
  if (verifyError) return json({ error: 'verify' }, 500)
  if (valid !== true) return json({ error: 'secret' }, 401)

  const now = new Date()
  const [reminders, summaries] = await Promise.all([
    supabase.rpc('claim_due_reminders'),
    supabase.rpc('claim_daily_summaries'),
  ])
  if (reminders.error || summaries.error) {
    console.error('claim', reminders.error?.message, summaries.error?.message)
    return json({ error: 'claim' }, 500)
  }

  // Qué sale para cada persona: sus avisos y, si le toca, su resumen.
  const outbox: { userId: string; message: PushMessage; ttl: number; urgent: boolean }[] = []
  const skipped: Record<string, number> = {}
  for (const row of (reminders.data ?? []) as Record<string, unknown>[]) {
    const reminder = toDueReminder(row)
    if (!reminder) continue
    const plan = planReminder(reminder, now)
    if (plan.send) {
      outbox.push({
        userId: reminder.userId,
        message: plan.message,
        ttl: REMINDER_TTL_SECONDS,
        urgent: true,
      })
    } else {
      skipped[plan.reason] = (skipped[plan.reason] ?? 0) + 1
    }
  }
  const entries = ((summaries.data ?? []) as Record<string, unknown>[])
    .map(toSummaryEntry)
    .filter((entry) => entry !== null)
  for (const [userId, list] of groupByUser(entries)) {
    const message = summaryMessage(list)
    if (message) outbox.push({ userId, message, ttl: SUMMARY_TTL_SECONDS, urgent: false })
  }
  if (outbox.length === 0) return json({ sent: 0, skipped, removed: 0 })

  const users = [...new Set(outbox.map((entry) => entry.userId))]
  const { data: subscriptions, error: subscriptionsError } = await supabase
    .from('push_subscriptions')
    .select('id, user_id, endpoint, p256dh, auth')
    .in('user_id', users)
  if (subscriptionsError) {
    console.error('subscriptions', subscriptionsError.message)
    return json({ error: 'subscriptions' }, 500)
  }

  const gone = new Set<string>()
  const used = new Set<string>()
  let sent = 0
  await Promise.all(
    outbox.flatMap(({ userId, message, ttl, urgent }) =>
      (subscriptions as Subscription[])
        .filter((subscription) => subscription.user_id === userId)
        .map(async (subscription) => {
          try {
            await push(subscription, message, ttl, urgent)
            sent += 1
            used.add(subscription.id)
          } catch (error) {
            if (error instanceof webpush.PushMessageError && isGoneStatus(error.response.status)) {
              gone.add(subscription.id)
            } else {
              console.error('push', String(error))
            }
          }
        }),
    ),
  )

  if (gone.size > 0) {
    await supabase
      .from('push_subscriptions')
      .delete()
      .in('id', [...gone])
  }
  const usable = [...used].filter((id) => !gone.has(id))
  if (usable.length > 0) {
    await supabase
      .from('push_subscriptions')
      .update({ last_used_at: now.toISOString() })
      .in('id', usable)
  }
  return json({ sent, skipped, removed: gone.size })
})

/**
 * Un mensaje a un navegador, cifrado para él (RFC 8291) y firmado con VAPID (RFC 8292). Cada
 * mensaje lleva su propio par de claves efímero, como pide el RFC: por eso un servidor nuevo cada
 * vez (la librería lo genera al crearlo).
 */
async function push(
  subscription: Subscription,
  message: PushMessage,
  ttl: number,
  urgent: boolean,
): Promise<void> {
  const server = await webpush.ApplicationServer.new({
    contactInformation: VAPID_SUBJECT,
    vapidKeys,
  })
  await server
    .subscribe({
      endpoint: subscription.endpoint,
      keys: { p256dh: subscription.p256dh, auth: subscription.auth },
    })
    .pushTextMessage(JSON.stringify(message), {
      ttl,
      urgency: urgent ? webpush.Urgency.High : webpush.Urgency.Normal,
    })
}
