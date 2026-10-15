import { z } from 'zod'

import { listColorSchema } from '@/features/lists/schemas'
import { Constants } from '@/lib/supabase/database.types'

/**
 * Cómo está un enlace de invitación (3.2, `list_invite_preview` y `accept_list_invite`):
 * - `valid`: se puede entrar con él; `joined`: se acaba de entrar.
 * - `member`: ya estás en la lista; `own`: es tu lista.
 * - `revoked`: se anuló (o la lista se archivó); `expired`: caducó (vale 7 días).
 * - `unknown`: no existe (o está mal copiado).
 */
export const INVITE_STATUSES = [
  'valid',
  'joined',
  'member',
  'own',
  'revoked',
  'expired',
  'unknown',
] as const
export const inviteStatusSchema = z.enum(INVITE_STATUSES)
export type InviteStatus = z.infer<typeof inviteStatusSchema>

/** Lo que dice un enlace antes de entrar, también sin sesión (diseño 20, J1–J9). */
export const invitePreviewSchema = z
  .object({
    status: inviteStatusSchema,
    list_id: z.string().nullable(),
    list_name: z.string().nullable(),
    list_color: listColorSchema.nullable().catch(null),
    list_kind: z.enum(Constants.public.Enums.list_kind).nullable(),
    pending_count: z.number().nullable(),
    inviter_name: z.string().nullable(),
    member_since: z.string().nullable(),
    // El cuadrado de la lista (5.9); de una base de antes, sin él.
    list_icon: z.string().nullable().optional().catch(null),
  })
  .transform((row) => ({
    status: row.status,
    listId: row.list_id,
    listName: row.list_name,
    listColor: row.list_color,
    listKind: row.list_kind,
    pendingCount: row.pending_count ?? 0,
    inviterName: row.inviter_name,
    memberSince: row.member_since ? new Date(row.member_since) : null,
    listIcon: row.list_icon ?? null,
  }))
export type InvitePreview = z.output<typeof invitePreviewSchema>

export const acceptResultSchema = z
  .object({ status: inviteStatusSchema, list_id: z.string().nullable() })
  .transform((row) => ({ status: row.status, listId: row.list_id }))
export type AcceptResult = z.output<typeof acceptResultSchema>

/** El enlace activo de una lista: su token y cuándo caduca. */
export const activeInviteSchema = z
  .object({ invite_token: z.string(), invite_expires_at: z.string() })
  .transform((row) => ({ token: row.invite_token, expiresAt: new Date(row.invite_expires_at) }))
export type ActiveInvite = z.output<typeof activeInviteSchema>

/** Quién está en una lista: quien la creó y quienes han entrado. */
export const listPersonSchema = z
  .object({
    user_id: z.string(),
    display_name: z.string().nullable(),
    avatar_url: z.string().nullable(),
    is_owner: z.boolean(),
    joined_at: z.string().nullable(),
  })
  .transform((row) => ({
    userId: row.user_id,
    displayName: row.display_name,
    avatarUrl: row.avatar_url,
    isOwner: row.is_owner,
    /** Cuándo entró; `null` en quien la creó. */
    joinedAt: row.joined_at ? new Date(row.joined_at) : null,
  }))
export type ListPerson = z.output<typeof listPersonSchema>

/** Alguien en una de tus listas compartidas (`shared_list_people`, 3.3). */
export const sharedPersonSchema = z
  .object({
    list_id: z.string(),
    user_id: z.string(),
    display_name: z.string().nullable(),
    avatar_url: z.string().nullable(),
    is_owner: z.boolean(),
    joined_at: z.string().nullable(),
  })
  .transform((row) => ({
    listId: row.list_id,
    person: {
      userId: row.user_id,
      displayName: row.display_name,
      avatarUrl: row.avatar_url,
      isOwner: row.is_owner,
      joinedAt: row.joined_at ? new Date(row.joined_at) : null,
    } satisfies ListPerson,
  }))

/**
 * Por qué ya no tienes una lista (3.3, diseño 20, M9 y M10): te quitaron, quien la creó la borró o
 * la archivó. Con el nombre que tenía y el de quien la creó, para decirlo.
 */
export const departureSchema = z
  .object({
    reason: z.enum(['removed', 'deleted', 'archived']),
    list_name: z.string(),
    owner_name: z.string().nullable(),
  })
  .transform((row) => ({
    reason: row.reason,
    listName: row.list_name,
    ownerName: row.owner_name,
  }))
export type Departure = z.output<typeof departureSchema>
