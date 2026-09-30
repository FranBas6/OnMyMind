import { addDays, differenceInCalendarDays, format, isSameYear, startOfDay } from 'date-fns'

import { isFinalStatus, PRIORITY_LABELS, type Item, type Priority } from '@/features/items'
import type { List } from '@/features/lists'

/**
 * El día de Hoy en la zona del dispositivo: de las 00:00 de hoy a las 00:00 de mañana. Una fecha
 * sin hora se guarda como las 00:00 locales (04 §Fechas), así que «vence hoy» es `start ≤ dueAt <
 * end` y «atrasada», `dueAt < start`.
 */
export function todayBounds(now: Date): { start: Date; end: Date } {
  const start = startOfDay(now)
  return { start, end: addDays(start, 1) }
}

/** El día como texto (`2026-09-28`): va en la clave de la consulta, que cambia a medianoche. */
export function dayKey(now: Date): string {
  return format(now, 'yyyy-MM-dd')
}

export function isOverdue(item: Item, now: Date): boolean {
  return item.dueAt !== null && item.dueAt < startOfDay(now)
}

/**
 * El chip rojo de una tarea atrasada (pantalla 7): «Atrasada · ayer», el día de la semana hasta
 * seis días atrás («Atrasada · martes») y, después, la fecha («Atrasada · 3 sep»).
 */
export function overdueLabel(dueAt: Date, now: Date): string {
  const days = differenceInCalendarDays(now, dueAt)
  if (days === 1) return 'Atrasada · ayer'
  if (days < 7) return `Atrasada · ${format(dueAt, 'EEEE')}`
  return `Atrasada · ${format(dueAt, isSameYear(dueAt, now) ? 'd MMM' : 'd MMM yyyy')}`
}

export interface TodayMeta {
  /** El chip «Atrasada · ayer», solo si lo está. */
  overdue: string | null
  /** La línea en texto (pantalla 7): «Vence hoy · Prioridad alta»; vacía si no hay nada. */
  detail: string
}

/**
 * Lo que va bajo el título de una fila de Hoy. En Hoy la meta va en texto y no en chips: la fecha
 * ya se sabe (es hoy) y solo la atrasada lleva chip.
 */
export function todayMeta(item: Item, now: Date): TodayMeta {
  const overdue = item.dueAt && isOverdue(item, now) ? overdueLabel(item.dueAt, now) : null
  const parts = overdue ? [] : ['Vence hoy']
  if (item.priority) parts.push(`Prioridad ${PRIORITY_LABELS[item.priority].toLowerCase()}`)
  return { overdue, detail: parts.join(' · ') }
}

export interface TodaySection {
  list: List
  items: Item[]
}

export interface TodayDone {
  item: Item
  list: List
}

export interface TodayGroups {
  /** Una sección por lista, en el orden de las listas. */
  sections: TodaySection[]
  /** «2 hechas hoy»: lo que vencía hasta hoy y se ha terminado hoy, lo último primero. */
  done: TodayDone[]
  /** Lo que queda por hacer (el contador de Hoy en el sidebar). */
  pending: number
}

interface GroupOptions {
  now: Date
  /**
   * Recién terminados que se quedan 400 ms en su sección antes de irse a «hechas hoy», como en el
   * detalle de lista (06 §Interacción).
   */
  lingering?: ReadonlySet<string>
}

const PRIORITY_RANK: Record<Priority, number> = { high: 0, medium: 1, low: 2 }
const rank = (item: Item) => (item.priority ? PRIORITY_RANK[item.priority] : 3)

/**
 * Atrasadas primero (la más antigua arriba), luego lo de hoy; a igualdad, la prioridad más alta y,
 * al final, el orden de la lista. En fase 1 las tareas no tienen hora: el «luego por hora» del
 * plan es por día. Los eventos, con hora, entran en fase 2.
 */
function byUrgency(a: Item, b: Item): number {
  return (
    (a.dueAt?.getTime() ?? 0) - (b.dueAt?.getTime() ?? 0) ||
    rank(a) - rank(b) ||
    a.position - b.position
  )
}

/**
 * Reparte lo que trae la consulta de Hoy por listas (02 §Hoy). La consulta ya filtra, pero se
 * vuelve a comprobar aquí con la hora del dispositivo: así los cambios optimistas (completar,
 * cambiar la fecha, mover a otra lista) se ven al instante, y una lista archivada o que ya no es
 * de tareas deja de salir sin esperar a la red. El nombre y el color salen de las listas en caché.
 */
export function groupToday(
  items: readonly Item[],
  lists: readonly List[],
  { now, lingering }: GroupOptions,
): TodayGroups {
  const { start, end } = todayBounds(now)
  const byId = new Map(lists.map((list) => [list.id, list]))
  const sections = new Map<string, TodaySection>()
  const done: TodayDone[] = []

  for (const item of items) {
    const list = byId.get(item.listId)
    if (!list || item.kind !== 'task' || !item.dueAt || item.dueAt >= end) continue
    if (isFinalStatus(item.status) && !lingering?.has(item.id)) {
      if (item.completedAt && item.completedAt >= start) done.push({ item, list })
      continue
    }
    const section = sections.get(list.id) ?? { list, items: [] }
    section.items.push(item)
    sections.set(list.id, section)
  }

  const ordered = [...sections.values()].sort((a, b) => a.list.position - b.list.position)
  for (const section of ordered) section.items.sort(byUrgency)
  done.sort((a, b) => (b.item.completedAt?.getTime() ?? 0) - (a.item.completedAt?.getTime() ?? 0))

  const pending = ordered.reduce(
    (total, section) => total + section.items.filter((item) => !isFinalStatus(item.status)).length,
    0,
  )
  return { sections: ordered, done, pending }
}

/** «1 hecha hoy» / «3 hechas hoy». */
export function doneTodayLabel(count: number): string {
  return `${count} ${count === 1 ? 'hecha' : 'hechas'} hoy`
}
