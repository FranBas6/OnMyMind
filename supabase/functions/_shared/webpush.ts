// El envío de push, compartido por `send-reminders` (2.7) y `refresh-prices` (3.8). Con Deno: usa
// `@negrel/webpush` (JSR, WebCrypto), que cifra para cada navegador (RFC 8291) y firma con VAPID
// (RFC 8292). El `web-push` de npm no funciona en el edge runtime (08). Lo puro está en `push.ts`.

import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.116.0'
import * as webpush from 'jsr:@negrel/webpush@0.5.0'

import {
  isGoneStatus,
  type PushMessage,
  VAPID_PUBLIC_KEY,
  VAPID_SUBJECT,
  vapidJwk,
} from './push.ts'

interface Subscription {
  id: string
  user_id: string
  endpoint: string
  p256dh: string
  auth: string
}

/** Un mensaje para todos los dispositivos de una persona. */
export interface Outgoing {
  userId: string
  message: PushMessage
  /** Cuánto lo guarda el servicio de push si el móvil no lo recoge. */
  ttl: number
  urgent: boolean
}

/**
 * Envía cada mensaje a todas las suscripciones de su persona. Borra las que el servicio de push da
 * por muertas (404 o 410) y apunta `last_used_at` en las que funcionan. Devuelve cuántos salieron y
 * cuántas suscripciones se borraron.
 */
export async function deliver(
  supabase: SupabaseClient,
  vapidPrivateKey: string,
  outbox: readonly Outgoing[],
  now: Date = new Date(),
): Promise<{ sent: number; removed: number }> {
  if (outbox.length === 0) return { sent: 0, removed: 0 }
  const vapidKeys = await webpush.importVapidKeys(vapidJwk(VAPID_PUBLIC_KEY, vapidPrivateKey))

  const users = [...new Set(outbox.map((entry) => entry.userId))]
  const { data, error } = await supabase
    .from('push_subscriptions')
    .select('id, user_id, endpoint, p256dh, auth')
    .in('user_id', users)
  if (error) throw new Error(`subscriptions: ${error.message}`)
  const subscriptions = (data ?? []) as Subscription[]

  const gone = new Set<string>()
  const used = new Set<string>()
  let sent = 0
  await Promise.all(
    outbox.flatMap(({ userId, message, ttl, urgent }) =>
      subscriptions
        .filter((subscription) => subscription.user_id === userId)
        .map(async (subscription) => {
          try {
            await push(vapidKeys, subscription, message, ttl, urgent)
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
  return { sent, removed: gone.size }
}

/**
 * Un mensaje a un navegador, cifrado para él y firmado. Cada mensaje lleva su propio par de claves
 * efímero, como pide el RFC: por eso un servidor nuevo cada vez (la librería lo genera al crearlo).
 */
async function push(
  vapidKeys: CryptoKeyPair,
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
