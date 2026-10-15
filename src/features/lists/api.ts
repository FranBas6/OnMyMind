import { z } from 'zod'

import type { Positioned } from '@/lib/reorder'
import { supabase } from '@/lib/supabase/client'

import {
  listFormSchema,
  mergeListsWithCounters,
  myListRowSchema,
  type ListFormValues,
} from './schemas'
import type { List, ListView, RecentCapture } from './types'

const MY_LIST_COLUMNS = 'id, name, color, icon, kind, view, position, archived_at, is_owner, hidden'

/** Lo que se pide de `list_counters` (5.3: también las notas y cuántas hay de cada tipo). */
const COUNTER_COLUMNS =
  'list_id, pending_count, done_count, pending_price_cents, notes_count, note_total, task_total, shopping_total, event_total'

/**
 * Listas no archivadas, tuyas y compartidas contigo, en tu orden y con sus contadores. Dos
 * consultas en paralelo (`my_lists` y `list_counters`) fusionadas en cliente. No se filtra por
 * usuario: RLS ya lo hace. `my_lists` (3.2) pone tu orden también en las compartidas contigo.
 * Sin las que has ocultado (5.8): esas no se descargan hasta desbloquear (`fetchHiddenLists`).
 */
export async function fetchLists(): Promise<List[]> {
  const [lists, counters] = await Promise.all([
    supabase
      .from('my_lists')
      .select(MY_LIST_COLUMNS)
      .is('archived_at', null)
      .eq('hidden', false)
      .order('position'),
    supabase.from('list_counters').select(COUNTER_COLUMNS),
  ])

  if (lists.error) throw lists.error
  if (counters.error) throw counters.error
  return mergeListsWithCounters(z.array(myListRowSchema).parse(lists.data), counters.data)
}

/** Las últimas capturas pendientes de una lista, de la más nueva a la más antigua. */
export async function fetchRecentCaptures(listId: string, limit: number): Promise<RecentCapture[]> {
  const { data, error } = await supabase
    .from('items')
    .select('id, title, created_at')
    .eq('list_id', listId)
    .is('completed_at', null)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) throw error
  return data.map((row) => ({ id: row.id, title: row.title, createdAt: new Date(row.created_at) }))
}

/**
 * Tus listas archivadas, con sus contadores, de la archivada más recientemente a la más antigua.
 * Las compartidas contigo que archive quien las creó no salen: para ti, desaparecen.
 */
export async function fetchArchivedLists(): Promise<List[]> {
  const [lists, counters] = await Promise.all([
    supabase
      .from('my_lists')
      .select(MY_LIST_COLUMNS)
      .not('archived_at', 'is', null)
      .eq('hidden', false)
      .order('archived_at', { ascending: false }),
    supabase.from('list_counters').select(COUNTER_COLUMNS),
  ])

  if (lists.error) throw lists.error
  if (counters.error) throw counters.error
  return mergeListsWithCounters(z.array(myListRowSchema).parse(lists.data), counters.data)
}

/**
 * Tus listas ocultas (5.8, diseño 27), archivadas incluidas, en tu orden y con sus contadores. Solo
 * se piden desbloqueado (`useHiddenLists`).
 */
export async function fetchHiddenLists(): Promise<List[]> {
  const [lists, counters] = await Promise.all([
    supabase.from('my_lists').select(MY_LIST_COLUMNS).eq('hidden', true).order('position'),
    supabase.from('list_counters').select(COUNTER_COLUMNS),
  ])

  if (lists.error) throw lists.error
  if (counters.error) throw counters.error
  return mergeListsWithCounters(z.array(myListRowSchema).parse(lists.data), counters.data)
}

/** Cuáles has ocultado: solo los ids, sin nada de dentro (RLS deja solo las tuyas). */
export async function fetchHiddenListIds(): Promise<string[]> {
  const { data, error } = await supabase.from('hidden_lists').select('list_id')
  if (error) throw error
  return data.map((row) => row.list_id)
}

/**
 * «Ocultar» (5.8): solo para ti. Si era tu lista por defecto de la captura, la base la deja en
 * «En mente» (`hidden_lists_after_insert`).
 */
export async function hideList(listId: string): Promise<void> {
  const { error } = await supabase.from('hidden_lists').insert({ list_id: listId })
  // Ya estaba oculta (otro aparato): da igual.
  if (error && error.code !== '23505') throw error
}

/** «Mostrar»: vuelve a Inicio y al sidebar, en su sitio de antes. */
export async function showList(listId: string): Promise<void> {
  const { error } = await supabase.from('hidden_lists').delete().eq('list_id', listId)
  if (error) throw error
}

/**
 * Crea una lista al final de las demás (`position` = la mayor + 1000). El propietario es quien
 * tiene la sesión: RLS exige `owner_id = auth.uid()`. Valida con el esquema del formulario.
 */
export async function createList(values: ListFormValues, position: number): Promise<List> {
  const { name, color, icon = null } = listFormSchema.parse(values)
  const { data: auth } = await supabase.auth.getSession()
  const ownerId = auth.session?.user.id
  if (!ownerId) throw new Error('Sin sesión')

  const { data, error } = await supabase
    .from('lists')
    // Sin tipo (5.3): la base le pone `list`, y se ve como lista.
    .insert({ owner_id: ownerId, name, color, icon, position })
    .select('id, name, color, icon, kind, view, position')
    .single()

  if (error) throw error
  const [list] = mergeListsWithCounters([data], [])
  if (!list) throw new Error('La lista creada no ha vuelto')
  return list
}

/** Cambia nombre, color y el cuadrado (5.9). Las listas ya no tienen tipo (5.3). */
export async function updateList(listId: string, values: ListFormValues): Promise<void> {
  const { name, color, icon } = listFormSchema.parse(values)
  const { error } = await supabase
    .from('lists')
    .update({ name, color, ...(icon !== undefined && { icon }) })
    .eq('id', listId)
  if (error) throw error
}

/** Cómo se ve la lista: en filas o por días (5.5, «Lista · Agenda»). Solo quien la creó. */
export async function updateListView(listId: string, view: ListView): Promise<void> {
  const { error } = await supabase.from('lists').update({ view }).eq('id', listId)
  if (error) throw error
}

export async function archiveList(listId: string): Promise<void> {
  const { error } = await supabase
    .from('lists')
    .update({ archived_at: new Date().toISOString() })
    .eq('id', listId)
  if (error) throw error
}

export async function unarchiveList(listId: string): Promise<void> {
  const { error } = await supabase.from('lists').update({ archived_at: null }).eq('id', listId)
  if (error) throw error
}

/**
 * Guarda el orden a mano de las listas (2.9): sus posiciones nuevas, casi siempre una. Una sola
 * llamada que pone tu orden donde toca: en `lists` las tuyas, en tu fila de `list_members` las
 * compartidas contigo (3.2), sin mover las de nadie.
 */
export async function updateListPositions(changes: readonly Positioned[]): Promise<void> {
  const { error } = await supabase.rpc('set_list_positions', {
    p_changes: changes.map(({ id, position }) => ({ id, position })),
  })
  if (error) throw error
}

/** Borra la lista y, en cascada, sus ítems. La inbox la protege el trigger `lists_protect_inbox`. */
export async function deleteList(listId: string): Promise<void> {
  const { error } = await supabase.from('lists').delete().eq('id', listId)
  if (error) throw error
}

const duplicatedSchema = z.object({
  list_id: z.uuid(),
  items: z.number().int().nonnegative(),
  photos: z.array(z.object({ item_id: z.uuid(), path: z.string(), position: z.number().int() })),
})

/** Lo que devuelve duplicar: la copia, cuántas cosas tiene y las fotos subidas que faltan. */
export interface DuplicatedList {
  listId: string
  items: number
  photos: { itemId: string; path: string; position: number }[]
}

/**
 * Duplica una lista (4.4, diseño 23, C) con `duplicate_list`, de una vez en la base: la copia es
 * tuya, con todo pendiente, sin fechas, avisos ni personas. Las fotos subidas no se comparten entre
 * dos ítems: vuelven aquí para copiarlas en Storage (`copyItemPhoto`).
 */
export async function duplicateList(listId: string, name: string): Promise<DuplicatedList> {
  const { data, error } = await supabase.rpc('duplicate_list', {
    p_list_id: listId,
    p_name: name,
  })
  if (error) throw error
  const parsed = duplicatedSchema.parse(data)
  return {
    listId: parsed.list_id,
    items: parsed.items,
    photos: parsed.photos.map((photo) => ({
      itemId: photo.item_id,
      path: photo.path,
      position: photo.position,
    })),
  }
}
