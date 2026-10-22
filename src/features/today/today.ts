import {
  addDays,
  differenceInCalendarDays,
  endOfMonth,
  format,
  isMatch,
  isSameMonth,
  isSameYear,
  parseISO,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from 'date-fns'

import {
  isActiveSublistStatus,
  isFinalStatus,
  occurrence,
  occurrencesBetween,
  occursOn,
  PRIORITY_LABELS,
  type Completion,
  type Item,
  type Priority,
} from '@/features/items'
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

/** El día de un `?day=2026-10-14`, o `null` si no es una fecha de verdad. */
export function parseDayKey(text: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text) || !isMatch(text, 'yyyy-MM-dd')) return null
  return parseISO(text)
}

/** El lunes de la semana de un día: la semana empieza en lunes (06 §Calendario). */
export function weekStart(day: Date): Date {
  return startOfWeek(day, { weekStartsOn: 1 })
}

/**
 * La rejilla de un mes en el calendario de Hoy: del lunes de la semana del día 1 al lunes después
 * de la semana del último (este no entra). Es lo que se pide de una vez para los puntos.
 */
export function monthGrid(month: Date): { start: Date; end: Date } {
  return {
    start: weekStart(startOfMonth(month)),
    end: addDays(weekStart(endOfMonth(month)), 7),
  }
}

/**
 * El mes que se pide para la tira de una semana: el de su lunes. Su rejilla siempre llega al
 * domingo de esa semana, aunque la semana acabe ya en el mes siguiente.
 */
export function stripMonth(day: Date): Date {
  return startOfMonth(weekStart(day))
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

/**
 * Un ítem de Hoy con su sublista, si está dentro de una: su nombre para la ruta y su estado para
 * callarlo si está pausada o hecha (la consulta la trae con `parent:parent_id(status, title)`).
 */
export type TodayItem = Item & { parent?: { status: string; title: string } | null }

export interface TodayMeta {
  /** El chip «Atrasada · ayer», solo si lo está. */
  overdue: string | null
  /** La línea en texto (pantalla 7): «Vence hoy · Prioridad alta»; vacía si no hay nada. */
  detail: string
}

/**
 * Lo que va bajo el título de una fila de Hoy. En Hoy la meta va en texto y no en chips: la fecha
 * ya se sabe (es hoy) y solo la atrasada lleva chip. Lo de dentro de una sublista empieza por su
 * ruta: «Develop › OnMyMind · Vence hoy» (diseño 12, A1).
 */
export function todayMeta(
  item: TodayItem,
  now: Date,
  listName?: string,
  { otherDay = false }: { otherDay?: boolean } = {},
): TodayMeta {
  const overdue =
    !otherDay && item.dueAt && isOverdue(item, now) ? overdueLabel(item.dueAt, now) : null
  const route = item.parent && listName ? [`${listName} › ${item.parent.title}`] : []
  // En otro día (diseño 17, C2): «Vence ese día».
  const parts = overdue ? route : [...route, otherDay ? 'Vence ese día' : 'Vence hoy']
  if (item.priority) parts.push(`Prioridad ${PRIORITY_LABELS[item.priority].toLowerCase()}`)
  return { overdue, detail: parts.join(' · ') }
}

export interface TodaySection {
  list: List
  items: TodayItem[]
}

export interface TodayDone {
  item: TodayItem
  list: List
  /**
   * Una vez hecha de una tarea que se repite (3.6): la tarea siguió a su siguiente fecha, y esto es
   * la constancia. El checkbox la deshace.
   */
  completion?: Completion
}

/**
 * Las veces hechas de un día como filas de «hechas» (diseño 21, B12 y B13): la tarea tachada, con
 * la hora a la que se hizo. Solo las de listas en caché (las demás no se ven en Hoy).
 */
export function completionsOnDay(
  completions: readonly Completion[],
  lists: readonly List[],
  day: Date,
): TodayDone[] {
  const byId = new Map(lists.map((list) => [list.id, list]))
  const { start, end } = todayBounds(day)
  return completions.flatMap((completion) => {
    const list = byId.get(completion.item.listId)
    if (!list || completion.doneAt < start || completion.doneAt >= end) return []
    const item: TodayItem = {
      ...completion.item,
      parent: null,
      status: 'done',
      completedAt: completion.doneAt,
      completedBy: completion.doneBy,
    }
    return [{ item, list, completion }]
  })
}

/** Lo hecho, con las veces hechas de lo que se repite, lo último primero. */
export function withCompletions(done: readonly TodayDone[], extra: readonly TodayDone[]) {
  return [...done, ...extra].sort(
    (a, b) => (b.item.completedAt?.getTime() ?? 0) - (a.item.completedAt?.getTime() ?? 0),
  )
}

export interface TodayEvent {
  item: TodayItem
  list: List
}

/** Una nota apuntada ese día, con su lista: «Apuntado hoy» (Fran, 2026-10-22). */
export interface TodayNote {
  item: TodayItem
  list: List
}

export interface TodayGroups {
  /**
   * «Agenda» (diseño 17, H1): los eventos de hoy de cualquier lista, también los que se repiten,
   * arriba y por hora; primero los de todo el día.
   */
  agenda: TodayEvent[]
  /** Una sección por lista, en el orden de las listas. */
  sections: TodaySection[]
  /**
   * «Hecho hoy»: lo terminado hoy (hecho o comprado) de cualquier lista, con fecha o sin ella, lo
   * último primero (Fran, 2026-10-22; antes, solo lo que vencía hasta hoy).
   */
  done: TodayDone[]
  /** «Apuntado hoy»: las notas creadas hoy, la última primero. */
  noted: TodayNote[]
  /** Lo que queda por hacer (el contador de Hoy en el sidebar). */
  pending: number
  /** Sublistas pausadas con algo para hoy dentro, que no sale: «Lo de «Roma» no sale…» (A1). */
  paused: string[]
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
 * Si una fila de la consulta de Hoy sale: lo de dentro de una sublista pausada o hecha se calla
 * (ADR-010). `parent` es el estado de su sublista (`parent:parent_id(status)`), o `null`.
 */
export function showsInToday(row: { parent?: { status: string } | null }): boolean {
  return !row.parent || isActiveSublistStatus(row.parent.status)
}

/** Lo último primero: lo terminado por cuándo se terminó y lo apuntado por cuándo se creó. */
const latestDone = (a: TodayDone, b: TodayDone) =>
  (b.item.completedAt?.getTime() ?? 0) - (a.item.completedAt?.getTime() ?? 0)
const latestNoted = (a: TodayNote, b: TodayNote) =>
  b.item.createdAt.getTime() - a.item.createdAt.getTime()

/**
 * Reparte lo que trae la consulta de Hoy por listas (02 §Hoy). Lo de dentro de una sublista
 * pausada o hecha se calla (ADR-010); de las pausadas se guarda el nombre para decirlo. La consulta ya filtra, pero se
 * vuelve a comprobar aquí con la hora del dispositivo: así los cambios optimistas (completar,
 * cambiar la fecha, mover a otra lista) se ven al instante, y una lista archivada o que ya no es
 * de tareas deja de salir sin esperar a la red. El nombre y el color salen de las listas en caché.
 */
export function groupToday(
  items: readonly TodayItem[],
  lists: readonly List[],
  { now, lingering }: GroupOptions,
): TodayGroups {
  const { start, end } = todayBounds(now)
  const byId = new Map(lists.map((list) => [list.id, list]))
  const sections = new Map<string, TodaySection>()
  const done: TodayDone[] = []
  const noted: TodayNote[] = []
  const agenda: TodayEvent[] = []
  const paused = new Set<string>()

  for (const item of items) {
    const list = byId.get(item.listId)
    if (!list) continue
    if (item.kind === 'event') {
      // Lo cancelado no sale (F11); lo de una sublista pausada o hecha se calla, como las tareas.
      if (item.status === 'upcoming' && showsInToday(item) && occursOn(item, now)) {
        agenda.push({ item, list })
      }
      continue
    }
    if (item.kind === 'note') {
      if (item.createdAt >= start && item.createdAt < end) noted.push({ item, list })
      continue
    }
    // Lo que vence hasta hoy tiene su sección; recién terminado, se queda en ella 400 ms.
    const due = item.kind === 'task' && item.dueAt !== null && item.dueAt < end
    if (isFinalStatus(item.status) && !(due && lingering?.has(item.id))) {
      // Lo hecho hoy cuenta aunque no tuviera fecha o esté en una sublista callada: es lo que se
      // ha quitado de la cabeza.
      if (DONE_STATUSES.has(item.status) && item.completedAt && item.completedAt >= start) {
        done.push({ item, list })
      }
      continue
    }
    if (!due) continue
    if (!showsInToday(item)) {
      if (item.parent?.status === 'paused' && !isFinalStatus(item.status)) {
        paused.add(item.parent.title)
      }
      continue
    }
    const section = sections.get(list.id) ?? { list, items: [] }
    section.items.push(item)
    sections.set(list.id, section)
  }

  const ordered = [...sections.values()].sort((a, b) => a.list.position - b.list.position)
  for (const section of ordered) section.items.sort(byUrgency)
  done.sort(latestDone)
  noted.sort(latestNoted)
  agenda.sort(byTime(now))

  const pending = ordered.reduce(
    (total, section) => total + section.items.filter((item) => !isFinalStatus(item.status)).length,
    0,
  )
  return { agenda, sections: ordered, done, noted, pending, paused: [...paused] }
}

/** Si un día es antes, el mismo o después que hoy. */
export type DayTense = 'past' | 'today' | 'future'

export function dayTense(day: Date, today: Date): DayTense {
  const days = differenceInCalendarDays(day, today)
  return days < 0 ? 'past' : days === 0 ? 'today' : 'future'
}

export interface DayGroups {
  /** Sus eventos, también los que se repiten, como la «Agenda» de Hoy. */
  agenda: TodayEvent[]
  /** Un día que viene: lo que vence ese día, por listas. */
  sections: TodaySection[]
  /** Un día pasado: «Hecho ese día», lo terminado ese día de cualquier lista, lo último primero. */
  done: TodayDone[]
  /** Un día pasado: «Apuntado ese día», las notas creadas ese día, la última primero. */
  noted: TodayNote[]
}

/** Lo que se cuenta como hecho un día: lo terminado, no lo descartado ni lo cancelado. */
const DONE_STATUSES: ReadonlySet<string> = new Set(['done', 'bought'])

function isOnDay(date: Date | null, day: Date): date is Date {
  return date !== null && differenceInCalendarDays(date, day) === 0
}

/** La agenda de un día por hora: lo de todo el día primero (diseño 17, H1). */
function byTime(day: Date) {
  return (a: TodayEvent, b: TodayEvent) =>
    Number(b.item.allDay) - Number(a.item.allDay) ||
    (occurrence(a.item, day)?.getTime() ?? 0) - (occurrence(b.item, day)?.getTime() ?? 0) ||
    a.list.position - b.list.position ||
    a.item.position - b.item.position
}

/**
 * Otro día en Hoy (diseño 17, C2 y C4), con lo que trae la consulta de su mes (`fetchDays`). Un
 * día que viene enseña sus eventos y lo que vence ese día; uno pasado, sus eventos (atenuados en
 * la pantalla) y «Hecho ese día», lo que se terminó ese día (decisión de Fran, 2026-10-05). Lo que
 * venció ese día y sigue pendiente no sale en uno pasado: está en Hoy, atrasado. Y, desde el
 * 2026-10-22, las notas apuntadas ese día («Apuntado ese día»). Hoy es
 * `groupToday`. Como allí, se vuelve a filtrar con las listas en caché.
 */
export function groupDay(
  items: readonly TodayItem[],
  lists: readonly List[],
  { day, today, lingering }: { day: Date; today: Date; lingering?: ReadonlySet<string> },
): DayGroups {
  const tense = dayTense(day, today)
  const byId = new Map(lists.map((list) => [list.id, list]))
  const agenda: TodayEvent[] = []
  const sections = new Map<string, TodaySection>()
  const done: TodayDone[] = []
  const noted: TodayNote[] = []

  for (const item of items) {
    const list = byId.get(item.listId)
    if (!list) continue
    if (item.kind === 'event') {
      if (item.status === 'upcoming' && showsInToday(item) && occursOn(item, day)) {
        agenda.push({ item, list })
      }
      continue
    }
    if (item.kind === 'note') {
      if (tense === 'past' && isOnDay(item.createdAt, day)) noted.push({ item, list })
      continue
    }
    if (tense === 'past') {
      if (DONE_STATUSES.has(item.status) && isOnDay(item.completedAt, day)) {
        done.push({ item, list })
      }
      continue
    }
    const pending = !isFinalStatus(item.status) || lingering?.has(item.id) === true
    if (item.kind !== 'task' || !pending || !showsInToday(item) || !isOnDay(item.dueAt, day)) {
      continue
    }
    const section = sections.get(list.id) ?? { list, items: [] }
    section.items.push(item)
    sections.set(list.id, section)
  }

  const ordered = [...sections.values()].sort((a, b) => a.list.position - b.list.position)
  for (const section of ordered) section.items.sort(byUrgency)
  done.sort(latestDone)
  noted.sort(latestNoted)
  agenda.sort(byTime(day))
  return { agenda, sections: ordered, done, noted }
}

/**
 * Los días con algo entre `start` y `end`: el punto bajo el día en la tira y en el mes (diseño 17,
 * C1 y D4). Un punto quiere decir que ese día no sale vacío: sus eventos (también las veces de lo
 * que se repite), lo que vence (en hoy o después), lo hecho y las notas apuntadas (hasta hoy). Lo
 * que vencía un día pasado y sigue pendiente no lo marca, como no sale en él.
 */
export function markedDays(
  items: readonly TodayItem[],
  lists: readonly List[],
  { start, end, today }: { start: Date; end: Date; today: Date },
): Set<string> {
  const listIds = new Set(lists.map((list) => list.id))
  const marked = new Set<string>()
  const tomorrow = addDays(startOfDay(today), 1)
  for (const item of items) {
    if (!listIds.has(item.listId)) continue
    if (item.kind === 'event') {
      if (item.status !== 'upcoming' || !showsInToday(item)) continue
      for (const at of occurrencesBetween(item, start, end)) marked.add(dayKey(at))
      continue
    }
    if (item.kind === 'note') {
      const { createdAt } = item
      if (createdAt < tomorrow && createdAt >= start && createdAt < end) {
        marked.add(dayKey(createdAt))
      }
      continue
    }
    const { completedAt, dueAt } = item
    if (DONE_STATUSES.has(item.status) && completedAt && completedAt < tomorrow) {
      if (completedAt >= start && completedAt < end) marked.add(dayKey(completedAt))
      continue
    }
    if (
      item.kind === 'task' &&
      !isFinalStatus(item.status) &&
      showsInToday(item) &&
      dueAt &&
      dueAt >= startOfDay(today) &&
      dueAt >= start &&
      dueAt < end
    ) {
      marked.add(dayKey(dueAt))
    }
  }
  return marked
}

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1)

/** Hasta cuántos días de distancia la cabecera dice «dentro de 3 días» (como los grupos, E2). */
const RELATIVE_DAYS = 27

/**
 * El título de un día en Hoy (diseño 17, C2 y C5): «Hoy»; en otro día de este mes, «Jueves 25»;
 * en otro mes, «Sábado 15 nov»; y en otro año, «Sábado 15 nov 2027».
 */
export function dayTitle(day: Date, today: Date): string {
  if (dayTense(day, today) === 'today') return 'Hoy'
  const pattern = isSameMonth(day, today)
    ? 'EEEE d'
    : isSameYear(day, today)
      ? 'EEEE d MMM'
      : 'EEEE d MMM yyyy'
  return capitalize(format(day, pattern))
}

/**
 * La línea sobre el título de otro día (diseño 17, C2, C4 y C5): «Hoy es lunes 22 · dentro de 3
 * días», «… · hace 10 días», «… · mañana»; con el mes si el día es de otro («Hoy es lunes 22
 * sep»), y sin la distancia pasadas cuatro semanas. En hoy, la fecha de siempre.
 */
export function dayEyebrow(day: Date, today: Date): string | null {
  const days = differenceInCalendarDays(day, today)
  if (days === 0) return null
  const base = `Hoy es ${format(today, isSameMonth(day, today) ? 'EEEE d' : 'EEEE d MMM')}`
  if (Math.abs(days) > RELATIVE_DAYS) return base
  const distance =
    days === 1
      ? 'mañana'
      : days === -1
        ? 'ayer'
        : days > 0
          ? `dentro de ${days} días`
          : `hace ${-days} días`
  return `${base} · ${distance}`
}

/**
 * El vacío de otro día (diseño 17, C3): «Nada para el sábado 27.» y «Lo que tenga ese día como
 * fecha saldrá aquí.». El de un día pasado no está dibujado: «Nada del viernes 12.».
 */
export function emptyDay(day: Date, today: Date): { title: string; body: string } {
  const name = dayTitle(day, today).toLowerCase()
  return dayTense(day, today) === 'past'
    ? { title: `Nada del ${name}.`, body: 'Ese día no tenía nada con fecha ni marcaste nada.' }
    : { title: `Nada para el ${name}.`, body: 'Lo que tenga ese día como fecha saldrá aquí.' }
}

/** Las cabeceras de lo hecho y lo apuntado (Fran, 2026-10-22): en Hoy, plegadas; otro día, no. */
export function dayLogLabel(kind: 'done' | 'noted', tense: 'today' | 'past'): string {
  const verb = kind === 'done' ? 'Hecho' : 'Apuntado'
  return `${verb} ${tense === 'today' ? 'hoy' : 'ese día'}`
}

/**
 * La línea bajo Hoy cuando algo no sale porque su sublista está pausada (diseño 12, A1): «Lo de
 * «Roma» no sale: la sublista está pausada.», o con varias, «Lo de «Roma» y «Oporto» no sale: las
 * sublistas están pausadas.».
 */
export function pausedNote(names: readonly string[]): string | null {
  if (names.length === 0) return null
  const quoted = names.map((name) => `«${name}»`)
  const joined =
    quoted.length === 1
      ? quoted.join('')
      : `${quoted.slice(0, -1).join(', ')} y ${quoted.at(-1) ?? ''}`
  return names.length === 1
    ? `Lo de ${joined} no sale: la sublista está pausada.`
    : `Lo de ${joined} no sale: las sublistas están pausadas.`
}
