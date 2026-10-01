import { z } from 'zod'

import { parseTaskFields } from './fields'
import { ITEM_KINDS, ITEM_STATUSES } from './status'
import type { Item } from './types'

/** Mismo límite que el `check` de `items.title` (03 §items). */
export const ITEM_TITLE_MAX_LENGTH = 300

/** Título de un ítem nuevo: sin espacios alrededor y entre 1 y 300 caracteres. */
export const itemTitleSchema = z.string().trim().min(1).max(ITEM_TITLE_MAX_LENGTH)

const itemStatusSchema = z.enum(ITEM_STATUSES)
const itemKindSchema = z.enum(ITEM_KINDS)
const priceSourceSchema = z.enum(['manual', 'web', 'auto']).nullable()

/** Las columnas que la app lee de `items` (todas las consultas piden estas). */
export const ITEM_COLUMNS =
  'id, list_id, kind, parent_id, title, notes, status, fields, position, due_at, all_day, recurrence, completed_at, created_at, left_inbox_id, left_inbox_at, url, url_title, image_url, image_path, url_site, price_cents, currency, price_source, previous_price_cents, price_checked_at'

/** Límite de las notas: el `check` de `items.notes`. */
export const ITEM_NOTES_MAX_LENGTH = 5000

export interface ItemRow {
  id: string
  list_id: string
  kind: string
  parent_id: string | null
  title: string
  notes: string | null
  status: string
  fields: unknown
  position: number
  due_at: string | null
  all_day: boolean
  recurrence: string | null
  completed_at: string | null
  created_at: string
  left_inbox_id: string | null
  left_inbox_at: string | null
  url: string | null
  url_title: string | null
  image_url: string | null
  image_path: string | null
  url_site: string | null
  price_cents: number | null
  currency: string | null
  price_source: string | null
  previous_price_cents: number | null
  price_checked_at: string | null
}

const toDate = (value: string | null) => (value === null ? null : new Date(value))

/** Fila de Supabase → ítem de la app (fechas como `Date`, estado validado, prioridad de `fields`). */
export function mapItemRow(row: ItemRow): Item {
  return {
    id: row.id,
    listId: row.list_id,
    kind: itemKindSchema.parse(row.kind),
    parentId: row.parent_id,
    title: row.title,
    notes: row.notes,
    status: itemStatusSchema.parse(row.status),
    priority: parseTaskFields(row.fields).priority ?? null,
    dueAt: toDate(row.due_at),
    allDay: row.all_day,
    recurrence: row.recurrence,
    position: row.position,
    completedAt: toDate(row.completed_at),
    createdAt: new Date(row.created_at),
    leftInboxId: row.left_inbox_id,
    leftInboxAt: toDate(row.left_inbox_at),
    url: row.url,
    urlTitle: row.url_title,
    imageUrl: row.image_url,
    imagePath: row.image_path,
    urlSite: row.url_site,
    priceCents: row.price_cents,
    currency: row.currency ?? 'EUR',
    priceSource: priceSourceSchema.parse(row.price_source),
    previousPriceCents: row.previous_price_cents,
    priceCheckedAt: toDate(row.price_checked_at),
  }
}

/** `fields` de una fila a partir de la prioridad (el único campo flexible en fase 1). */
export function fieldsFor(priority: Item['priority']): {
  priority?: NonNullable<Item['priority']>
} {
  return priority ? { priority } : {}
}
