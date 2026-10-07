import { removeAllPhotos } from '@/features/items/photoCleanup'
import { PHOTO_BUCKET, SIGNED_URL_SECONDS } from '@/features/items/photos'
import { supabase } from '@/lib/supabase/client'

import { exportDocument } from './export'
import { displayNameSchema, mergeSettings, parseSettings, type SettingsPatch } from './schemas'
import type { Profile } from './types'

const hasKey = (value: unknown, key: string) =>
  typeof value === 'object' && value !== null && !Array.isArray(value) && key in value

export async function fetchProfile(userId: string): Promise<Profile> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, display_name, avatar_url, settings')
    .eq('id', userId)
    .single()
  if (error) throw error
  return {
    id: data.id,
    displayName: data.display_name,
    avatarUrl: data.avatar_url,
    settings: parseSettings(data.settings),
    themeStored: hasKey(data.settings, 'theme'),
  }
}

/**
 * Guarda un ajuste: lee `settings`, fusiona el cambio y lo escribe. Se lee justo antes para no
 * pisar lo que otro dispositivo haya guardado entretanto, y la fusión conserva claves que esta
 * versión no conoce. Las mutaciones de perfil van en fila, así que dos cambios seguidos no se
 * cruzan. (Con `jsonb || jsonb` en una RPC sería atómico; a escala de una persona basta así.)
 */
export async function updateSettings(userId: string, patch: SettingsPatch): Promise<void> {
  const { data, error } = await supabase
    .from('profiles')
    .select('settings')
    .eq('id', userId)
    .single()
  if (error) throw error
  const { error: updateError } = await supabase
    .from('profiles')
    .update({ settings: mergeSettings(data.settings, patch) })
    .eq('id', userId)
  if (updateError) throw updateError
}

export async function updateDisplayName(userId: string, name: string): Promise<void> {
  const { error } = await supabase
    .from('profiles')
    .update({ display_name: displayNameSchema.parse(name) })
    .eq('id', userId)
  if (error) throw error
}

/** PostgREST devuelve como mucho mil filas por petición: se piden de mil en mil, por `id`. */
const PAGE = 1000

async function allRows(
  page: (
    from: number,
    to: number,
  ) => PromiseLike<{ data: Record<string, unknown>[] | null; error: Error | null }>,
): Promise<Record<string, unknown>[]> {
  const rows: Record<string, unknown>[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await page(from, from + PAGE - 1)
    if (error) throw error
    rows.push(...(data ?? []))
    if (!data || data.length < PAGE) return rows
  }
}

/**
 * Todo lo tuyo, para el JSON de «Exportar mis datos» (diseño 18, P7): el perfil con sus ajustes,
 * las listas (también las archivadas), los ítems (con las sublistas y lo de dentro), las tiendas,
 * el histórico de precios y los avisos. RLS ya deja solo lo tuyo. Las suscripciones a avisos no:
 * son de cada navegador. Las fotos, como URLs firmadas de una semana.
 */
export async function fetchExport(userId: string): Promise<ReturnType<typeof exportDocument>> {
  const [profile, lists, items, itemLinks, itemPrices, reminders, itemCompletions] =
    await Promise.all([
      allRows((from, to) => supabase.from('profiles').select('*').eq('id', userId).range(from, to)),
      allRows((from, to) => supabase.from('lists').select('*').order('id').range(from, to)),
      allRows((from, to) => supabase.from('items').select('*').order('id').range(from, to)),
      allRows((from, to) => supabase.from('item_links').select('*').order('id').range(from, to)),
      allRows((from, to) => supabase.from('item_prices').select('*').order('id').range(from, to)),
      allRows((from, to) => supabase.from('reminders').select('*').order('id').range(from, to)),
      // Las veces hechas de lo que se repite (3.6): hecho no es borrado.
      allRows((from, to) =>
        supabase.from('item_completions').select('*').order('id').range(from, to),
      ),
    ])
  const paths = [
    ...new Set(items.map((item) => item.image_path).filter((path) => typeof path === 'string')),
  ]
  const photoUrls = new Map<string, string>()
  for (let start = 0; start < paths.length; start += 100) {
    const { data, error } = await supabase.storage
      .from(PHOTO_BUCKET)
      .createSignedUrls(paths.slice(start, start + 100), SIGNED_URL_SECONDS)
    if (error) throw error
    for (const entry of data) {
      if (entry.path && entry.signedUrl) photoUrls.set(entry.path, entry.signedUrl)
    }
  }
  return exportDocument(
    {
      profile: profile[0] ?? null,
      lists,
      items,
      itemLinks,
      itemPrices,
      reminders,
      itemCompletions,
    },
    photoUrls,
  )
}

export interface AccountCounts {
  /** Tus listas, sin «En mente» (también las archivadas). No cuentan las compartidas contigo. */
  lists: number
  /** Lo que hay dentro, sin contar las sublistas. */
  items: number
}

/**
 * Lo que se borra con la cuenta, para decirlo en la confirmación (diseño 18, P9). Solo lo tuyo: las
 * listas compartidas contigo no se borran (3.3), y RLS las dejaría contar si no se filtra.
 */
export async function fetchAccountCounts(userId: string): Promise<AccountCounts> {
  const [lists, items] = await Promise.all([
    supabase
      .from('lists')
      .select('id', { count: 'exact', head: true })
      .eq('owner_id', userId)
      .neq('kind', 'inbox'),
    supabase
      .from('items')
      .select('id, list:lists!items_list_id_fkey!inner(owner_id)', { count: 'exact', head: true })
      .eq('list.owner_id', userId)
      .neq('kind', 'sublist'),
  ])
  if (lists.error) throw lists.error
  if (items.error) throw items.error
  return { lists: lists.count ?? 0, items: items.count ?? 0 }
}

/**
 * Borra la cuenta (08 B.11): primero las fotos, con la API de Storage, que es la única que puede;
 * después `delete_own_account`, que borra tu usuario y las cascadas hacen el resto. Si quedara una
 * foto, la base no sigue: así no queda ningún archivo sin dueño.
 */
export async function deleteAccount(): Promise<void> {
  await removeAllPhotos()
  const { error } = await supabase.rpc('delete_own_account')
  if (error) throw error
}
