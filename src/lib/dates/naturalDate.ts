import { addDays, addHours, addMinutes, addMonths, addWeeks, startOfDay } from 'date-fns'

/**
 * Fechas escritas (3.5): «Cena con Marta el viernes 21h» es «Cena con Marta» el viernes a las
 * 21:00. Un analizador pequeño y propio, con date-fns, que se niega cuando duda: lo que no entiende
 * del todo se queda en el título, y si el texto tiene dos días o dos horas no interpreta nada.
 *
 * Entiende, sin mayúsculas ni tildes obligatorias:
 * - **días:** «hoy», «mañana», «pasado mañana», los días de la semana («el viernes», «el próximo
 *   lunes», «el martes que viene»), «el día 3», «el 3» (al final o con hora), «3 oct», «3 de
 *   octubre», «3/10», y «en 3 días», «en 2 semanas», «en un mes»;
 * - **horas:** «18h», «18:30», «a las 18», «a la 1», «10 de la mañana», «8 de la tarde», «por la
 *   tarde», «a mediodía», «esta noche»;
 * - **en un rato:** «en 2 horas», «en media hora», «en 20 minutos».
 *
 * Reglas para no adivinar:
 * - Un día de la semana es el siguiente que llega: «el lunes» dicho un lunes es el de la semana que
 *   viene (para hoy se dice «hoy»).
 * - Un día del mes o una fecha sin año que ya pasaron son los del mes o el año siguiente.
 * - Una hora sola es hoy si aún no ha pasado, y si no, mañana.
 * - «a las 5», sin más, son las 17:00: de la 1 a las 6 sin «de la mañana» se entiende la tarde.
 * - «por la mañana», «a mediodía», «por la tarde» y «por la noche» son las 9, las 12, las 17 y las
 *   21.
 */
export interface NaturalDate {
  /** El texto sin lo que se entendió. */
  title: string
  /** El día a las 00:00 o, si se dijo una hora, a esa hora (hora local). */
  date: Date
  /** Si se dijo una hora. Sin ella, es una fecha de todo el día. */
  hasTime: boolean
  /** Lo que se entendió, tal como estaba escrito y en orden. */
  fragments: string[]
  /** Dónde está cada trozo en el texto (`start` incluido, `end` no), para marcarlo. */
  ranges: { start: number; end: number }[]
  /**
   * «cada martes y viernes», «cada 3 días» (3.6): la repetición, y `date` es su primera vez, que
   * es a partir de mañana (diseño 21, A4 y A8). En el formato de `items.recurrence` lo pone
   * `writtenDateFields`.
   */
  repeat: WrittenRepeat | null
}

/** Una repetición escrita: cada N días, o ciertos días de la semana (de lunes, `MO`, a domingo). */
export interface WrittenRepeat {
  freq: 'DAILY' | 'WEEKLY'
  interval: number
  weekdays: ('MO' | 'TU' | 'WE' | 'TH' | 'FR' | 'SA' | 'SU')[]
}

/** Los días como los guarda la repetición, en el orden de `getDay()` (domingo primero). */
const RRULE_DAYS = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'] as const
/** Y en el orden en que se escriben en la regla, de lunes a domingo. */
const WEEK = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'] as const

const WEEKDAYS = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado']

/** Cada mes con sus abreviaturas; el índice es el de `Date`. */
const MONTHS: readonly (readonly string[])[] = [
  ['enero', 'ene'],
  ['febrero', 'feb'],
  ['marzo', 'mar'],
  ['abril', 'abr'],
  ['mayo', 'may'],
  ['junio', 'jun'],
  ['julio', 'jul'],
  ['agosto', 'ago'],
  ['septiembre', 'setiembre', 'sept', 'sep', 'set'],
  ['octubre', 'oct'],
  ['noviembre', 'nov'],
  ['diciembre', 'dic'],
]

/** Las horas de «por la mañana», «a mediodía», «por la tarde» y «por la noche». */
const PERIOD_HOURS = { manana: 9, mediodia: 12, tarde: 17, noche: 21 } as const
type Period = keyof typeof PERIOD_HOURS

const WD = `(${WEEKDAYS.join('|')})`
const MONTH = `(${MONTHS.flat().join('|')})\\.?`
/** Lo que puede seguir a un número de hora para fijar su mitad del día. */
const HALF = `(?:\\s+(?:de|por)\\s+la\\s+(manana|tarde|noche|madrugada))?`
/** Una hora detrás: «el 3» solo es un día si le sigue una hora o nada. */
const TIME_AHEAD = `(?=\\s*$|\\s*,|\\s+(?:a\\s+las?\\s+\\d|\\d{1,2}(?::\\d{2})?\\s*h\\b|\\d{1,2}:\\d{2}))`
/** Un número que no es parte de otro (ni de un precio, ni de una fecha con barra). */
const NUM_START = '(?<![\\d/.,:])'
const NUM_END = '(?![\\d/.,]\\d)'

interface Found {
  start: number
  end: number
  /** El día (a las 00:00), si lo dice. */
  day?: Date
  /** La hora, si la dice. */
  time?: { hours: number; minutes: number }
  /** Un momento exacto («en 2 horas»): día y hora a la vez. */
  instant?: Date
  /** Una repetición («cada martes»): es el día, el de su primera vez. */
  repeat?: WrittenRepeat
}

interface Rule {
  pattern: RegExp
  read: (match: RegExpExecArray, today: Date, now: Date) => Omit<Found, 'start' | 'end'> | null
}

/** Minúsculas y sin tildes, letra a letra: las posiciones son las del texto original. */
function fold(text: string): string {
  return text
    .toLowerCase()
    .replace(/[áàäâéèëêíìïîóòöôúùüûñç]/g, (char) => char.normalize('NFD').charAt(0))
}

function validTime(hours: number, minutes: number) {
  return hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59 ? { hours, minutes } : null
}

/** Una hora con su «de la mañana / tarde / noche / madrugada»; sin nada, de 1 a 6 es la tarde. */
function clockTime(hourText: string, minuteText: string | undefined, half: string | undefined) {
  let hours = Number(hourText)
  const minutes = minuteText ? Number(minuteText) : 0
  if (hours > 12 && half) return null
  if (half === 'tarde' && hours < 12) hours += 12
  else if (half === 'noche' && hours >= 7 && hours < 12) hours += 12
  else if (half === 'noche' && hours === 12) hours = 0
  else if ((half === 'manana' || half === 'madrugada') && hours === 12) hours = 0
  return validTime(hours, minutes)
}

/** Un día del mes que existe, o `null` («31 feb»). */
function calendarDay(year: number, month: number, day: number): Date | null {
  const date = new Date(year, month, day)
  return date.getMonth() === month && date.getDate() === day ? date : null
}

/** Una fecha sin año: este año, o el que viene si ya pasó. */
function nextDate(today: Date, month: number, day: number): Date | null {
  const thisYear = calendarDay(today.getFullYear(), month, day)
  if (thisYear && thisYear >= today) return thisYear
  return calendarDay(today.getFullYear() + 1, month, day)
}

function monthIndex(name: string): number {
  return MONTHS.findIndex((names) => names.includes(name))
}

function count(text: string): number | null {
  if (text === 'un' || text === 'una') return 1
  const value = Number(text)
  return Number.isInteger(value) && value > 0 && value < 1000 ? value : null
}

/** Un día de la semana, sin captura, para las listas («martes y viernes»). */
const ANY_WD = `(?:${WEEKDAYS.join('|')})`

/** En orden de preferencia: lo más largo primero, para que «el 3 de octubre» no se quede en «el 3». */
const RULES: readonly Rule[] = [
  // ─── Repeticiones (3.6): antes que los días sueltos ───
  {
    pattern: new RegExp(
      `\\b(?:cada|todos los|todas las)\\s+(${ANY_WD}(?:\\s*(?:,|y)\\s*${ANY_WD})*)\\b`,
      'g',
    ),
    read: ([, names = '']) => {
      const said = names.match(new RegExp(ANY_WD, 'g')) ?? []
      const codes = said.map((name) => RRULE_DAYS[WEEKDAYS.indexOf(name)])
      // De lunes a domingo, como se guardan.
      const weekdays = WEEK.filter((day) => codes.includes(day))
      return { repeat: { freq: 'WEEKLY', interval: 1, weekdays } }
    },
  },
  {
    pattern: /\b(?:cada\s+dia|todos\s+los\s+dias|a\s+diario)\b/g,
    read: () => ({ repeat: { freq: 'DAILY', interval: 1, weekdays: [] } }),
  },
  {
    pattern: /\bcada\s+(\d{1,2})\s+dias\b/g,
    read: ([, amount = '']) => {
      const n = Number(amount)
      return n >= 1 ? { repeat: { freq: 'DAILY', interval: n, weekdays: [] } } : null
    },
  },
  // ─── En un rato: día y hora a la vez ───
  {
    pattern: /\b(?:en|dentro de)\s+media\s+hora\b/g,
    read: (_, __, now) => ({ instant: addMinutes(now, 30) }),
  },
  {
    pattern: /\b(?:en|dentro de)\s+(\d{1,3}|una?)\s+(horas?|minutos?|min)\b/g,
    read: ([, amount = '', unit = ''], _, now) => {
      const n = count(amount)
      if (n === null) return null
      return { instant: unit.startsWith('hora') ? addHours(now, n) : addMinutes(now, n) }
    },
  },
  // ─── Días ───
  {
    pattern: /\b(?:en|dentro de)\s+(\d{1,3}|una?)\s+(dias?|semanas?|mes|meses)\b/g,
    read: ([, amount = '', unit = ''], today) => {
      const n = count(amount)
      if (n === null) return null
      if (unit.startsWith('dia')) return { day: addDays(today, n) }
      if (unit.startsWith('semana')) return { day: addWeeks(today, n) }
      return { day: addMonths(today, n) }
    },
  },
  {
    pattern: new RegExp(
      `\\b(?:el\\s+)?(?:dia\\s+)?${NUM_START}(\\d{1,2})(?:\\s+de)?\\s+${MONTH}(?:\\s+(?:de\\s+)?(\\d{4}))?(?![\\w])`,
      'g',
    ),
    read: ([, day = '', month = '', year], today) => {
      const index = monthIndex(month)
      if (index < 0) return null
      const date = year
        ? calendarDay(Number(year), index, Number(day))
        : nextDate(today, index, Number(day))
      return date ? { day: date } : null
    },
  },
  {
    pattern: new RegExp(
      `\\b(?:el\\s+)?${NUM_START}(\\d{1,2})/(\\d{1,2})(?:/(\\d{4}|\\d{2}))?${NUM_END}\\b`,
      'g',
    ),
    read: ([, day = '', month = '', year], today) => {
      const index = Number(month) - 1
      if (index < 0 || index > 11) return null
      const fullYear = year ? (year.length === 2 ? 2000 + Number(year) : Number(year)) : null
      const date =
        fullYear === null
          ? nextDate(today, index, Number(day))
          : calendarDay(fullYear, index, Number(day))
      return date ? { day: date } : null
    },
  },
  {
    pattern: /\bpasado\s+manana\b/g,
    read: (_, today) => ({ day: addDays(today, 2) }),
  },
  {
    // «esta tarde», «esta noche»: hoy, a esa hora. («esta mañana» ya pasó: no se entiende.)
    pattern: /\besta\s+(tarde|noche)\b/g,
    read: ([, period = ''], today) => ({
      day: today,
      time: { hours: PERIOD_HOURS[period as Period], minutes: 0 },
    }),
  },
  {
    // «mañana», salvo en «de la mañana» y «por la mañana», que son una hora.
    pattern: /(?<!\b(?:de|por)\s+la\s+)\b(hoy|manana)\b/g,
    read: ([, word], today) => ({ day: word === 'hoy' ? today : addDays(today, 1) }),
  },
  {
    pattern: new RegExp(
      `\\b(?:(?:el|este|el\\s+proximo|proximo)\\s+)?${WD}(?:\\s+que\\s+viene)?\\b`,
      'g',
    ),
    read: ([, name = ''], today) => {
      const ahead = (WEEKDAYS.indexOf(name) - today.getDay() + 7) % 7
      return { day: addDays(today, ahead === 0 ? 7 : ahead) }
    },
  },
  {
    // «el día 15» siempre; «el 15», solo al final o con una hora detrás.
    pattern: new RegExp(
      `\\bel\\s+(?:dia\\s+(\\d{1,2})${NUM_END}\\b|(\\d{1,2})${NUM_END}\\b${TIME_AHEAD})`,
      'g',
    ),
    read: ([, withDia, bare], today) => {
      const day = Number(withDia ?? bare)
      for (let ahead = 0; ahead < 12; ahead++) {
        const month = addMonths(new Date(today.getFullYear(), today.getMonth(), 1), ahead)
        const date = calendarDay(month.getFullYear(), month.getMonth(), day)
        if (date && date >= today) return { day: date }
      }
      return null
    },
  },
  // ─── Horas ───
  {
    pattern: new RegExp(
      `\\b(?:a\\s+las?\\s+)?${NUM_START}(\\d{1,2})(?::(\\d{2}))?\\s*h${HALF}\\b`,
      'g',
    ),
    read: ([, hours = '', minutes, half]) => {
      const time = half
        ? clockTime(hours, minutes, half)
        : validTime(Number(hours), Number(minutes ?? 0))
      return time ? { time } : null
    },
  },
  {
    pattern: new RegExp(`\\ba\\s+las?\\s+(\\d{1,2})(?::(\\d{2}))?${NUM_END}${HALF}\\b`, 'g'),
    read: ([, hours = '', minutes, half]) => {
      const time = clockTime(hours, minutes, half ?? (Number(hours) <= 6 ? 'tarde' : undefined))
      return time ? { time } : null
    },
  },
  {
    pattern: new RegExp(
      `${NUM_START}\\b(\\d{1,2})(?::(\\d{2}))?\\s+(?:de|por)\\s+la\\s+(manana|tarde|noche|madrugada)\\b`,
      'g',
    ),
    read: ([, hours = '', minutes, half]) => {
      const time = clockTime(hours, minutes, half)
      return time ? { time } : null
    },
  },
  {
    pattern: new RegExp(`${NUM_START}\\b(\\d{1,2}):(\\d{2})${NUM_END}\\b`, 'g'),
    read: ([, hours = '', minutes = '']) => {
      const time = validTime(Number(hours), Number(minutes))
      return time ? { time } : null
    },
  },
  {
    pattern: /\b(?:por\s+la\s+(manana|tarde|noche)|(?:a|al)\s+(mediodia))\b/g,
    read: ([, period, noon]) => ({
      time: { hours: PERIOD_HOURS[(period ?? noon ?? 'mediodia') as Period], minutes: 0 },
    }),
  },
]

/**
 * «cada semana», «cada mes», «cada 2 semanas»…: no dicen qué día, así que no se entiende nada (la
 * repetición se pone en la ficha). Lo que sí se entiende ya lo han leído las reglas de arriba.
 */
const VAGUE_REPEAT = /\bcada\s+(?:\d+\s+)?(?:semanas?|mes|meses|anos?)\b/

/** Palabras que se quedan colgando al final del título al quitar la fecha («Pagar para»). */
const DANGLING = /(?:\s+|^)(?:para|el|la|a|de|en|y|,)\s*$/

function cleanTitle(text: string, removed: readonly Found[]): string {
  let title = ''
  let cursor = 0
  for (const found of removed) {
    title += text.slice(cursor, found.start) + ' '
    cursor = found.end
  }
  title += text.slice(cursor)
  title = title
    .replace(/\s*,\s*(?=,|$)/g, '')
    .replace(/\s+/g, ' ')
    .trim()
  while (DANGLING.test(` ${title}`)) title = ` ${title}`.replace(DANGLING, '').trim()
  title = title.replace(/^[,\s]+/, '')
  // Si la fecha iba delante («Mañana llamar al seguro»), el título empieza con mayúscula.
  const startsUpper = /^\p{Lu}/u.test(text.trim())
  return startsUpper ? title.charAt(0).toUpperCase() + title.slice(1) : title
}

/**
 * Lo que dice `text` de fecha y hora, o `null` si no dice nada (o lo dice dos veces, o no deja
 * título). `now` es el momento de escribirlo.
 */
export function parseNaturalDate(text: string, now: Date = new Date()): NaturalDate | null {
  const folded = fold(text)
  if (VAGUE_REPEAT.test(folded)) return null
  const today = startOfDay(now)
  const found: Found[] = []
  const overlaps = (start: number, end: number) =>
    found.some((other) => start < other.end && end > other.start)

  for (const rule of RULES) {
    for (const match of folded.matchAll(rule.pattern)) {
      const start = match.index
      const end = start + match[0].length
      if (overlaps(start, end)) continue
      const read = rule.read(match, today, now)
      if (read) found.push({ start, end, ...read })
    }
  }

  const days = found.filter((entry) => entry.day ?? entry.instant ?? entry.repeat)
  const times = found.filter((entry) => entry.time ?? entry.instant)
  // Dos días o dos horas («del lunes al martes», «de 10h a 12h»): no se adivina.
  if (found.length === 0 || days.length > 1 || times.length > 1) return null

  const instant = found.find((entry) => entry.instant)?.instant
  const repeat = found.find((entry) => entry.repeat)?.repeat ?? null
  // Una repetición empieza mañana (A4, A8): su primera vez es el primer día que toca desde ahí.
  const day = repeat ? firstRepeatDay(repeat, addDays(today, 1)) : days[0]?.day
  const time = times[0]?.time
  let date: Date
  if (repeat && instant) {
    return null
  } else if (instant) {
    date = instant
  } else if (day) {
    date = time
      ? new Date(day.getFullYear(), day.getMonth(), day.getDate(), time.hours, time.minutes)
      : day
  } else if (time) {
    const at = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate(),
      time.hours,
      time.minutes,
    )
    date = at > now ? at : addDays(at, 1)
  } else {
    return null
  }

  const ordered = [...found].sort((a, b) => a.start - b.start)
  const title = cleanTitle(text, ordered)
  if (title === '') return null
  return {
    title,
    date,
    hasTime: Boolean(instant ?? time),
    fragments: ordered.map((entry) => text.slice(entry.start, entry.end)),
    ranges: ordered.map(({ start, end }) => ({ start, end })),
    repeat,
  }
}

/** El primer día desde `from` en que toca una repetición escrita. */
function firstRepeatDay(repeat: WrittenRepeat, from: Date): Date {
  if (repeat.freq === 'DAILY' || repeat.weekdays.length === 0) return from
  for (let ahead = 0; ahead < 7; ahead++) {
    const day = addDays(from, ahead)
    if (repeat.weekdays.includes(RRULE_DAYS[day.getDay()] ?? 'MO')) return day
  }
  return from
}
