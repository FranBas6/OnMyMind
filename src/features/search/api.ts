import { ITEM_COLUMNS, mapItemRow, type Item } from '@/features/items'
import { supabase } from '@/lib/supabase/client'

/**
 * Todos los ítems de todas tus listas, también de las archivadas y lo terminado: Buscar filtra en
 * el cliente en fase 1 (03 §Consultas clave). Sin filtro por usuario: RLS ya deja solo lo tuyo.
 * A escala personal son cientos de filas; el límite de 1000 filas de PostgREST (`max_rows`) es
 * el aviso de que habrá que paginar o pasar la búsqueda al servidor (fase 3). Sin lo de tus listas
 * ocultas (5.8): no salen en Buscar ni desbloqueadas.
 */
export async function fetchAllItems(): Promise<Item[]> {
  const { data, error } = await supabase
    .from('items')
    .select(ITEM_COLUMNS)
    .eq('in_hidden_list', false)
    .order('created_at', { ascending: false })

  if (error) throw error
  return data.map(mapItemRow)
}
