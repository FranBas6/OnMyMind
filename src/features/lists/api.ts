import { supabase } from '@/lib/supabase/client'

import { mergeListsWithCounters } from './schemas'
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
