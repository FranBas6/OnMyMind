import type { ListColor } from '@/lib/listColors'
import type { Database } from '@/lib/supabase/database.types'

export type { ListColor } from '@/lib/listColors'

export type ListKind = Database['public']['Enums']['list_kind']

export interface ListCounters {
  /** Sin completar (los eventos pasados sin repetición ya no cuentan). */
  pending: number
  /** Fuera de la cabeza. */
  done: number
  /** Total pendiente en compras, en céntimos. */
  pendingPriceCents: number
}

/** Una captura reciente, para la vista previa de «En mente» en escritorio. */
export interface RecentCapture {
  id: string
  title: string
  createdAt: Date
}

export interface List {
  id: string
  name: string
  color: ListColor
  /** Nombre de icono de lucide; `null` = inicial del nombre. */
  icon: string | null
  kind: ListKind
  position: number
  counters: ListCounters
}
