import type { Positioned } from '@/lib/reorder'
import { supabase } from '@/lib/supabase/client'

import { listFormSchema, mergeListsWithCounters, type ListFormValues } from './schemas'
import type { List, RecentCapture } from './types'

/**
 * Listas no archivadas del usuario, en su orden, con sus contadores. Dos consultas en paralelo
 * (tabla y vista) fusionadas en cliente. No se filtra por usuario: RLS ya lo hace, y así la
 * misma consulta servirá para listas compartidas (fase 3).
 */
export async function fetchLists(): Promise<List[]> {
  const [lists, counters] = await Promise.all([
    supabase
      .from('lists')
      .select('id, name, color, icon, kind, position')
      .is('archived_at', null)
      .order('position'),
    supabase
      .from('list_counters')
      .select('list_id, pending_count, done_count, pending_price_cents'),
  ])

  if (lists.error) throw lists.error
  if (counters.error) throw counters.error
  return mergeListsWithCounters(lists.data, counters.data)
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

/** Listas archivadas, con sus contadores, de la archivada más recientemente a la más antigua. */
export async function fetchArchivedLists(): Promise<List[]> {
  const [lists, counters] = await Promise.all([
    supabase
      .from('lists')
      .select('id, name, color, icon, kind, position, archived_at')
      .not('archived_at', 'is', null)
      .order('archived_at', { ascending: false }),
    supabase
      .from('list_counters')
      .select('list_id, pending_count, done_count, pending_price_cents'),
  ])

  if (lists.error) throw lists.error
  if (counters.error) throw counters.error
  return mergeListsWithCounters(lists.data, counters.data)
}

/**
 * Crea una lista al final de las demás (`position` = la mayor + 1000). El propietario es quien
 * tiene la sesión: RLS exige `owner_id = auth.uid()`. Valida con el esquema del formulario.
 */
export async function createList(values: ListFormValues, position: number): Promise<List> {
  const { name, color, kind } = listFormSchema.parse(values)
  const { data: auth } = await supabase.auth.getSession()
  const ownerId = auth.session?.user.id
  if (!ownerId) throw new Error('Sin sesión')

  const { data, error } = await supabase
    .from('lists')
    .insert({ owner_id: ownerId, name, color, kind, position })
    .select('id, name, color, icon, kind, position')
    .single()

  if (error) throw error
  const [list] = mergeListsWithCounters([data], [])
  if (!list) throw new Error('La lista creada no ha vuelto')
  return list
}

/** Cambia nombre y color (y el tipo, si la lista no tiene ítems: lo decide la interfaz). */
export async function updateList(listId: string, values: ListFormValues): Promise<void> {
  const { name, color, kind } = listFormSchema.parse(values)
  const { error } = await supabase.from('lists').update({ name, color, kind }).eq('id', listId)
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

/** Borra la lista y, en cascada, sus ítems. La inbox la protege el trigger `lists_protect_inbox`. */
/** Guarda el orden a mano de las listas (2.9): sus posiciones nuevas, casi siempre una. */
export async function updateListPositions(changes: readonly Positioned[]): Promise<void> {
  const results = await Promise.all(
    changes.map(({ id, position }) => supabase.from('lists').update({ position }).eq('id', id)),
  )
  const failed = results.find((result) => result.error)
  if (failed?.error) throw failed.error
}

export async function deleteList(listId: string): Promise<void> {
  const { error } = await supabase.from('lists').delete().eq('id', listId)
  if (error) throw error
}
