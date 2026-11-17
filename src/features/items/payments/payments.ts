import {
  addDays,
  differenceInCalendarDays,
  format,
  isSameMonth,
  isSameYear,
  startOfDay,
} from 'date-fns'

import { formatCents } from '@/lib/money'

import { parseRule, presetHint, ruleShortLabel, type Freq, type Rule } from '../dates/recurrence'
import { isActiveSublistStatus, isFinalStatus, STATUS_LABELS } from '../status'
import type { Item, ItemStatus } from '../types'

/**
 * Los pagos (6.4, diseño 30). Un pago es una compra con fecha («Fecha de pago»). Si además se
 * repite, es un pago que se repite (una suscripción, un recibo): al pagarlo salta al siguiente cobro
 * y apunta lo pagado (`items_repeat_task`). Si no, es un pago de una vez (la multa).
 */

type PaymentFields = Pick<Item, 'kind' | 'dueAt' | 'recurrence'>

export function isPayment(item: Pick<Item, 'kind' | 'dueAt'>): boolean {
  return item.kind === 'shopping' && item.dueAt !== null
}

export function isRecurringPayment(item: PaymentFields): boolean {
  return isPayment(item) && parseRule(item.recurrence) !== null
}

/**
 * Si se cobra solo (6.5): un pago que se repite con «Se cobra solo». El día del cobro lo apunta la
 * base; no es algo que hacer, así que no sale como pendiente en Hoy ni se pone en rojo.
 */
export function isAutoPayment(item: PaymentFields & Pick<Item, 'autoPay'>): boolean {
  return item.autoPay && isRecurringPayment(item)
}

/**
 * Si aún está en prueba (diseño 30, P1): marcada como prueba y su primer cobro es mañana o después.
 * El día que cobra ya es un pago más (`list_counters` hace lo mismo).
 */
export function inTrial(
  item: PaymentFields & Pick<Item, 'trial'>,
  now: Date = new Date(),
): boolean {
  return (
    item.trial &&
    isRecurringPayment(item) &&
    item.dueAt !== null &&
    item.dueAt >= addDays(startOfDay(now), 1)
  )
}

/** «Pagado» en vez de «Comprado» en una compra con fecha (diseño 30); lo demás, como siempre. */
export function statusLabel(item: Pick<Item, 'kind' | 'dueAt'>, status: ItemStatus): string {
  return status === 'bought' && isPayment(item) ? 'Pagado' : STATUS_LABELS[status]
}

// ─── Fechas ──────────────────────────────────────────────────────────────────────────────────

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1)

/** «jue», sin el punto que pone date-fns. */
const weekday = (day: Date) => format(day, 'EEE').replace('.', '')

/** «12» en el mismo mes, «3 dic» en otro y «3 dic 2027» en otro año. */
function dayOfMonth(day: Date, now: Date): string {
  if (isSameMonth(day, now) && isSameYear(day, now)) return format(day, 'd')
  return format(day, isSameYear(day, now) ? 'd MMM' : 'd MMM yyyy')
}

/** «3 dic», con el año si no es este. */
function dayMonth(day: Date, now: Date): string {
  return format(day, isSameYear(day, now) ? 'd MMM' : 'd MMM yyyy')
}

export type PaymentTone = 'today' | 'overdue' | 'trial' | 'plain'

/**
 * La fecha en la fila (L1, L2): «Jue 3 dic», «Hoy» (en negrita), «Venció el 12» (en rojo) y, de una
 * vez, «Antes del lun 30». En prueba, «Prueba · cobra desde el 20», en índigo (P1).
 */
export function paymentWhen(
  item: PaymentFields & Pick<Item, 'trial' | 'autoPay'>,
  now: Date = new Date(),
): { text: string; tone: PaymentTone } | null {
  const due = item.dueAt
  if (!isPayment(item) || !due) return null
  if (inTrial(item, now)) {
    return { text: `Prueba · cobra desde el ${dayOfMonth(due, now)}`, tone: 'trial' }
  }
  const days = differenceInCalendarDays(due, now)
  // Lo que se cobra solo (6.5) no vence: «Se cobra el 2 dic», sin rojo ni negrita.
  if (isAutoPayment(item)) {
    const when = days <= 0 ? 'hoy' : days === 1 ? 'mañana' : `el ${dayMonth(due, now)}`
    return { text: `Se cobra ${when}`, tone: 'plain' }
  }
  if (days === 0) return { text: 'Hoy', tone: 'today' }
  if (days < 0) return { text: `Venció el ${dayOfMonth(due, now)}`, tone: 'overdue' }
  if (days === 1) return { text: 'Mañana', tone: 'plain' }
  if (!isRecurringPayment(item)) {
    return { text: `Antes del ${weekday(due)} ${dayOfMonth(due, now)}`, tone: 'plain' }
  }
  return { text: `${capitalize(weekday(due))} ${dayMonth(due, now)}`, tone: 'plain' }
}

/**
 * La fecha en la ficha (F1, F6, F7): «Jue 3 dic», «Hoy, 15 nov», «Antes del lun 30 nov» y, pasada,
 * «Venció el mar 10 nov» (en rojo).
 */
export function paymentDateLong(
  item: PaymentFields,
  now: Date = new Date(),
): { text: string; urgent: boolean } | null {
  const due = item.dueAt
  if (!due) return null
  const days = differenceInCalendarDays(due, now)
  const day = `${weekday(due)} ${dayMonth(due, now)}`
  if (days < 0) return { text: `Venció el ${day}`, urgent: true }
  if (days === 0) return { text: `Hoy, ${dayMonth(due, now)}`, urgent: true }
  if (days === 1) return { text: `Mañana, ${dayMonth(due, now)}`, urgent: false }
  if (!isRecurringPayment(item)) return { text: `Antes del ${day}`, urgent: false }
  return { text: capitalize(day), urgent: false }
}

// ─── La repetición ───────────────────────────────────────────────────────────────────────────

const EVERY: Record<Freq, [one: string, many: string]> = {
  DAILY: ['día', 'días'],
  WEEKLY: ['semana', 'semanas'],
  MONTHLY: ['mes', 'meses'],
  YEARLY: ['año', 'años'],
}

/** «Cada mes», «Cada 2 meses». */
function every(rule: Rule): string {
  const [one, many] = EVERY[rule.freq]
  return rule.interval === 1 ? `Cada ${one}` : `Cada ${String(rule.interval)} ${many}`
}

/** Si es una de las de siempre: sin intervalo, sin «el primer lunes» y con un día como mucho. */
function isSimple(rule: Rule): boolean {
  return rule.interval === 1 && rule.nthWeekday === null && rule.weekdays.length <= 1
}

/**
 * La regla de un pago en la fila (L1): «Cada mes · el 3», «Cada año · en marzo», «Cada semana · los
 * jueves». Con `bare`, solo cada cuánto (Hoy, H1: «Cada mes»). Lo personalizado, como en las tareas.
 */
export function paymentRepeatLabel(
  item: Pick<Item, 'dueAt' | 'recurrence'>,
  { bare = false }: { bare?: boolean } = {},
): string | null {
  const rule = parseRule(item.recurrence)
  if (!rule) return null
  if (!isSimple(rule)) return ruleShortLabel(rule)
  if (bare || !item.dueAt) return every(rule)
  const due = item.dueAt
  switch (rule.freq) {
    case 'DAILY':
      return every(rule)
    case 'WEEKLY':
      return `${every(rule)} · ${presetHint('WEEKLY', due) ?? ''}`
    case 'MONTHLY':
      return `${every(rule)} · el ${String(rule.monthDay ?? due.getDate())}`
    case 'YEARLY':
      return `${every(rule)} · en ${format(due, 'MMMM')}`
  }
}

/**
 * Lo que va tras el precio en la ficha (F1, P1): «cada mes», «cada 2 años»; en prueba, «cada mes,
 * desde el 20 nov». `null` si no se repite.
 */
export function priceEvery(
  item: PaymentFields & Pick<Item, 'trial'>,
  now: Date = new Date(),
): string | null {
  const rule = isRecurringPayment(item) ? parseRule(item.recurrence) : null
  if (!rule || !item.dueAt) return null
  const text = every(rule).toLowerCase()
  return inTrial(item, now) ? `${text}, desde el ${dayMonth(item.dueAt, now)}` : text
}

/** Cuándo vuelve, en la fila del menú y en «Hecho hoy» (B1, H2): «vuelve el 3 ene». */
export function returnsShort(next: Date, now: Date = new Date()): string {
  return `vuelve el ${dayMonth(next, now)}`
}

/** El aviso al pagar (F4, H2): «Pagado · vuelve el 3 de enero». */
export function paidToast(next: Date): string {
  return `Pagado · vuelve el ${format(next, "d 'de' MMMM")}`
}

// ─── Lo que suman ────────────────────────────────────────────────────────────────────────────

/** Cuántas veces al año pasa una regla, como `recurrence_per_year` en la base. */
export function perYear(rule: Rule): number {
  const times =
    rule.freq === 'DAILY'
      ? 365
      : rule.freq === 'WEEKLY'
        ? 52 * Math.max(1, rule.weekdays.length)
        : rule.freq === 'MONTHLY'
          ? 12
          : 1
  return times / rule.interval
}

/** Al mes, la doceava parte de lo de un año (diseño 30, L1). */
export function monthlyCents(yearlyCents: number): number {
  return Math.round(yearlyCents / 12)
}

export interface PaymentTotals {
  /** Los pagos pendientes, se repitan o no: «4 pagos». */
  payments: number
  /** Los que aún están en prueba: «1 en prueba». */
  trials: number
  /** Lo que suman al año los que se repiten, sin las pruebas; `null` si no hay ninguno. */
  yearlyCents: number | null
  /**
   * Lo que cuestan una vez los que se repiten, también las pruebas, en euros: lo que se quita del
   * total de siempre para decir lo de una vez («60 € de una vez»).
   */
  recurringCents: number
}

/**
 * Lo de unos ítems (los de una sublista), como `list_counters` en la base: solo lo pendiente y,
 * en el total, solo euros.
 */
export function paymentTotals(items: readonly Item[], now: Date = new Date()): PaymentTotals {
  let payments = 0
  let trials = 0
  let recurring = false
  let yearly = 0
  let recurringCents = 0
  for (const item of items) {
    if (!isPayment(item) || isFinalStatus(item.status)) continue
    payments += 1
    const trial = inTrial(item, now)
    if (trial) trials += 1
    const rule = parseRule(item.recurrence)
    if (!rule) continue
    recurring = true
    if (item.currency === 'EUR' && item.priceCents !== null) recurringCents += item.priceCents
    if (!trial && item.currency === 'EUR' && item.priceCents !== null) {
      yearly += item.priceCents * perYear(rule)
    }
  }
  return { payments, trials, yearlyCents: recurring ? Math.round(yearly) : null, recurringCents }
}

/**
 * El resumen de una lista o sublista con pagos que se repiten (diseño 30, L1 y L2): «4 pagos · 1 en
 * prueba», «5 pagos · 60 € de una vez». `onceCents`, lo pendiente que no se repite.
 */
export function paymentSummary(
  totals: Pick<PaymentTotals, 'payments' | 'trials'>,
  onceCents: number,
): string {
  const parts = [paymentsLabel(totals.payments)]
  if (totals.trials > 0) parts.push(`${String(totals.trials)} en prueba`)
  if (onceCents > 0) parts.push(`${formatCents(onceCents)} de una vez`)
  return parts.join(' · ')
}

/**
 * Lo de una lista que cuenta en sus totales, como en `list_counters`: sin las sublistas y sin lo de
 * dentro de una pausada o hecha.
 */
export function countedItems(items: readonly Item[]): Item[] {
  const silenced = new Set(
    items
      .filter((item) => item.kind === 'sublist' && !isActiveSublistStatus(item.status))
      .map((item) => item.id),
  )
  return items.filter(
    (item) => item.kind !== 'sublist' && (item.parentId === null || !silenced.has(item.parentId)),
  )
}

/** «1 pago», «4 pagos». */
export function paymentsLabel(count: number): string {
  return count === 1 ? '1 pago' : `${String(count)} pagos`
}

/** «43,98 €» al mes de lo que suma al año. */
export function monthlyText(yearlyCents: number): string {
  return formatCents(monthlyCents(yearlyCents))
}
