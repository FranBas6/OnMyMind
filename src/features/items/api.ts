import { supabase } from '@/lib/supabase/client'

import { ITEM_COLUMNS, itemTitleSchema, mapItemRow } from './schemas'
import type { Item, ItemStatus } from './types'

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
