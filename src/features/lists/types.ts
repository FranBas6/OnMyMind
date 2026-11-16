import type { ListColor } from '@/features/lists/icons/listColors'
import type { Database } from '@/lib/supabase/database.types'

export type { ListColor } from '@/features/lists/icons/listColors'

/**
 * Desde la 5.3 (ADR-012) las listas no tienen tipo: `inbox` distingue «En mente» y `list` es una
 * lista cualquiera. `tasks`, `shopping` y `events` son de las listas de antes y no significan nada.
 */
export type ListKind = Database['public']['Enums']['list_kind']

/** Cómo se ve una lista: en filas o por días, como agenda (5.3). */
export type ListView = 'list' | 'agenda'

/** Lo que decide los textos de una lista: «En mente», una lista o una agenda. */
export type ListStyle = 'inbox' | ListView

/** Cuántas cosas hay de cada tipo en una lista, hechas o no (`list_counters`, 5.3). */
export interface KindTotals {
  note: number
  task: number
  shopping: number
  event: number
}

export interface ListCounters {
  /** Sin completar (los eventos pasados sin repetición ya no cuentan, ni las notas). */
  pending: number
  /** Fuera de la cabeza. */
  done: number
  /** Las notas, que no son algo por hacer: van aparte (5.3). */
  notes: number
  /** Total pendiente en compras, en céntimos. */
  pendingPriceCents: number
  /** Los pagos pendientes (6.3): compras con fecha, se repitan o no: «4 pagos». */
  payments: number
  /** Los que aún están en prueba: «1 en prueba». */
  trials: number
  /**
   * Lo que suman al año los pagos que se repiten, en céntimos (sin los que están en prueba); al mes,
   * su doceava parte. `null` si no hay ninguno: la cabecera dice «Total».
   */
  yearlyCents: number | null
  /** Lo pendiente que no se repite: «60 € de una vez». */
  onceCents: number
  /** De dónde sale el tipo que propone la barra de añadir sin los ítems a mano. */
  kinds: KindTotals
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
  view: ListView
  position: number
  counters: ListCounters
  /** Solo en las archivadas. */
  archivedAt: Date | null
  /**
   * Si la creaste tú. Una lista compartida contigo (3.2) se usa igual por dentro, pero no se edita,
   * ni se archiva, ni se borra, ni se comparte: eso es de quien la creó.
   */
  isOwner: boolean
  /**
   * Oculta para ti (5.8, diseño 27): no sale en Inicio, el sidebar, Hoy, Buscar ni la captura;
   * solo en Perfil › «Listas ocultas», desbloqueando. Es tuyo: los demás la ven como siempre.
   */
  hidden: boolean
}
