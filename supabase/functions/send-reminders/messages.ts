// Lo puro de send-reminders (04 §send-reminders, sesión 2.7): qué se envía de cada aviso vencido,
// con qué texto, y el resumen de Hoy. Sin Deno ni red, para probarlo con Vitest desde la app, como
// `fetch-metadata/metadata.ts`. Lo que depende de la zona horaria lo resuelve la base
// (`claim_due_reminders` y `claim_daily_summaries`), que entrega las fechas ya en la zona del
// usuario como «2026-10-08T10:00»; aquí solo se comparan y se escriben. Lo del push (el mensaje, VAPID)
// está en `_shared/push.ts`, que comparte con `refresh-prices`.

import type { PushMessage } from '../_shared/push.ts'

/**
 * Cuánto puede llegar tarde un aviso y seguir enviándose (decisión de Fran, 2026-10-05). Más tarde
 * (el envío estuvo parado) se descarta: mejor eso que una lluvia de avisos viejos de golpe.
 */
export const GRACE_MINUTES = 15

/** Un aviso vencido, como lo devuelve `claim_due_reminders`. */
export interface DueReminder {
  reminderId: string
  userId: string
  itemId: string
  listId: string
  title: string
  kind: string
  allDay: boolean
  listName: string
  remindAt: Date
  /** El momento del ítem del que avisa (la vez que toca, si se repite); `null` sin fecha. */
  occursAt: Date | null
  /** Ese momento y ahora, en la zona del usuario: «2026-10-08T10:00». */
  occursLocal: string | null
  nowLocal: string
  /** Terminado (hecho, comprado, cancelado). */
  done: boolean
  /** Callado: en una lista archivada o en una sublista pausada o hecha. */
  hidden: boolean
}

/** Algo de hoy para el resumen, como lo devuelve `claim_daily_summaries`, ya en su orden. */
export interface SummaryEntry {
  userId: string
  kind: string
  title: string
  allDay: boolean
  occursLocal: string
  overdue: boolean
}

export type ReminderPlan =
  { send: true; message: PushMessage } | { send: false; reason: 'done' | 'hidden' | 'late' }

/** Qué hacer con un aviso vencido: su mensaje, o por qué no sale. */
export function planReminder(reminder: DueReminder, now: Date): ReminderPlan {
  if (reminder.done) return { send: false, reason: 'done' }
  if (reminder.hidden) return { send: false, reason: 'hidden' }
  if (now.getTime() - reminder.remindAt.getTime() > GRACE_MINUTES * 60_000) {
    return { send: false, reason: 'late' }
  }
  return {
    send: true,
    message: {
      title: reminder.title,
      body: reminderBody(reminder, now),
      url: `/lists/${reminder.listId}?item=${reminder.itemId}`,
      // Un aviso nuevo del mismo ítem (la vez siguiente) sustituye al anterior.
      tag: `reminder:${reminder.itemId}`,
    },
  }
}

/**
 * El texto de debajo del título (diseño 18, N1 y N2): cuándo es y de qué lista. Con hora, «En 1 h ·
 * 10:00 · Agenda», contado desde ahora, así uno que sale unos minutos tarde no miente; sin hora,
 * «Vence hoy · Casa» en una tarea y «Hoy · Agenda» en un evento; sin fecha, solo la lista.
 */
export function reminderBody(reminder: DueReminder, now: Date): string {
  const { occursAt, occursLocal, listName } = reminder
  if (!occursAt || !occursLocal) return listName
  const days = daysBetween(reminder.nowLocal, occursLocal)
  const day = shortDay(occursLocal, reminder.nowLocal)

  if (reminder.kind === 'event' && !reminder.allDay) {
    const time = occursLocal.slice(11, 16)
    const when = days === 0 ? untilLabel(occursAt, now) : days === 1 ? 'Mañana' : day
    return [when, time, listName].join(' · ')
  }

  if (reminder.kind === 'event') {
    const when = days === 0 ? 'Hoy' : days === 1 ? 'Mañana' : day
    return [when, listName].join(' · ')
  }

  const lower = day.charAt(0).toLowerCase() + day.slice(1)
  const when =
    days === 0
      ? 'Vence hoy'
      : days === 1
        ? 'Vence mañana'
        : days === -1
          ? 'Venció ayer'
          : days < 0
            ? `Venció el ${lower}`
            : `Vence el ${lower}`
  return [when, listName].join(' · ')
}

/**
 * Cuánto falta, hoy: «Ahora», «En 10 min», «En 1 h», «En 1 h 30 min». Redondea hacia arriba: el
 * de «1 hora antes» sale unos segundos después de su minuto y debe decir «En 1 h», no «En 59 min».
 */
export function untilLabel(occursAt: Date, now: Date): string {
  const minutes = Math.ceil((occursAt.getTime() - now.getTime()) / 60_000)
  if (minutes <= 0) return 'Ahora'
  if (minutes < 60) return `En ${minutes} min`
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return rest === 0 ? `En ${hours} h` : `En ${hours} h ${rest} min`
}

/**
 * El resumen de Hoy de una persona (diseño 18, N3): «3 cosas para hoy» y «Dentista a las 10:00,
 * Pagar el alquiler y 1 más». Sin nada para hoy, no hay resumen («Si no hay nada, no llega»).
 */
export function summaryMessage(entries: readonly SummaryEntry[]): PushMessage | null {
  const count = entries.length
  if (count === 0) return null
  const names = entries.map((entry) =>
    entry.kind === 'event' && !entry.allDay
      ? `${entry.title} a las ${entry.occursLocal.slice(11, 16)}`
      : entry.title,
  )
  const [first = '', second = ''] = names
  const body =
    count === 1
      ? first
      : count === 2
        ? `${first} y ${second}`
        : `${first}, ${second} y ${count - 2} más`
  return {
    title: count === 1 ? '1 cosa para hoy' : `${count} cosas para hoy`,
    body,
    url: '/today',
    // El de mañana sustituye al de hoy si aún sigue en la pantalla.
    tag: 'summary',
  }
}

// Los días y meses como los escribe la app (`EEE` de `date-fns` en español y «sep», no «sept»).
const WEEKDAYS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb']
const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

/** El día de una fecha local («2026-10-08T…») como número de días desde 1970, sin zona. */
function dayNumber(local: string): number {
  const [year = 0, month = 1, day = 1] = local.slice(0, 10).split('-').map(Number)
  return Date.UTC(year, month - 1, day) / 86_400_000
}

/** Días de calendario de `from` a `to` (las dos, fechas locales). */
export function daysBetween(from: string, to: string): number {
  return dayNumber(to) - dayNumber(from)
}

/**
 * El día corto, como `shortDay` de la app (`features/items/events.ts`): «Jue 8» en el mismo mes,
 * «Lun 2 nov» en otro y «Lun 4 ene 2027» en otro año. Hoy y mañana los dice quien lo usa.
 */
export function shortDay(local: string, nowLocal: string): string {
  const date = new Date(dayNumber(local) * 86_400_000)
  const weekday = WEEKDAYS[date.getUTCDay()] ?? ''
  const capitalized = weekday.charAt(0).toUpperCase() + weekday.slice(1)
  const sameYear = local.slice(0, 4) === nowLocal.slice(0, 4)
  const sameMonth = sameYear && local.slice(5, 7) === nowLocal.slice(5, 7)
  const dayOfMonth = String(date.getUTCDate())
  if (sameMonth) return `${capitalized} ${dayOfMonth}`
  const month = MONTHS[date.getUTCMonth()] ?? ''
  return sameYear
    ? `${capitalized} ${dayOfMonth} ${month}`
    : `${capitalized} ${dayOfMonth} ${month} ${local.slice(0, 4)}`
}

/** Una fila de `claim_due_reminders` (en snake_case, de la base) como `DueReminder`. */
export function toDueReminder(row: Record<string, unknown>): DueReminder | null {
  const text = (key: string) => (typeof row[key] === 'string' ? (row[key] as string) : null)
  const date = (key: string) => {
    const value = text(key)
    if (value === null) return null
    const parsed = new Date(value)
    return Number.isNaN(parsed.getTime()) ? null : parsed
  }
  const reminderId = text('reminder_id')
  const userId = text('user_id')
  const itemId = text('item_id')
  const listId = text('list_id')
  const remindAt = date('remind_at')
  const nowLocal = text('now_local')
  if (!reminderId || !userId || !itemId || !listId || !remindAt || !nowLocal) return null
  return {
    reminderId,
    userId,
    itemId,
    listId,
    title: text('title') ?? '',
    kind: text('kind') ?? 'task',
    allDay: row.all_day === true,
    listName: text('list_name') ?? '',
    remindAt,
    occursAt: date('occurs_at'),
    occursLocal: text('occurs_local'),
    nowLocal,
    done: row.done === true,
    hidden: row.hidden === true,
  }
}

/** Una fila de `claim_daily_summaries` como `SummaryEntry`. */
export function toSummaryEntry(row: Record<string, unknown>): SummaryEntry | null {
  const { user_id: userId, kind, title, occurs_local: occursLocal } = row
  if (typeof userId !== 'string' || typeof occursLocal !== 'string') return null
  return {
    userId,
    kind: typeof kind === 'string' ? kind : 'task',
    title: typeof title === 'string' ? title : '',
    allDay: row.all_day === true,
    occursLocal,
    overdue: row.overdue === true,
  }
}

/** Lo del resumen, por persona y en el orden en que llega. */
export function groupByUser(entries: readonly SummaryEntry[]): Map<string, SummaryEntry[]> {
  const byUser = new Map<string, SummaryEntry[]>()
  for (const entry of entries) {
    const list = byUser.get(entry.userId) ?? []
    list.push(entry)
    byUser.set(entry.userId, list)
  }
  return byUser
}
