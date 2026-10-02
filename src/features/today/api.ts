import { ITEM_COLUMNS, mapItemRow } from '@/features/items'
import { supabase } from '@/lib/supabase/client'

import { todayBounds, type TodayItem } from './today'

/**
 * Lo que sale en Hoy (03 §Consultas clave): tareas que vencen hoy o antes, estén en la lista que
 * estén (el tipo es del ítem, ADR-009), de listas sin archivar. No filtra por usuario: RLS ya deja
 * solo tus listas, y así valdrá igual para las compartidas en fase 3. El embed de la lista
 * (`!inner`, por la clave `items_list_id_fkey`, porque `items` tiene dos hacia `lists`) solo sirve
 * para filtrar por su archivo: el nombre y el color se leen de las listas en caché, que se
 * mantienen al día solas al renombrar o mover.
 *
 * Lo de dentro de una sublista trae su nombre y su estado (`parent:parent_id`, el padre;
 * `items!parent_id` serían los hijos): el nombre es la ruta de la fila («Develop › OnMyMind»,
 * diseño 12, A1) y el estado decide si se calla (ADR-010). Lo callado no se descarta aquí sino en
 * `groupToday`, que así puede decir «Lo de «Roma» no sale: la sublista está pausada.». Son pocas
 * filas (las tareas con fecha de hoy o antes) y la consulta sigue usando `items_due_idx`.
 *
 * Son dos peticiones en paralelo: lo pendiente, que usa `items_due_idx` (parcial, `completed_at is
 * null`), y lo terminado hoy, para «2 hechas hoy». Juntas en un `or` el índice ya no serviría.
 *
 * Los eventos de hoy («Agenda», 2.4) van en una tercera: los próximos con fecha de hoy, y los que se
 * repiten y ya han empezado (su vez de hoy la calcula `groupToday` con `occursOn`).
 */
export async function fetchToday(now: Date): Promise<TodayItem[]> {
  const { start, end } = todayBounds(now)
  const base = (kind: 'task' | 'event') =>
    supabase
      .from('items')
      .select(
        `${ITEM_COLUMNS}, list:lists!items_list_id_fkey!inner(id), parent:parent_id(status, title)`,
      )
      .eq('kind', kind)
      .is('list.archived_at', null)
      .lt('due_at', end.toISOString())
      .order('due_at')

  const [pending, done, events] = await Promise.all([
    base('task').is('completed_at', null),
    base('task').gte('completed_at', start.toISOString()),
    base('event')
      .eq('status', 'upcoming')
      .or(`due_at.gte."${start.toISOString()}",recurrence.not.is.null`),
  ])
  if (pending.error) throw pending.error
  if (done.error) throw done.error
  if (events.error) throw events.error
  return [...pending.data, ...done.data, ...events.data].map((row) => ({
    ...mapItemRow(row),
    parent: row.parent,
  }))
}
