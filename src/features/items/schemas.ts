import { z } from 'zod'

import { parseTaskFields } from './fields'
import { ITEM_KINDS, ITEM_STATUSES } from './status'
import type { Item, ItemFile, ItemLink, PriceTracking } from './types'

/** Mismo límite que el `check` de `items.title` (03 §items). */
export const ITEM_TITLE_MAX_LENGTH = 300

/** Título de un ítem nuevo: sin espacios alrededor y entre 1 y 300 caracteres. */
export const itemTitleSchema = z.string().trim().min(1).max(ITEM_TITLE_MAX_LENGTH)

const itemStatusSchema = z.enum(ITEM_STATUSES)
const itemKindSchema = z.enum(ITEM_KINDS)
const priceSourceSchema = z.enum(['manual', 'web', 'auto']).nullable()

/** Las columnas que la app lee de `items` (todas las consultas piden estas). */
export const ITEM_COLUMNS =
  'id, list_id, kind, parent_id, choose_one, chosen_id, title, notes, protected, sealed_notes, sealed_iv, sealed_key_id, status, fields, position, due_at, all_day, recurrence, completed_at, created_at, left_inbox_id, left_inbox_at, url, url_title, image_url, image_path, url_site, price_cents, currency, price_source, previous_price_cents, price_checked_at, price_link_id, price_store, price_followed, price_failures, created_by, completed_by, links:item_links!item_links_item_id_fkey(id, url, url_title, url_site, price_cents, currency, price_source, price_checked_at, price_followed, price_failures, position), images:item_images(id, path, position), files:item_files(id, path, name, mime, size_bytes, position)'

/** Límite de las notas: el `check` de `items.notes`. */
export const ITEM_NOTES_MAX_LENGTH = 5000

export interface ItemRow {
  id: string
  list_id: string
  kind: string
  parent_id: string | null
  choose_one: boolean
  chosen_id: string | null
  title: string
  notes: string | null
  protected: boolean
  sealed_notes: string | null
  sealed_iv: string | null
  sealed_key_id: string | null
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
  price_link_id: string | null
  price_store: string | null
  price_followed: boolean
  price_failures: number
  created_by: string
  completed_by: string | null
  links: ItemLinkRow[]
  images: { id: string; path: string; position: number }[]
  files: ItemFileRow[]
}

export interface ItemFileRow {
  id: string
  path: string
  name: string
  mime: string
  size_bytes: number
  position: number
}

/** Un documento de Supabase → de la app. */
export function mapItemFileRow(row: ItemFileRow): ItemFile {
  return {
    id: row.id,
    path: row.path,
    name: row.name,
    mime: row.mime,
    sizeBytes: row.size_bytes,
    position: row.position,
  }
}

export interface ItemLinkRow {
  id: string
  url: string
  url_title: string | null
  url_site: string | null
  price_cents: number | null
  currency: string
  price_source: string | null
  price_checked_at: string | null
  price_followed: boolean
  price_failures: number
  position: number
}

/** Fila de `item_links` → tienda de la app. */
export function mapItemLinkRow(row: ItemLinkRow): ItemLink {
  return {
    id: row.id,
    url: row.url,
    urlTitle: row.url_title,
    urlSite: row.url_site,
    priceCents: row.price_cents,
    currency: row.currency,
    priceSource: priceSourceSchema.parse(row.price_source),
    priceCheckedAt: toDate(row.price_checked_at),
    priceTracking: priceTracking(row.price_followed, row.price_failures),
    position: row.position,
  }
}

const toDate = (value: string | null) => (value === null ? null : new Date(value))

/** Las mañanas seguidas sin precio con las que se deja de mirar (`price_checks_due`). */
export const PRICE_FAILURES_TO_STOP = 3

/** Si se mira solo (3.8): de `price_followed` y `price_failures`. */
export function priceTracking(followed: boolean, failures: number): PriceTracking {
  if (!followed) return null
  return failures >= PRICE_FAILURES_TO_STOP ? 'stopped' : 'on'
}

/** Fila de Supabase → ítem de la app (fechas como `Date`, estado validado, prioridad de `fields`). */
export function mapItemRow(row: ItemRow): Item {
  return {
    id: row.id,
    listId: row.list_id,
    kind: itemKindSchema.parse(row.kind),
    parentId: row.parent_id,
    chooseOne: row.choose_one,
    chosenId: row.chosen_id,
    title: row.title,
    notes: row.notes,
    sealed: sealedNotes(row),
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
    links: row.links.map(mapItemLinkRow).sort((a, b) => a.position - b.position),
    images: [...row.images].sort((a, b) => a.position - b.position),
    files: row.files.map(mapItemFileRow).sort((a, b) => a.position - b.position),
    priceLinkId: row.price_link_id,
    priceStore: row.price_store,
    priceTracking: priceTracking(row.price_followed, row.price_failures),
    createdBy: row.created_by,
    completedBy: row.completed_by,
  }
}

/** Lo cifrado de una nota protegida (5.7), o `null`. */
function sealedNotes(row: ItemRow): Item['sealed'] {
  if (!row.protected || !row.sealed_notes || !row.sealed_iv || !row.sealed_key_id) return null
  return { sealed: row.sealed_notes, iv: row.sealed_iv, keyId: row.sealed_key_id }
}

/** `fields` de una fila a partir de la prioridad (el único campo flexible en fase 1). */
export function fieldsFor(priority: Item['priority']): {
  priority?: NonNullable<Item['priority']>
} {
  return priority ? { priority } : {}
}
