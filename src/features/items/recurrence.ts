import {
  addDays,
  addMonths,
  addWeeks,
  addYears,
  differenceInCalendarDays,
  differenceInCalendarMonths,
  differenceInCalendarWeeks,
  differenceInCalendarYears,
  format,
  getDaysInMonth,
  isSameYear,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from 'date-fns'

/**
 * La repetición de un ítem (3.6, `items.recurrence`): un subconjunto de RRULE (RFC 5545), el mismo
 * que el Calendario del iPhone entiende (3.7).
 * - `FREQ`: DAILY, WEEKLY, MONTHLY o YEARLY.
 * - `INTERVAL`: cada cuántos (1 por defecto, no se escribe).
 * - `BYDAY`: en WEEKLY, los días («MO,TH»); en MONTHLY, uno con su ordinal («1MO» el primer lunes,
 *   «-1FR» el último viernes).
 * - `BYMONTHDAY`: en MONTHLY, el día del mes.
 *
 * Las mismas cuentas están en SQL (`recurrence_occurrence` y `next_occurrence`, migración
 * `custom_recurrence`), con los mismos casos de prueba (`recurrence.cases.ts`): el cliente las usa
 * para pintar y la base para avisar y para mover una tarea al completarla.
 *
 * **Reglas de la casa:**
 * - La fecha del ítem (`due_at`) es siempre una vez de la serie: al poner una regla, la fecha salta a
 *   la primera vez que la cumple (`firstOccurrence`, diseño 21, B6).
 * - Las vueltas se cuentan desde la fecha del ítem. Como una tarea que se repite la mueve al
 *   completarla, «Semanal» y «Mensual» guardan su día (`presetRule`: «BYDAY=FR», «BYMONTHDAY=31»);
 *   si no, una mensual del 31 se quedaría en el 28 después de febrero.
 * - Un día que el mes no tiene (el 31, el 30 de febrero) es el último del mes, como hasta ahora con
 *   «Cada mes»; y el 29 de febrero, el 28 los años que no es bisiesto.
 * - La semana empieza el lunes.
 * - Las horas son las del reloj: un evento a las 10:00 sigue a las 10:00 tras el cambio de hora.
 */

export const WEEKDAYS = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'] as const
export type Weekday = (typeof WEEKDAYS)[number]
export const FREQS = ['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY'] as const
export type Freq = (typeof FREQS)[number]
export const ORDINALS = [1, 2, 3, 4, -1] as const
export type Ordinal = (typeof ORDINALS)[number]

export interface Rule {
  freq: Freq
  /** Cada cuántos días, semanas, meses o años (1 a 999). */
  interval: number
  /** WEEKLY: los días marcados, de lunes a domingo. Vacío: el día de la semana de la fecha. */
  weekdays: Weekday[]
  /** MONTHLY: «el día 15». */
  monthDay: number | null
  /** MONTHLY: «el primer lunes» (`-1`, el último). */
  nthWeekday: { n: Ordinal; day: Weekday } | null
}

/** Lo que había antes de la 3.6 (`daily`, `weekly`…): se lee igual, por si queda en caché. */
const LEGACY: Record<string, Freq> = {
  daily: 'DAILY',
  weekly: 'WEEKLY',
  monthly: 'MONTHLY',
  yearly: 'YEARLY',
}

const MAX_INTERVAL = 999

/** Una regla sin nada más: «Cada día», «Cada semana»… (las opciones de siempre). */
export function simpleRule(freq: Freq): Rule {
  return { freq, interval: 1, weekdays: [], monthDay: null, nthWeekday: null }
}

/** La regla de `items.recurrence`, o `null` si no se repite (o no se entiende: no se adivina). */
export function parseRule(text: string | null | undefined): Rule | null {
  if (!text) return null
  const legacy = LEGACY[text]
  if (legacy) return simpleRule(legacy)
  const parts = new Map<string, string>()
  for (const part of text.split(';')) {
    const [key, value, ...rest] = part.split('=')
    if (!key || value === undefined || rest.length > 0 || parts.has(key)) return null
    parts.set(key, value)
  }
  const freq = parts.get('FREQ')
  if (!freq || !(FREQS as readonly string[]).includes(freq)) return null
  const rule = simpleRule(freq as Freq)
  for (const [key, value] of parts) {
    if (key === 'FREQ') continue
    if (key === 'INTERVAL') {
      const interval = Number(value)
      if (!/^[1-9]\d{0,2}$/.test(value) || interval > MAX_INTERVAL) return null
      rule.interval = interval
    } else if (key === 'BYDAY' && rule.freq === 'WEEKLY') {
      const days = value.split(',')
      if (!days.every((day): day is Weekday => (WEEKDAYS as readonly string[]).includes(day))) {
        return null
      }
      rule.weekdays = WEEKDAYS.filter((day) => days.includes(day))
      if (rule.weekdays.length !== days.length) return null
    } else if (key === 'BYDAY' && rule.freq === 'MONTHLY') {
      const match = /^(-1|[1-4])(MO|TU|WE|TH|FR|SA|SU)$/.exec(value)
      if (!match) return null
      rule.nthWeekday = { n: Number(match[1]) as Ordinal, day: match[2] as Weekday }
    } else if (key === 'BYMONTHDAY' && rule.freq === 'MONTHLY') {
      if (!/^([1-9]|[12]\d|3[01])$/.test(value)) return null
      rule.monthDay = Number(value)
    } else {
      return null
    }
  }
  if (rule.monthDay !== null && rule.nthWeekday !== null) return null
  return rule
}

/** La regla escrita como se guarda, siempre igual para la misma regla. */
export function formatRule(rule: Rule): string {
  const parts = [`FREQ=${rule.freq}`]
  if (rule.interval !== 1) parts.push(`INTERVAL=${String(rule.interval)}`)
  if (rule.freq === 'WEEKLY' && rule.weekdays.length > 0) {
    parts.push(`BYDAY=${WEEKDAYS.filter((day) => rule.weekdays.includes(day)).join(',')}`)
  }
  if (rule.freq === 'MONTHLY' && rule.nthWeekday) {
    parts.push(`BYDAY=${String(rule.nthWeekday.n)}${rule.nthWeekday.day}`)
  }
  if (rule.freq === 'MONTHLY' && rule.monthDay !== null) {
    parts.push(`BYMONTHDAY=${String(rule.monthDay)}`)
  }
  return parts.join(';')
}

/** Si un texto de `items.recurrence` dice que se repite. */
export function repeats(text: string | null | undefined): boolean {
  return parseRule(text) !== null
}

/** El día de la semana de una fecha, de lunes (`MO`) a domingo. */
export function weekdayOf(date: Date): Weekday {
  return WEEKDAYS[(date.getDay() + 6) % 7] ?? 'MO'
}

/** Ese día del mes con la hora de `time` (el último del mes si no lo tiene). */
function onDay(year: number, month: number, day: number, time: Date): Date {
  const last = getDaysInMonth(new Date(year, month, 1))
  return new Date(
    year,
    month,
    Math.min(day, last),
    time.getHours(),
    time.getMinutes(),
    time.getSeconds(),
  )
}

/** «El primer lunes» de un mes (`n = -1`, el último). Del 1 al 4 siempre existe. */
function nthWeekdayOf(year: number, month: number, n: Ordinal, day: Weekday): number {
  const target = WEEKDAYS.indexOf(day)
  if (n > 0) {
    const firstDay = (new Date(year, month, 1).getDay() + 6) % 7
    return 1 + ((target - firstDay + 7) % 7) + (n - 1) * 7
  }
  const last = getDaysInMonth(new Date(year, month, 1))
  const lastDay = (new Date(year, month, last).getDay() + 6) % 7
  return last - ((lastDay - target + 7) % 7)
}

/** Las veces de la vuelta `k` (contada desde la de la fecha), en orden. */
function period(first: Date, rule: Rule, k: number): Date[] {
  const step = k * rule.interval
  switch (rule.freq) {
    case 'DAILY':
      return [addDays(first, step)]
    case 'WEEKLY': {
      const week = addWeeks(startOfWeek(first, { weekStartsOn: 1 }), step)
      const days = rule.weekdays.length > 0 ? rule.weekdays : [weekdayOf(first)]
      return days.map((day) => {
        const date = addDays(week, WEEKDAYS.indexOf(day))
        return onDay(date.getFullYear(), date.getMonth(), date.getDate(), first)
      })
    }
    case 'MONTHLY': {
      const month = addMonths(startOfMonth(first), step)
      const [year, index] = [month.getFullYear(), month.getMonth()]
      if (rule.nthWeekday) {
        const { n, day } = rule.nthWeekday
        return [onDay(year, index, nthWeekdayOf(year, index, n, day), first)]
      }
      return [onDay(year, index, rule.monthDay ?? first.getDate(), first)]
    }
    case 'YEARLY':
      return [addYears(first, step)]
  }
}

/** Cuántas vueltas caben entre la fecha y `day`, más o menos (puede quedarse una corta). */
function periodsUntil(first: Date, rule: Rule, day: Date): number {
  const span = {
    DAILY: differenceInCalendarDays,
    WEEKLY: (a: Date, b: Date) => differenceInCalendarWeeks(a, b, { weekStartsOn: 1 }),
    MONTHLY: differenceInCalendarMonths,
    YEARLY: differenceInCalendarYears,
  }[rule.freq](day, first)
  return Math.floor(span / rule.interval)
}

/** Más de esto sin dar con una vez es una regla rota: se para. */
const MAX_PERIODS = 5000

/**
 * Las veces de la serie desde `from` (incluido), en orden y sin fin: el que llama decide cuándo
 * parar. Nunca antes de la fecha del ítem, que es la primera vez.
 */
export function* occurrencesFrom(first: Date, rule: Rule, from: Date): Generator<Date> {
  const start = from > first ? from : first
  let k = Math.max(0, periodsUntil(first, rule, start) - 1)
  for (let guard = 0; guard < MAX_PERIODS; guard++, k++) {
    for (const date of period(first, rule, k)) {
      if (date >= start) yield date
    }
  }
}

/** La primera vez desde `from` (incluido). */
export function occurrenceFrom(first: Date, rule: Rule, from: Date): Date | null {
  const next = occurrencesFrom(first, rule, from).next()
  return next.done ? null : next.value
}

/**
 * La primera vez que una fecha cumple la regla, desde ese mismo día: al poner una regla, la fecha
 * del ítem salta ahí (B6: «el primer lunes» desde el viernes 9 de octubre es el lunes 2 de
 * noviembre).
 */
export function firstOccurrence(date: Date, rule: Rule): Date {
  return occurrenceFrom(date, rule, date) ?? date
}

/**
 * La siguiente vez de una tarea que se repite al completarla: la primera después de la fecha que
 * tenía y no antes de mañana. Completar el martes una de martes y viernes la lleva al viernes; una
 * atrasada no vuelve a quedarse para hoy.
 */
export function nextAfterDone(due: Date, rule: Rule, now: Date = new Date()): Date | null {
  const tomorrow = addDays(startOfDay(now), 1)
  const after = new Date(due.getTime() + 1)
  return occurrenceFrom(due, rule, after > tomorrow ? after : tomorrow)
}

/**
 * Si cambiar a `status` es completar una tarea que se repite: entonces no se completa, pasa a la
 * siguiente fecha (la que devuelve) y sigue pendiente, como hace la base (`items_repeat_task`).
 * `null` en cualquier otro caso.
 */
export function repeatOnDone(
  item: { kind: string; status: string; dueAt: Date | null; recurrence: string | null },
  status: string,
  now: Date = new Date(),
): Date | null {
  if (item.kind !== 'task' || status !== 'done' || item.status === 'done' || !item.dueAt) {
    return null
  }
  const rule = parseRule(item.recurrence)
  return rule ? nextAfterDone(item.dueAt, rule, now) : null
}

// ─── Textos (diseño 21, B2–B8) ──────────────────────────────────────────────────────────────

const DAY_NAMES: Record<Weekday, string> = {
  MO: 'lunes',
  TU: 'martes',
  WE: 'miércoles',
  TH: 'jueves',
  FR: 'viernes',
  SA: 'sábado',
  SU: 'domingo',
}
const DAY_SHORT: Record<Weekday, string> = {
  MO: 'lun',
  TU: 'mar',
  WE: 'mié',
  TH: 'jue',
  FR: 'vie',
  SA: 'sáb',
  SU: 'dom',
}
/** Las letras de los días en la personalizada (B5): L M X J V S D. */
export const DAY_LETTERS: Record<Weekday, string> = {
  MO: 'L',
  TU: 'M',
  WE: 'X',
  TH: 'J',
  FR: 'V',
  SA: 'S',
  SU: 'D',
}
export const ORDINAL_NAMES: Record<Ordinal, string> = {
  1: 'primer',
  2: 'segundo',
  3: 'tercer',
  4: 'cuarto',
  [-1]: 'último',
}
export { DAY_NAMES }
const DAY_PLURALS: Record<Weekday, string> = {
  ...DAY_NAMES,
  SA: 'sábados',
  SU: 'domingos',
}

const UNITS: Record<Freq, [one: string, many: string, short: string]> = {
  DAILY: ['día', 'días', 'días'],
  WEEKLY: ['semana', 'semanas', 'sem'],
  MONTHLY: ['mes', 'meses', 'meses'],
  YEARLY: ['año', 'años', 'años'],
}

/** «lunes y jueves», «lunes, miércoles y viernes». */
function joinNames(names: readonly string[]): string {
  if (names.length <= 1) return names.join('')
  return `${names.slice(0, -1).join(', ')} y ${names.at(-1) ?? ''}`
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1)
}

/** «Cada día», «Cada 3 días», «Cada 2 semanas». */
function every(rule: Rule, short: boolean): string {
  const [one, many, abbreviated] = UNITS[rule.freq]
  if (rule.interval === 1) return `Cada ${one}`
  return `Cada ${String(rule.interval)} ${short ? abbreviated : many}`
}

/** Lo de dentro de la vuelta: «lunes y jueves», «el primer lunes», «el día 15». */
function which(rule: Rule, short: boolean): string | null {
  if (rule.freq === 'WEEKLY' && rule.weekdays.length > 0) {
    return joinNames(rule.weekdays.map((day) => (short ? DAY_SHORT : DAY_NAMES)[day]))
  }
  if (rule.freq === 'MONTHLY' && rule.nthWeekday) {
    const { n, day } = rule.nthWeekday
    return `el ${ORDINAL_NAMES[n]} ${DAY_NAMES[day]}`
  }
  if (rule.freq === 'MONTHLY' && rule.monthDay !== null) return `el día ${String(rule.monthDay)}`
  return null
}

/**
 * La regla entera, en una frase (la ficha y el resumen de la personalizada, B2, B5 y B8): «Cada 3
 * días», «Cada martes», «Martes y viernes», «Cada 2 semanas, lunes y jueves», «Cada mes, el primer
 * lunes».
 */
export function ruleLabel(rule: Rule): string {
  const inner = which(rule, false)
  if (!inner) return every(rule, false)
  if (rule.freq === 'WEEKLY' && rule.interval === 1) {
    return rule.weekdays.length === 1 ? `Cada ${inner}` : capitalize(inner)
  }
  return `${every(rule, false)}, ${inner}`
}

/**
 * La regla en la fila (B7), corta: «Cada 2 sem · lun y jue», «Mar y vie», «Cada mes · el primer
 * lunes». Si no cabe, la fila la corta con puntos.
 */
export function ruleShortLabel(rule: Rule): string {
  const inner = which(rule, true)
  if (!inner) return every(rule, true)
  if (rule.freq === 'WEEKLY' && rule.interval === 1) {
    return rule.weekdays.length === 1 ? `Cada ${which(rule, false) ?? ''}` : capitalize(inner)
  }
  return `${every(rule, true)} · ${inner}`
}

/**
 * La regla dentro de una frase (los avisos, 18): «Avisa cada martes y viernes», «Avisa cada 2
 * semanas, lunes y jueves», «Avisa cada mes, el primer lunes».
 */
export function ruleSentence(rule: Rule): string {
  if (rule.freq === 'WEEKLY' && rule.interval === 1 && rule.weekdays.length > 1) {
    return `cada ${joinNames(rule.weekdays.map((day) => DAY_NAMES[day]))}`
  }
  const label = ruleLabel(rule)
  return label.charAt(0).toLowerCase() + label.slice(1)
}

/** La etiqueta de lo guardado en `items.recurrence`, o `null` si no se repite. */
export function recurrenceLabel(text: string | null, short = false): string | null {
  const rule = parseRule(text)
  if (!rule) return null
  return short ? ruleShortLabel(rule) : ruleLabel(rule)
}

/** Las opciones de siempre (B2): Diaria, Semanal, Mensual, Anual; lo demás es «Personalizada…». */
export const PRESETS: readonly { freq: Freq; label: string }[] = [
  { freq: 'DAILY', label: 'Diaria' },
  { freq: 'WEEKLY', label: 'Semanal' },
  { freq: 'MONTHLY', label: 'Mensual' },
  { freq: 'YEARLY', label: 'Anual' },
]

/**
 * La regla de una de las de siempre para un ítem de ese día: la semanal y la mensual, con su día
 * escrito (ver arriba).
 */
export function presetRule(freq: Freq, day: Date): Rule {
  const rule = simpleRule(freq)
  if (freq === 'WEEKLY') rule.weekdays = [weekdayOf(day)]
  if (freq === 'MONTHLY') rule.monthDay = day.getDate()
  return rule
}

/** Cuál de las de siempre es para un ítem de ese día, o `null` si es personalizada. */
export function presetOf(rule: Rule, day: Date | null): Freq | null {
  if (rule.interval !== 1 || rule.nthWeekday !== null) return null
  const plain = rule.weekdays.length === 0 && rule.monthDay === null
  if (plain) return rule.freq
  if (!day) return null
  const sameDay =
    (rule.freq === 'WEEKLY' && rule.weekdays.length === 1 && rule.weekdays[0] === weekdayOf(day)) ||
    (rule.freq === 'MONTHLY' && rule.monthDay === day.getDate())
  return sameDay ? rule.freq : null
}

/** Lo que significa cada una de las de siempre para ese día (B2): «los viernes», «el día 9». */
export function presetHint(freq: Freq, day: Date, now: Date = new Date()): string | null {
  switch (freq) {
    case 'DAILY':
      return null
    case 'WEEKLY':
      return `los ${DAY_PLURALS[weekdayOf(day)]}`
    case 'MONTHLY':
      return `el día ${String(day.getDate())}`
    case 'YEARLY':
      return format(day, isSameYear(day, now) ? "'el' d MMM" : "'el' d MMM yyyy")
  }
}
