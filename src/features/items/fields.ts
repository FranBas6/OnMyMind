import { z } from 'zod'

export const PRIORITIES = ['low', 'medium', 'high'] as const
export type Priority = (typeof PRIORITIES)[number]

export const PRIORITY_LABELS: Record<Priority, string> = {
  low: 'Baja',
  medium: 'Media',
  high: 'Alta',
}

/**
 * Campos flexibles (`items.fields`, JSONB) de una tarea. Todo es opcional: una tarea capturada
 * deprisa no tiene nada. Los campos de compras, eventos y personalizadas llegan con sus pantallas.
 */
export const taskFieldsSchema = z.object({
  priority: z.enum(PRIORITIES).optional(),
})
export type TaskFields = z.infer<typeof taskFieldsSchema>

/**
 * Lee `fields` de una fila sin fiarse de su forma: el JSONB lo puede haber escrito otra versión de
 * la app. Si no encaja, se ignora (el ítem se ve igual, sin prioridad) en vez de romper la lista.
 */
export function parseTaskFields(fields: unknown): TaskFields {
  const result = taskFieldsSchema.safeParse(fields)
  return result.success ? result.data : {}
}
