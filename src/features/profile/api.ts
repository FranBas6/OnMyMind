import { supabase } from '@/lib/supabase/client'

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
