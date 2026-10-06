import { z } from 'zod'

import { LIST_COLORS } from '@/lib/listColors'
import { Constants, type Database } from '@/lib/supabase/database.types'

import type { List, ListCounters } from './types'

type ListRow = Pick<
  Database['public']['Tables']['lists']['Row'],
  'id' | 'name' | 'color' | 'icon' | 'kind' | 'position'
> & { archived_at?: string | null; is_owner?: boolean }
type CountersRow = Database['public']['Views']['list_counters']['Row']

export const listColorSchema = z.enum(LIST_COLORS)

/**
 * Una fila de la vista `my_lists` (3.2): las listas como las ve quien pregunta, con su orden y si
 * es quien la creó. Postgres da por anulables todas las columnas de una vista; aquí se comprueba.
 */
export const myListRowSchema = z.object({
  id: z.string(),
  name: z.string(),
  color: z.string(),
  icon: z.string().nullable(),
  kind: z.enum(Constants.public.Enums.list_kind),
  position: z.number(),
  archived_at: z.string().nullable(),
  is_owner: z.boolean(),
})

export const LIST_NAME_MAX_LENGTH = 80

/** Tipos que se pueden crear desde el formulario; «Personalizada» se descartó (ADR-011). */
export const CREATABLE_KINDS = ['tasks', 'shopping', 'events'] as const

/**
 * Formulario de crear y editar lista (diseño 04 Listas). El mismo esquema lo usa `api.ts`, así que
 * la base nunca recibe un nombre vacío o de más de 80 caracteres (la tabla también lo impide).
 */
export const listFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, { error: 'Ponle un nombre.' })
    .max(LIST_NAME_MAX_LENGTH, {
      error: (issue) =>
        `Máximo ${LIST_NAME_MAX_LENGTH} caracteres. Llevas ${typeof issue.input === 'string' ? issue.input.length : LIST_NAME_MAX_LENGTH + 1}.`,
    }),
  color: listColorSchema,
  kind: z.enum(CREATABLE_KINDS),
})
export type ListFormValues = z.infer<typeof listFormSchema>

/** `field_schema` de las listas personalizadas (03 §lists); se usa a partir de 1.14. */
export const fieldSchemaSchema = z.object({
  fields: z.array(
    z.object({
      key: z.string().regex(/^[a-z][a-z0-9_]*$/),
      label: z.string().min(1),
      type: z.enum(['text', 'number', 'date', 'image', 'url', 'select']),
      required: z.boolean().optional(),
      options: z.array(z.string()).optional(),
    }),
  ),
})
export type FieldSchema = z.infer<typeof fieldSchemaSchema>

const EMPTY_COUNTERS: ListCounters = { pending: 0, done: 0, pendingPriceCents: 0 }

/**
 * Filas de `lists` + filas de `list_counters` → listas de dominio, en el orden de las filas.
 * Una lista sin fila de contadores (recién creada, o si la vista aún no la ha visto) sale a cero.
 */
export function mergeListsWithCounters(lists: ListRow[], counters: CountersRow[]): List[] {
  const countersById = new Map<string, ListCounters>()
  for (const row of counters) {
    if (!row.list_id) continue
    countersById.set(row.list_id, {
      pending: row.pending_count ?? 0,
      done: row.done_count ?? 0,
      pendingPriceCents: row.pending_price_cents ?? 0,
    })
  }

  return lists.map((row) => ({
    id: row.id,
    name: row.name,
    color: parseColor(row),
    icon: row.icon,
    kind: row.kind,
    position: row.position,
    counters: countersById.get(row.id) ?? EMPTY_COUNTERS,
    archivedAt: row.archived_at ? new Date(row.archived_at) : null,
    // Lo que no viene de `my_lists` (crear una lista) es tuyo.
    isOwner: row.is_owner ?? true,
  }))
}

/** La base ya lo limita con un `check`; si aun así llega otro valor, no se rompe la pantalla. */
function parseColor(row: ListRow): List['color'] {
  const result = listColorSchema.safeParse(row.color)
  if (result.success) return result.data
  console.warn(`[lists] Color desconocido «${row.color}» en la lista ${row.id}; se usa índigo.`)
  return 'indigo'
}
