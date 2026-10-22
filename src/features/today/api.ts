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
 * Van en peticiones en paralelo: lo pendiente, que usa `items_due_idx` (parcial, `completed_at is
 * null`), y lo terminado hoy de cualquier tipo y lista, con fecha o sin ella, para «Hecho hoy»
 * (Fran, 2026-10-22). Juntas en un `or` el índice ya no serviría.
 *
 * Los eventos de hoy («Agenda», 2.4) van en una tercera: los próximos con fecha de hoy, y los que se
 * repiten y ya han empezado (su vez de hoy la calcula `groupToday` con `occursOn`). Y en una
 * cuarta, las notas apuntadas hoy, para «Apuntado hoy».
 */
export async function fetchToday(now: Date): Promise<TodayItem[]> {
  const { start, end } = todayBounds(now)
  const [pending, done, events, notes] = await Promise.all([
    dated('task').lt('due_at', end.toISOString()).is('completed_at', null).order('due_at'),
    doneBetween(start, end),
    upcomingEvents(start, end),
    notesBetween(start, end),
  ])
  return rows(pending, done, events, notes)
}

/**
 * Lo de unos días (la rejilla de un mes, `monthGrid`) para ver otro día en Hoy y poner los puntos
 * del calendario (sesión 2.5, diseño 17): lo pendiente que vence en esos días, lo terminado en
 * ellos (de cualquier tipo: «Hecho ese día»), los eventos, con los que se repiten y empezaron
 * antes (sus veces las calcula `occurrencesBetween`), y las notas apuntadas en ellos («Apuntado
 * ese día»). También en peticiones separadas, por los índices.
 */
export async function fetchDays(start: Date, end: Date): Promise<TodayItem[]> {
  const [pending, done, events, notes] = await Promise.all([
    dated('task')
      .gte('due_at', start.toISOString())
      .lt('due_at', end.toISOString())
      .is('completed_at', null)
      .order('due_at'),
    doneBetween(start, end),
    upcomingEvents(start, end),
    notesBetween(start, end),
  ])
  return rows(pending, done, events, notes)
}

/**
 * Los ítems con su lista (para filtrar las archivadas) y su sublista, si están en una. Sin lo de
 * tus listas ocultas (5.8): ni se descarga.
 */
function items() {
  return supabase
    .from('items')
    .select(
      `${ITEM_COLUMNS}, list:lists!items_list_id_fkey!inner(id), parent:parent_id(status, title)`,
    )
    .is('list.archived_at', null)
    .eq('in_hidden_list', false)
}

function dated(kind: 'task' | 'event') {
  return items().eq('kind', kind)
}

/** Lo terminado entre dos días, de cualquier tipo: hecho o comprado (no lo descartado). */
function doneBetween(start: Date, end: Date) {
  return items()
    .in('status', ['done', 'bought'])
    .gte('completed_at', start.toISOString())
    .lt('completed_at', end.toISOString())
    .order('completed_at')
}

/** Las notas apuntadas entre dos días: creadas en ellos, estén en la lista que estén. */
function notesBetween(start: Date, end: Date) {
  return items()
    .eq('kind', 'note')
    .gte('created_at', start.toISOString())
    .lt('created_at', end.toISOString())
    .order('created_at')
}

/** Los eventos próximos entre dos días, y los que se repiten y ya han empezado antes del final. */
function upcomingEvents(start: Date, end: Date) {
  return dated('event')
    .eq('status', 'upcoming')
    .lt('due_at', end.toISOString())
    .or(`due_at.gte."${start.toISOString()}",recurrence.not.is.null`)
    .order('due_at')
}

type ItemsResult = Awaited<ReturnType<typeof items>>

function rows(...results: ItemsResult[]): TodayItem[] {
  return results.flatMap((result) => {
    if (result.error) throw result.error
    return result.data.map((row) => ({ ...mapItemRow(row), parent: row.parent }))
  })
}
