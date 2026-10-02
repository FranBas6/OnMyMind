import { z } from 'zod'

import type { Json } from '@/lib/supabase/database.types'

export const THEMES = ['light', 'dark', 'system'] as const
export type Theme = (typeof THEMES)[number]

/** Hasta dónde se puede alargar el nombre (diseño 09 Perfil: contador 0/50). */
export const DISPLAY_NAME_MAX_LENGTH = 50

/**
 * `profiles.settings` tal como se guarda (JSONB, claves en snake_case; 03 §profiles). Cada clave
 * tiene su valor por defecto y `catch`: una clave que falta, o que otra versión de la app dejó con
 * basura, se lee con su valor por defecto en vez de romper la pantalla.
 */
const settingsRowSchema = z.object({
  theme: z.enum(THEMES).default('system').catch('system'),
  /** Sin valor, «En mente» (lo resuelve quien la usa: aquí no se sabe su id). */
  default_list_id: z.uuid().nullable().default(null).catch(null),
  daily_summary_time: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
    .nullable()
    .default(null)
    .catch(null),
  price_drop_alerts: z.boolean().default(false).catch(false),
  timezone: z.string().min(1).default('Europe/Madrid').catch('Europe/Madrid'),
})

/** Los ajustes en la app, con nombres de TypeScript. */
export interface Settings {
  theme: Theme
  defaultListId: string | null
  dailySummaryTime: string | null
  priceDropAlerts: boolean
  timezone: string
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const isJsonObject = (value: Json | undefined): value is Record<string, Json | undefined> =>
  isRecord(value)

/** Lee `settings` sin fiarse de su forma: si no es un objeto, todo con sus valores por defecto. */
export function parseSettings(raw: unknown): Settings {
  const row = settingsRowSchema.parse(isRecord(raw) ? raw : {})
  return {
    theme: row.theme,
    defaultListId: row.default_list_id,
    dailySummaryTime: row.daily_summary_time,
    priceDropAlerts: row.price_drop_alerts,
    timezone: row.timezone,
  }
}

/** Lo que la app puede cambiar de `settings` en fase 1. */
export interface SettingsPatch {
  theme?: Theme
  defaultListId?: string | null
}

/**
 * Fusiona un cambio sobre lo guardado conservando lo que la app no conoce (claves de otra
 * versión o de fases posteriores): nunca se escribe `settings` entero desde cero.
 */
export function mergeSettings(
  raw: Json | undefined,
  patch: SettingsPatch,
): Record<string, Json | undefined> {
  const next = isJsonObject(raw) ? { ...raw } : {}
  if (patch.theme !== undefined) next.theme = patch.theme
  if (patch.defaultListId !== undefined) next.default_list_id = patch.defaultListId
  return next
}

/** El nombre que se muestra: sin espacios alrededor, entre 1 y 50 caracteres. */
export const displayNameSchema = z
  .string()
  .trim()
  .min(1, { error: 'Ponle un nombre.' })
  .max(DISPLAY_NAME_MAX_LENGTH, { error: `Máximo ${DISPLAY_NAME_MAX_LENGTH} caracteres.` })

/** Si el nombre es aún el que puso el alta: la parte del email antes de la @ (`handle_new_user`). */
export function isNameFromEmail(displayName: string | null, email: string | undefined): boolean {
  if (!email) return false
  return (displayName ?? '') === email.split('@')[0]
}

/** La inicial de tu nombre para el avatar, o «·» mientras no hay nombre. */
export function initialOf(name: string | null | undefined): string {
  const trimmed = name?.trim() ?? ''
  return trimmed === '' ? '·' : trimmed.charAt(0).toUpperCase()
}
