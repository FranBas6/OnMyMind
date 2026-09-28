import { startOfDay } from 'date-fns'

import type { Database } from '@/lib/supabase/database.types'
import { supabase } from '@/lib/supabase/client'

import type { MovePatch } from './move'
import { fieldsFor, ITEM_COLUMNS, itemTitleSchema, mapItemRow } from './schemas'
import type { Item, ItemPatch, ItemStatus, MovedItem } from './types'

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

export interface NewItem {
  /** Lo genera el cliente (`crypto.randomUUID()`): el ítem optimista y el real son el mismo. */
  id: string
  listId: string
  title: string
  status: ItemStatus
  position: number
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
      title,
      status: item.status,
      position: item.position,
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
 * notas, prioridad (en `fields`), fecha límite o estado. Una fecha sin hora se guarda como las
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
  const { error } = await supabase.from('items').update(row).eq('id', itemId)
  if (error) throw error
}

/**
 * Mueve un ítem al final de otra lista con su estado traducido y sin los campos que allí no
 * existen (`buildMovePatch`). La posición se pide al servidor, porque la lista destino puede no
 * estar en caché. El rastro de «En mente» lo pone el trigger `items_track_inbox`.
 */
export async function moveItem(itemId: string, patch: MovePatch): Promise<void> {
  const last = await supabase
    .from('items')
    .select('position')
    .eq('list_id', patch.listId)
    .order('position', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (last.error) throw last.error

  const { error } = await supabase
    .from('items')
    .update({
      list_id: patch.listId,
      status: patch.status,
      fields: fieldsFor(patch.priority),
      due_at: patch.dueAt ? patch.dueAt.toISOString() : null,
      all_day: patch.allDay,
      recurrence: patch.recurrence,
      position: (last.data?.position ?? 0) + 1000,
    })
    .eq('id', itemId)
  if (error) throw error
}

export async function deleteItem(itemId: string): Promise<void> {
  const { error } = await supabase.from('items').delete().eq('id', itemId)
  if (error) throw error
}

/**
 * «Deshacer» un borrado: vuelve a insertar el ítem tal cual era, con su mismo id, sus fechas y su
 * rastro de «En mente». Idempotente como `createItem`.
 */
export async function restoreItem(item: Item): Promise<void> {
  const { data: auth } = await supabase.auth.getSession()
  const createdBy = auth.session?.user.id
  if (!createdBy) throw new Error('Sin sesión')

  const { error } = await supabase.from('items').upsert(
    {
      id: item.id,
      list_id: item.listId,
      created_by: createdBy,
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
    },
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
