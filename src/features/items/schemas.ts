import { z } from 'zod'

import { parseTaskFields } from './fields'
import { ITEM_STATUSES } from './status'
import type { Item } from './types'

/** Mismo límite que el `check` de `items.title` (03 §items). */
export const ITEM_TITLE_MAX_LENGTH = 300

/** Título de un ítem nuevo: sin espacios alrededor y entre 1 y 300 caracteres. */
export const itemTitleSchema = z.string().trim().min(1).max(ITEM_TITLE_MAX_LENGTH)

const itemStatusSchema = z.enum(ITEM_STATUSES)

/** Las columnas que la app lee de `items` (todas las consultas piden estas). */
export const ITEM_COLUMNS =
  'id, list_id, title, notes, status, fields, position, due_at, all_day, recurrence, completed_at, created_at'

export interface ItemRow {
  id: string
  list_id: string
  title: string
  notes: string | null
  status: string
  fields: unknown
  position: number
  due_at: string | null
  all_day: boolean
  recurrence: string | null
  completed_at: string | null
  created_at: string
}

const toDate = (value: string | null) => (value === null ? null : new Date(value))

/** Fila de Supabase → ítem de la app (fechas como `Date`, estado validado, prioridad de `fields`). */
export function mapItemRow(row: ItemRow): Item {
  return {
    id: row.id,
    listId: row.list_id,
    title: row.title,
    notes: row.notes,
    status: itemStatusSchema.parse(row.status),
    priority: parseTaskFields(row.fields).priority ?? null,
    dueAt: toDate(row.due_at),
    allDay: row.all_day,
    recurrence: row.recurrence,
    position: row.position,
    completedAt: toDate(row.completed_at),
    createdAt: new Date(row.created_at),
  }
}
