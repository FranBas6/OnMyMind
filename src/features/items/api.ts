import { FunctionsHttpError } from '@supabase/supabase-js'
import { startOfDay } from 'date-fns'
import { z } from 'zod'

import { isNetworkError } from '@/lib/errors'
import type { Database } from '@/lib/supabase/database.types'
import type { Positioned } from '@/lib/reorder'
import { supabase } from '@/lib/supabase/client'

import type { MovePatch } from './move'
import { fieldsFor, ITEM_COLUMNS, itemTitleSchema, mapItemRow } from './schemas'
import type {
  Completion,
  Item,
  ItemKind,
  ItemFile,
  ItemImage,
  ItemLink,
  ItemLinkPatch,
  ItemPatch,
  ItemStatus,
  MovedItem,
} from './types'
import type { NewItemDue } from './writtenDate'

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
 * y de «Mover a…» en listas que aún no se han abierto. Son pocas filas. Sin las de tus listas
 * ocultas (5.8), que no son destino de nada.
 */
export async function fetchSublists(): Promise<Item[]> {
  const { data, error } = await supabase
    .from('items')
    .select(ITEM_COLUMNS)
    .eq('kind', 'sublist')
    .neq('status', 'done')
    .eq('in_hidden_list', false)
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
  /** Un texto compartido que no cabe en el título (4.7). */
  notes?: string
  status: ItemStatus
  /** Sin posición (la captura rápida no tiene la lista destino en caché), va al final. */
  position?: number
  /** Lo pegado en la captura con lo que trajo su página (2.3). */
  link?: NewItemLink
  /** La fecha escrita con el título (3.5, `writtenDateFields`). */
  due?: NewItemDue
  /** «cada martes» escrito con el título (3.6): la regla. */
  recurrence?: string
}

/**
 * El enlace con el que nace un ítem capturado (2.3). `urlTitle` es `null` si aún no se sabe (sin
 * red, o guardado mientras se buscaba): el detalle lo buscará. El precio, solo en una compra.
 */
export interface NewItemLink {
  url: string
  urlTitle: string | null
  urlSite: string | null
  imageUrl: string | null
  price: { cents: number; currency: string } | null
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
      ...(item.notes && { notes: item.notes }),
      status: item.status,
      position: item.position ?? (await lastPosition(item.listId)) + 1000,
      ...(item.due && { due_at: item.due.at.toISOString(), all_day: item.due.allDay }),
      ...(item.recurrence && { recurrence: item.recurrence }),
      ...(item.link && {
        url: item.link.url,
        url_title: item.link.urlTitle,
        url_site: item.link.urlSite,
        image_url: item.link.imageUrl,
        // El trigger `items_track_price` apunta este primer precio en el histórico.
        ...(item.link.price && {
          price_cents: item.link.price.cents,
          currency: item.link.price.currency,
          price_source: 'web' as const,
        }),
      }),
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
 * estado traducido y lo que se quita (`changeKindPatch`), para que el trigger los valide a la vez.
 * Una fecha límite se guarda como las 00:00 locales con `all_day = true` (04 §Fechas); la de un
 * evento, con su hora, salvo que sea de todo el día (`allDay`, 2.4).
 */
export async function updateItem(itemId: string, patch: ItemPatch): Promise<void> {
  const row: ItemUpdate = {}
  if (patch.title !== undefined) row.title = itemTitleSchema.parse(patch.title)
  if (patch.notes !== undefined) row.notes = patch.notes?.trim() ? patch.notes.trim() : null
  if (patch.sealed !== undefined) {
    row.protected = patch.sealed !== null
    row.sealed_notes = patch.sealed?.sealed ?? null
    row.sealed_iv = patch.sealed?.iv ?? null
    row.sealed_key_id = patch.sealed?.keyId ?? null
  }
  if (patch.priority !== undefined) row.fields = fieldsFor(patch.priority)
  if (patch.allDay !== undefined) {
    // Un evento: el día con su hora, o de todo el día.
    if (patch.dueAt !== undefined) row.due_at = patch.dueAt?.toISOString() ?? null
    row.all_day = patch.allDay
  } else if (patch.dueAt !== undefined) {
    row.due_at = patch.dueAt ? startOfDay(patch.dueAt).toISOString() : null
    row.all_day = patch.dueAt !== null
  }
  if (patch.status !== undefined) row.status = patch.status
  if (patch.kind !== undefined) row.kind = patch.kind
  if (patch.chooseOne !== undefined) row.choose_one = patch.chooseOne
  if (patch.chosenId !== undefined) row.chosen_id = patch.chosenId
  if (patch.url !== undefined) row.url = patch.url
  if (patch.urlTitle !== undefined) row.url_title = patch.urlTitle
  if (patch.imageUrl !== undefined) row.image_url = patch.imageUrl
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

/**
 * Guarda el orden a mano (2.9): las posiciones nuevas. Casi siempre es una fila (el punto medio
 * entre sus vecinos); al renumerar, varias, en paralelo.
 */
export async function updateItemPositions(changes: readonly Positioned[]): Promise<void> {
  const results = await Promise.all(
    changes.map(({ id, position }) => supabase.from('items').update({ position }).eq('id', id)),
  )
  const failed = results.find((result) => result.error)
  if (failed?.error) throw failed.error
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
 *
 * Las compras con varias tiendas (2.2b) vuelven con todas (4.1), en una segunda llamada: la tienda
 * tiene que encontrar su compra. Al llegar todas a la vez, `item_links_sync` ya ve dos o más y le
 * pone a la compra el enlace de la primera y el precio de la más barata. Comprada no lo recalcula:
 * dónde se compró (`price_link_id`) se vuelve a apuntar al final, cuando esa tienda ya existe.
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
      // Una sublista elegida vuelve con su elegida, que llega en el mismo `insert`.
      choose_one: item.chooseOne,
      chosen_id: item.chosenId,
      title: item.title,
      notes: item.notes,
      // Una protegida vuelve con lo cifrado tal cual (5.7).
      protected: item.sealed !== null,
      sealed_notes: item.sealed?.sealed ?? null,
      sealed_iv: item.sealed?.iv ?? null,
      sealed_key_id: item.sealed?.keyId ?? null,
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
      // La tienda del precio, para que el histórico diga la buena y no la primera.
      price_store: item.priceStore,
      price_followed: item.priceTracking !== null,
    })),
    { onConflict: 'id', ignoreDuplicates: true },
  )
  if (error) throw error

  // Sus fotos (4.5): con los mismos ids; `item_images_sync` vuelve a poner la primera.
  const images = ordered.flatMap((item) =>
    item.images.map((image) => ({ ...image, item_id: item.id })),
  )
  if (images.length > 0) await insertImages(images)
  // Y sus documentos (6.1), igual.
  const files = ordered.flatMap((item) => item.files.map((file) => ({ ...file, item_id: item.id })))
  if (files.length > 0) await insertFiles(files)

  const links = ordered.flatMap((item) => item.links.map((link) => linkRow(item.id, link)))
  if (links.length === 0) return
  const { error: linksError } = await supabase
    .from('item_links')
    .upsert(links, { onConflict: 'id', ignoreDuplicates: true })
  if (linksError) throw linksError

  const bought = ordered.filter((item) => item.status === 'bought' && item.priceLinkId !== null)
  const results = await Promise.all(
    bought.map((item) =>
      supabase.from('items').update({ price_link_id: item.priceLinkId }).eq('id', item.id),
    ),
  )
  const failed = results.find((result) => result.error)
  if (failed?.error) throw failed.error
}

/**
 * Lo que salió de una inbox y sigue en otra lista, con el nombre de esa lista: la sección «Fuera
 * de la cabeza» de «En mente» lo enseña como «movida a Casa · lunes». El embed necesita el nombre
 * de la clave (`items_list_id_fkey`) porque `items` tiene dos claves hacia `lists`. Lo movido a una
 * lista oculta no sale (5.8): diría su nombre.
 */
export async function fetchMovedFromInbox(inboxId: string): Promise<MovedItem[]> {
  const { data, error } = await supabase
    .from('items')
    .select('id, title, left_inbox_at, list:lists!items_list_id_fkey(name)')
    .eq('left_inbox_id', inboxId)
    .neq('list_id', inboxId)
    .eq('in_hidden_list', false)
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
    links.map((link) => linkRow(itemId, link)),
    { onConflict: 'id', ignoreDuplicates: true },
  )
  if (error) throw error
}

/** Una tienda como fila de `item_links`. */
function linkRow(
  itemId: string,
  link: ItemLink,
): Database['public']['Tables']['item_links']['Insert'] {
  return {
    id: link.id,
    item_id: itemId,
    url: link.url,
    url_title: link.urlTitle,
    url_site: link.urlSite,
    price_cents: link.priceCents,
    currency: link.currency,
    price_source: link.priceSource,
    price_checked_at: link.priceCheckedAt?.toISOString() ?? null,
    // La de siempre sigue en seguimiento si lo estaba, aunque su precio fuera a mano (3.8).
    price_followed: link.priceTracking !== null,
    position: link.position,
  }
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

/**
 * Las veces hechas de tareas que se repiten entre dos momentos (3.6, `item_completions`), con la
 * tarea como está ahora y de listas sin archivar. RLS deja solo las de listas que ves. Sin las de
 * tus listas ocultas (5.8), como Hoy.
 */
export async function fetchCompletions(start: Date, end: Date): Promise<Completion[]> {
  const { data, error } = await supabase
    .from('item_completions')
    .select(
      `id, done_at, done_by, occurrence, item:items!inner(${ITEM_COLUMNS}, list:lists!items_list_id_fkey!inner(id))`,
    )
    .gte('done_at', start.toISOString())
    .lt('done_at', end.toISOString())
    .is('item.list.archived_at', null)
    .eq('item.in_hidden_list', false)
    .order('done_at', { ascending: false })
  if (error) throw error
  return data.map((row) => ({
    id: row.id,
    item: mapItemRow(row.item),
    doneAt: new Date(row.done_at),
    doneBy: row.done_by,
    occurrence: new Date(row.occurrence),
  }))
}

/** Deshace la última vez hecha de una tarea que se repite: vuelve a la fecha que tenía. */
export async function undoRepeat(itemId: string): Promise<void> {
  const { error } = await supabase.rpc('undo_repeat', { p_item_id: itemId })
  if (error) throw error
}

/**
 * Añade fotos a cosas (4.5), con sus ids generados en el cliente: subir, «Deshacer» un borrado y
 * duplicar. El trigger `item_images_sync` pone la primera en la cosa. Idempotente, como
 * `createItem`.
 */
export async function insertImages(
  images: readonly (ItemImage & { item_id: string })[],
): Promise<void> {
  const { error } = await supabase.from('item_images').upsert(
    images.map((image) => ({
      id: image.id,
      item_id: image.item_id,
      path: image.path,
      position: image.position,
    })),
    { onConflict: 'id', ignoreDuplicates: true },
  )
  if (error) throw error
}

/** Cambia una foto de sitio («Poner la primera», arrastrar) o de archivo («Cambiar»). */
export async function updateImage(
  imageId: string,
  patch: Partial<Pick<ItemImage, 'path' | 'position'>>,
): Promise<void> {
  const { error } = await supabase.from('item_images').update(patch).eq('id', imageId)
  if (error) throw error
}

/** Quita una foto. Su archivo lo borra después la limpieza de huérfanas (2.8). */
export async function deleteImage(imageId: string): Promise<void> {
  const { error } = await supabase.from('item_images').delete().eq('id', imageId)
  if (error) throw error
}

/**
 * Añade documentos a cosas (6.1), con sus ids generados en el cliente: subir y «Deshacer» un
 * borrado. Idempotente, como `insertImages`.
 */
export async function insertFiles(
  files: readonly (ItemFile & { item_id: string })[],
): Promise<void> {
  const { error } = await supabase.from('item_files').upsert(
    files.map((file) => ({
      id: file.id,
      item_id: file.item_id,
      path: file.path,
      name: file.name,
      mime: file.mime,
      size_bytes: file.sizeBytes,
      position: file.position,
    })),
    { onConflict: 'id', ignoreDuplicates: true },
  )
  if (error) throw error
}

/** Quita un documento. Su archivo lo borra después la limpieza de huérfanos. */
export async function deleteFile(fileId: string): Promise<void> {
  const { error } = await supabase.from('item_files').delete().eq('id', fileId)
  if (error) throw error
}
