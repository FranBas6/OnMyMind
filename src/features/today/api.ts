import { ITEM_COLUMNS, mapItemRow, type Item } from '@/features/items'
import { supabase } from '@/lib/supabase/client'

import { todayBounds } from './today'

/**
 * Lo que sale en Hoy (03 §Consultas clave): tareas que vencen hoy o antes, de listas de tareas sin
 * archivar. No filtra por usuario: RLS ya deja solo tus listas, y así valdrá igual para las
 * compartidas en fase 3. El embed de la lista (`!inner`, por la clave `items_list_id_fkey`, porque
 * `items` tiene dos hacia `lists`) solo sirve para filtrar por su tipo y su archivo: el nombre y el
 * color se leen de las listas en caché, que se mantienen al día solas al renombrar o mover.
 *
 * Son dos peticiones en paralelo: lo pendiente, que usa `items_due_idx` (parcial, `completed_at is
 * null`), y lo terminado hoy, para «2 hechas hoy». Juntas en un `or` el índice ya no serviría.
 * Los eventos (con hora) se añaden en fase 2 ampliando `kind` (2.7).
 */
export async function fetchToday(now: Date): Promise<Item[]> {
  const { start, end } = todayBounds(now)
  const base = () =>
    supabase
      .from('items')
      .select(`${ITEM_COLUMNS}, list:lists!items_list_id_fkey!inner(id)`)
      .eq('list.kind', 'tasks')
      .is('list.archived_at', null)
      .lt('due_at', end.toISOString())
      .order('due_at')

  const [pending, done] = await Promise.all([
    base().is('completed_at', null),
    base().gte('completed_at', start.toISOString()),
  ])
  if (pending.error) throw pending.error
  if (done.error) throw done.error
  return [...pending.data, ...done.data].map(mapItemRow)
}
