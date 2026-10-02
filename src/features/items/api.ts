import { FunctionsHttpError } from '@supabase/supabase-js'
import { startOfDay } from 'date-fns'
import { z } from 'zod'

import { isNetworkError } from '@/lib/errors'
import type { Database } from '@/lib/supabase/database.types'
import { supabase } from '@/lib/supabase/client'

import type { MovePatch } from './move'
import { fieldsFor, ITEM_COLUMNS, itemTitleSchema, mapItemRow } from './schemas'
import type {
  Item,
  ItemKind,
  ItemLink,
  ItemLinkPatch,
  ItemPatch,
  ItemStatus,
  MovedItem,
} from './types'

type ItemUpdate = Database['public']['Tables']['items']['Update']

/** Cuántas cosas movidas enseña la inbox: lo más reciente basta para saber a dónde fue algo. */
const MOVED_LIMIT = 50

/**
 * Ítems de una lista en su orden (`position` y, a igualdad, el más antiguo antes). Los terminados
 * vienen mezclados: el cliente los separa en «Fuera de la cabeza». Usa `items_list_idx`.
 */
export async function fetchItems(listId: string): Promise<Item[]> {
  const { data, error } = await supabase
    .from('items')
    .select(ITEM_COLUMNS)
    .eq('list_id', listId)
    .order('position')
    .order('created_at')

  if (error) throw error
  return data.map(mapItemRow)
}

/**
 * Las sublistas no hechas de todas tus listas (RLS deja solo las tuyas): los destinos de la captura
 * y de «Mover a…» en listas que aún no se han abierto. Son pocas filas.
 */
export async function fetchSublists(): Promise<Item[]> {
  const { data, error } = await supabase
    .from('items')
    .select(ITEM_COLUMNS)
    .eq('kind', 'sublist')
    .neq('status', 'done')
    .order('position')

  if (error) throw error
  return data.map(mapItemRow)
}

export interface NewItem {
  /** Lo genera el cliente (`crypto.randomUUID()`): el ítem optimista y el real son el mismo. */
  id: string
  listId: string
  /** El tipo por defecto de la lista (`defaultItemKind`), salvo que se elija otro. */
  kind: ItemKind
  /** Dentro de una sublista (ADR-010), de la misma lista. */
  parentId?: string | null
  title: string
  status: ItemStatus
  /** Sin posición (la captura rápida no tiene la lista destino en caché), va al final. */
  position?: number
}

/**
 * Crea un ítem. Es idempotente: si un reintento llega después de que el primer envío sí entrara,
 * `ON CONFLICT (id) DO NOTHING` lo ignora en vez de fallar por clave duplicada. RLS exige que
 * `created_by` sea quien tiene la sesión.
 */
export async function createItem(item: NewItem): Promise<void> {
  const title = itemTitleSchema.parse(item.title)
  const { data: auth } = await supabase.auth.getSession()
  const createdBy = auth.session?.user.id
  if (!createdBy) throw new Error('Sin sesión')

  const { error } = await supabase.from('items').upsert(
    {
      id: item.id,
      list_id: item.listId,
      created_by: createdBy,
      kind: item.kind,
      parent_id: item.parentId ?? null,
      title,
      status: item.status,
      position: item.position ?? (await lastPosition(item.listId)) + 1000,
    },
    { onConflict: 'id', ignoreDuplicates: true },
  )
  if (error) throw error
}

/** Cambia el estado; el trigger `items_validate` lo valida y pone o quita `completed_at`. */
export async function updateItemStatus(itemId: string, status: ItemStatus): Promise<void> {
  const { error } = await supabase.from('items').update({ status }).eq('id', itemId)
  if (error) throw error
}

/**
 * Guarda un cambio del detalle. Cada campo va en su propia llamada (guardado por campo): título,
 * notas, prioridad (en `fields`), fecha límite o estado. Cambiar el tipo manda juntos el tipo, su
 * estado traducido y lo que se quita (`changeKindPatch`), para que el trigger los valide a la vez. Una fecha sin hora se guarda como las
 * 00:00 locales con `all_day = true` (04 §Fechas).
 */
export async function updateItem(itemId: string, patch: ItemPatch): Promise<void> {
  const row: ItemUpdate = {}
  if (patch.title !== undefined) row.title = itemTitleSchema.parse(patch.title)
  if (patch.notes !== undefined) row.notes = patch.notes?.trim() ? patch.notes.trim() : null
  if (patch.priority !== undefined) row.fields = fieldsFor(patch.priority)
  if (patch.dueAt !== undefined) {
    row.due_at = patch.dueAt ? startOfDay(patch.dueAt).toISOString() : null
    row.all_day = patch.dueAt !== null
  }
  if (patch.status !== undefined) row.status = patch.status
  if (patch.kind !== undefined) row.kind = patch.kind
  if (patch.url !== undefined) row.url = patch.url
  if (patch.urlTitle !== undefined) row.url_title = patch.urlTitle
  if (patch.imageUrl !== undefined) row.image_url = patch.imageUrl
  if (patch.imagePath !== undefined) row.image_path = patch.imagePath
  if (patch.recurrence !== undefined) row.recurrence = patch.recurrence
  if (patch.urlSite !== undefined) row.url_site = patch.urlSite
  if (patch.priceCents !== undefined) row.price_cents = patch.priceCents
  if (patch.currency !== undefined) row.currency = patch.currency
  if (patch.priceSource !== undefined) row.price_source = patch.priceSource
  if (patch.priceCheckedAt !== undefined)
    row.price_checked_at = patch.priceCheckedAt?.toISOString() ?? null
  if (patch.priceLinkId !== undefined) row.price_link_id = patch.priceLinkId
  if (patch.priceStore !== undefined) row.price_store = patch.priceStore
  const { error } = await supabase.from('items').update(row).eq('id', itemId)
  if (error) throw error
}

/**
 * Mueve un ítem al final de otra lista (`buildMovePatch`): conserva su tipo, salvo lo que sale de
 * «En mente», que toma el del destino. La posición se pide al servidor, porque la lista destino
 * puede no estar en caché. El rastro de «En mente» y el tipo adoptado los ponen también los
 * triggers `items_track_inbox` e `items_adopt_kind`, para cualquier cliente.
 */
export async function moveItem(itemId: string, patch: MovePatch): Promise<void> {
  const position = (await lastPosition(patch.listId)) + 1000
  const { error } = await supabase
    .from('items')
    .update({
      list_id: patch.listId,
      kind: patch.kind,
      parent_id: patch.parentId,
      status: patch.status,
      fields: fieldsFor(patch.priority),
      due_at: patch.dueAt ? patch.dueAt.toISOString() : null,
      all_day: patch.allDay,
      recurrence: patch.recurrence,
      position,
    })
    .eq('id', itemId)
  if (error) throw error
}

/** La mayor posición de una lista (0 si está vacía), para poner algo al final. */
async function lastPosition(listId: string): Promise<number> {
  const { data, error } = await supabase
    .from('items')
    .select('position')
    .eq('list_id', listId)
    .order('position', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw error
  return data?.position ?? 0
}

export async function deleteItem(itemId: string): Promise<void> {
  const { error } = await supabase.from('items').delete().eq('id', itemId)
  if (error) throw error
}

/**
 * Inserta ítems tal cual son, con sus ids, sus fechas y su rastro de «En mente»: «Deshacer» un
 * borrado (una sublista vuelve con todo lo de dentro) y duplicar una sublista. Va en una sola
 * llamada, con la sublista delante de lo suyo: los triggers de cada fila ven las anteriores del
 * mismo `insert`, así que `items_validate_parent` encuentra a la madre. Idempotente como
 * `createItem`.
 */
export async function insertItems(items: readonly Item[]): Promise<void> {
  const { data: auth } = await supabase.auth.getSession()
  const createdBy = auth.session?.user.id
  if (!createdBy) throw new Error('Sin sesión')

  const ordered = [...items].sort(
    (a, b) => Number(a.parentId !== null) - Number(b.parentId !== null),
  )
  const { error } = await supabase.from('items').upsert(
    ordered.map((item) => ({
      id: item.id,
      list_id: item.listId,
      created_by: createdBy,
      kind: item.kind,
      parent_id: item.parentId,
      title: item.title,
      notes: item.notes,
      status: item.status,
      fields: fieldsFor(item.priority),
      position: item.position,
      due_at: item.dueAt?.toISOString() ?? null,
      all_day: item.allDay,
      recurrence: item.recurrence,
      completed_at: item.completedAt?.toISOString() ?? null,
      created_at: item.createdAt.toISOString(),
      left_inbox_id: item.leftInboxId,
      left_inbox_at: item.leftInboxAt?.toISOString() ?? null,
      url: item.url,
      url_title: item.urlTitle,
      image_url: item.imageUrl,
      image_path: item.imagePath,
      url_site: item.urlSite,
      price_cents: item.priceCents,
      currency: item.currency,
      price_source: item.priceSource,
      previous_price_cents: item.previousPriceCents,
      price_checked_at: item.priceCheckedAt?.toISOString() ?? null,
    })),
    { onConflict: 'id', ignoreDuplicates: true },
  )
  if (error) throw error
}

/**
 * Lo que salió de una inbox y sigue en otra lista, con el nombre de esa lista: la sección «Fuera
 * de la cabeza» de «En mente» lo enseña como «movida a Casa · lunes». El embed necesita el nombre
 * de la clave (`items_list_id_fkey`) porque `items` tiene dos claves hacia `lists`.
 */
export async function fetchMovedFromInbox(inboxId: string): Promise<MovedItem[]> {
  const { data, error } = await supabase
    .from('items')
    .select('id, title, left_inbox_at, list:lists!items_list_id_fkey(name)')
    .eq('left_inbox_id', inboxId)
    .neq('list_id', inboxId)
    .order('left_inbox_at', { ascending: false })
    .limit(MOVED_LIMIT)

  if (error) throw error
  return data.flatMap((row) =>
    row.left_inbox_at
      ? [
          {
            id: row.id,
            title: row.title,
            listName: row.list.name,
            movedAt: new Date(row.left_inbox_at),
          },
        ]
      : [],
  )
}

/** Lo que trae `fetch-metadata` de la página de un enlace (04 §Backend). */
const linkMetadataSchema = z.object({
  title: z.string().nullable(),
  image: z.string().nullable(),
  siteName: z.string().nullable().optional(),
  domain: z.string().optional(),
  /** El precio de un producto (2.1); una función sin desplegar aún no lo manda. */
  price: z
    .object({ cents: z.number().int().positive(), currency: z.string().regex(/^[A-Z]{3}$/) })
    .nullable()
    .optional(),
})
export type LinkMetadata = z.infer<typeof linkMetadataSchema>

/**
 * El título y la imagen de la página de un enlace, con la edge function `fetch-metadata`: el
 * navegador no puede leer otra web (CORS). Si la función contesta pero la página no da nada,
 * devuelve todo `null`: el enlace se queda con su dominio (diseño 15, M5). Si la función no
 * contesta (sin red, caída o sin desplegar), lanza: no se guarda «sin título» y se vuelve a
 * intentar la próxima vez.
 */
export async function fetchLinkMetadata(url: string): Promise<LinkMetadata> {
  const response = await supabase.functions.invoke<unknown>('fetch-metadata', { body: { url } })
  const error: unknown = response.error
  if (error) {
    // Un 400 es la función diciendo que esa URL no vale: eso sí es «sin título».
    if (error instanceof FunctionsHttpError && functionStatus(error) === 400) {
      return { title: null, image: null }
    }
    throw new Error(isNetworkError(error) ? 'Failed to fetch' : 'fetch-metadata no contesta', {
      cause: error,
    })
  }
  const parsed = linkMetadataSchema.safeParse(response.data)
  return parsed.success ? parsed.data : { title: null, image: null }
}

/** El código HTTP con el que contestó la función (supabase-js deja la `Response` en `context`). */
function functionStatus(error: FunctionsHttpError): number | null {
  const context: unknown = error.context
  return context instanceof Response ? context.status : null
}

/**
 * Añade tiendas a una compra (2.2b), con sus ids generados en el cliente: la segunda llega junto a
 * la primera (la de siempre, sacada del ítem). El trigger `item_links_sync` le pone a la compra el
 * precio de la más barata. Idempotente, como `createItem`.
 */
export async function insertLinks(itemId: string, links: readonly ItemLink[]): Promise<void> {
  const { error } = await supabase.from('item_links').upsert(
    links.map((link) => ({
      id: link.id,
      item_id: itemId,
      url: link.url,
      url_title: link.urlTitle,
      url_site: link.urlSite,
      price_cents: link.priceCents,
      currency: link.currency,
      price_source: link.priceSource,
      price_checked_at: link.priceCheckedAt?.toISOString() ?? null,
      position: link.position,
    })),
    { onConflict: 'id', ignoreDuplicates: true },
  )
  if (error) throw error
}

/** Cambia una tienda: lo que trae su web, o su precio escrito a mano. */
export async function updateLink(linkId: string, patch: ItemLinkPatch): Promise<void> {
  const row: Database['public']['Tables']['item_links']['Update'] = {}
  if (patch.urlTitle !== undefined) row.url_title = patch.urlTitle
  if (patch.urlSite !== undefined) row.url_site = patch.urlSite
  if (patch.priceCents !== undefined) row.price_cents = patch.priceCents
  if (patch.currency !== undefined) row.currency = patch.currency
  if (patch.priceSource !== undefined) row.price_source = patch.priceSource
  if (patch.priceCheckedAt !== undefined)
    row.price_checked_at = patch.priceCheckedAt?.toISOString() ?? null
  const { error } = await supabase.from('item_links').update(row).eq('id', linkId)
  if (error) throw error
}

/** Quita una tienda. Si queda una sola, el trigger la devuelve al ítem. */
export async function deleteLink(linkId: string): Promise<void> {
  const { error } = await supabase.from('item_links').delete().eq('id', linkId)
  if (error) throw error
}
