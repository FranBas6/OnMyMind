import { z } from 'zod'

import { supabase } from '@/lib/supabase/client'

import type { Reminder } from './reminders'

const COLUMNS = 'id, item_id, remind_at, offset_minutes, sent_at'

const reminderRowSchema = z.object({
  id: z.uuid(),
  item_id: z.uuid(),
  remind_at: z.string(),
  offset_minutes: z.number().int().nullable(),
  sent_at: z.string().nullable(),
})

function mapReminderRow(row: unknown): Reminder {
  const parsed = reminderRowSchema.parse(row)
  return {
    id: parsed.id,
    itemId: parsed.item_id,
    remindAt: new Date(parsed.remind_at),
    offsetMinutes: parsed.offset_minutes,
    sentAt: parsed.sent_at ? new Date(parsed.sent_at) : null,
  }
}

/**
 * Tus avisos (03 §reminders; RLS deja solo los tuyos). Son pocos, así que se piden todos de una
 * vez: la ficha de cualquier ítem los busca aquí por `itemId`.
 */
export async function fetchReminders(): Promise<Reminder[]> {
  const { data, error } = await supabase.from('reminders').select(COLUMNS)
  if (error) throw error
  return data.map(mapReminderRow)
}

/**
 * Pone o cambia el aviso de un ítem (uno por ítem: `upsert` por `item_id`). En uno relativo la
 * base vuelve a calcular `remind_at` con el desfase (trigger `reminders_compute`); el que va aquí
 * es el del cliente, que solo sirve para que la fila se pueda guardar.
 */
export async function saveReminder(reminder: Reminder): Promise<void> {
  const { error } = await supabase.from('reminders').upsert(
    {
      id: reminder.id,
      item_id: reminder.itemId,
      remind_at: reminder.remindAt.toISOString(),
      offset_minutes: reminder.offsetMinutes,
    },
    { onConflict: 'item_id' },
  )
  if (error) throw error
}

export async function deleteReminder(itemId: string): Promise<void> {
  const { error } = await supabase.from('reminders').delete().eq('item_id', itemId)
  if (error) throw error
}

/** Lo que guarda la base de una suscripción de Web Push (03 §push_subscriptions). */
export interface PushSubscriptionKeys {
  endpoint: string
  p256dh: string
  auth: string
}

/**
 * Guarda la suscripción de este navegador en tu cuenta. Va por `save_push_subscription` (security
 * definer): si el mismo navegador estaba suscrito con otra cuenta, pasa a la de ahora.
 */
export async function savePushSubscription(
  subscription: PushSubscriptionKeys,
  userAgent: string,
): Promise<void> {
  const { error } = await supabase.rpc('save_push_subscription', {
    p_endpoint: subscription.endpoint,
    p_p256dh: subscription.p256dh,
    p_auth: subscription.auth,
    p_user_agent: userAgent,
  })
  if (error) throw error
}

export async function deletePushSubscription(endpoint: string): Promise<void> {
  const { error } = await supabase.from('push_subscriptions').delete().eq('endpoint', endpoint)
  if (error) throw error
}
