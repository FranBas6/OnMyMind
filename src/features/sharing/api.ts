import { REALTIME_SUBSCRIBE_STATES } from '@supabase/supabase-js'
import { z } from 'zod'

import { supabase } from '@/lib/supabase/client'

import {
  acceptResultSchema,
  activeInviteSchema,
  departureSchema,
  invitePreviewSchema,
  listPersonSchema,
  sharedPersonSchema,
  type AcceptResult,
  type ActiveInvite,
  type Departure,
  type InvitePreview,
  type ListPerson,
} from './schemas'

/** La ruta de la pantalla de invitación (3.2), con el token del enlace: corta, `/i/k7Q2xpA9zL3m`. */
export const INVITE_PATH = '/i'

/** El enlace que se comparte: la app, en esta misma dirección, con su pantalla de invitación. */
export function inviteUrl(token: string, origin = window.location.origin): string {
  return `${origin}${INVITE_PATH}/${token}`
}

/**
 * El enlace activo de una lista tuya, si hay uno (sin anular y sin caducar). Leerlo no crea nada:
 * para eso está `createInvite`.
 */
export async function fetchActiveInvite(listId: string): Promise<ActiveInvite | null> {
  const { data, error } = await supabase
    .from('list_invites')
    .select('invite_token:token, invite_expires_at:expires_at')
    .eq('list_id', listId)
    .is('revoked_at', null)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw error
  return data ? activeInviteSchema.parse(data) : null
}

/** El enlace activo de una lista tuya o, si no hay, uno nuevo (vale siete días, para quien lo abra). */
export async function createInvite(listId: string): Promise<ActiveInvite> {
  const { data, error } = await supabase.rpc('create_list_invite', { p_list_id: listId })
  if (error) throw error
  const [invite] = z.array(activeInviteSchema).parse(data)
  if (!invite) throw new Error('La invitación no ha vuelto')
  return invite
}

/** Anula el enlace activo: quien lo abra después verá que ya no sirve. */
export async function revokeInvite(listId: string): Promise<void> {
  const { error } = await supabase.rpc('revoke_list_invite', { p_list_id: listId })
  if (error) throw error
}

/** Lo que dice un enlace antes de entrar: a qué lista, quién invita y si aún vale. */
export async function fetchInvitePreview(token: string): Promise<InvitePreview> {
  const { data, error } = await supabase.rpc('list_invite_preview', { p_token: token })
  if (error) throw error
  const [preview] = z.array(invitePreviewSchema).parse(data)
  if (!preview) throw new Error('El enlace no ha vuelto')
  return preview
}

/** Entrar en la lista con el enlace. `joined` si has entrado ahora; si no, por qué no. */
export async function acceptInvite(token: string): Promise<AcceptResult> {
  const { data, error } = await supabase.rpc('accept_list_invite', { p_token: token })
  if (error) throw error
  const [result] = z.array(acceptResultSchema).parse(data)
  if (!result) throw new Error('La respuesta no ha vuelto')
  return result
}

/** Quién está en una lista tuya o compartida contigo: primero quien la creó, después por llegada. */
export async function fetchListPeople(listId: string): Promise<ListPerson[]> {
  const { data, error } = await supabase.rpc('list_people', { p_list_id: listId })
  if (error) throw error
  return z.array(listPersonSchema).parse(data)
}

/**
 * Quién está en cada una de tus listas compartidas, de una vez (3.3): por lista, primero quien la
 * creó. Las que no comparte nadie no salen.
 */
export async function fetchSharedPeople(): Promise<Map<string, ListPerson[]>> {
  const { data, error } = await supabase.rpc('shared_list_people')
  if (error) throw error
  const byList = new Map<string, ListPerson[]>()
  for (const { listId, person } of z.array(sharedPersonSchema).parse(data)) {
    byList.set(listId, [...(byList.get(listId) ?? []), person])
  }
  return byList
}

/** Por qué ya no tienes una lista que tenías, si es que te la quitaron, la borraron o la archivaron. */
export async function fetchDeparture(listId: string): Promise<Departure | null> {
  const { data, error } = await supabase
    .from('list_departures')
    .select('reason, list_name, owner_name')
    .eq('list_id', listId)
    .maybeSingle()
  if (error) throw error
  return data ? departureSchema.parse(data) : null
}

/** Sales de una lista compartida contigo: lo que añadiste se queda en ella. */
export async function leaveList(listId: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from('list_members')
    .delete()
    .eq('list_id', listId)
    .eq('user_id', userId)
  if (error) throw error
}

/** Quien creó la lista quita a alguien: deja de verla, y lo que añadió se queda. */
export const removeMember = leaveList

/** El token de un enlace de invitación, si `path` lo es (el `?redirect=` del acceso, J1). */
export function inviteTokenFrom(path: string | undefined): string | null {
  const match = path?.match(/^\/i\/([A-Za-z0-9_-]+)$/)
  return match?.[1] ?? null
}

/**
 * Escucha tu canal de cambios en directo (3.4): `user:<tu id>`, privado, al que los triggers de la
 * base mandan lo que cambia en tus listas (migración `live_lists`). `onJoin` salta cada vez que el
 * canal queda conectado: la primera y cada vez que vuelve tras perder la conexión. Devuelve cómo
 * dejar de escuchar.
 */
export function subscribeToLiveChanges(
  userId: string,
  { onChange, onJoin }: { onChange: (payload: unknown) => void; onJoin: () => void },
): () => void {
  const channel = supabase
    .channel(`user:${userId}`, { config: { private: true } })
    .on('broadcast', { event: 'change' }, (message) => {
      onChange(message.payload)
    })
    .subscribe((status) => {
      if (status === REALTIME_SUBSCRIBE_STATES.SUBSCRIBED) onJoin()
    })
  return () => {
    void supabase.removeChannel(channel)
  }
}
