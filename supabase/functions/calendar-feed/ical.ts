// Lo puro de calendar-feed (sesión 3.7): de los eventos que da `calendar_feed` al texto iCalendar
// (RFC 5545) que lee el Calendario del iPhone o del Mac. Sin Deno ni red, para probarlo con Vitest
// desde la app, como `send-reminders/messages.ts`. Las fechas llegan ya en la zona de la persona
// («2026-11-13T21:00:00»), así que aquí solo se escriben; la zona va en un VTIMEZONE que se saca de
// las reglas de `Intl`.

/** La app, para el enlace de cada evento. Cambia con el dominio propio (3.1), como `VAPID_SUBJECT`. */
export const APP_URL = 'https://onmymind.pages.dev'

/** Lo que dura un evento con hora en el Calendario: OnMyMind solo guarda cuándo empieza. */
const TIMED_DURATION = 'PT1H'

/** El color del calendario en el iPhone y el Mac: el índigo de la marca (`--primary`). */
const CALENDAR_COLOR = '#5A4BE6'

/** Un evento, como lo da `calendar_feed`. */
export interface FeedEvent {
  id: string
  listId: string
  listName: string
  title: string
  notes: string | null
  allDay: boolean
  /** En la zona de la persona: «2026-12-07» de todo el día, «2026-11-13T21:00:00» con hora. */
  start: string
  /** La regla de la 3.6 (`FREQ=…`), o `null`. */
  recurrence: string | null
  updatedAt: Date
}

export interface Feed {
  timezone: string
  events: FeedEvent[]
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const DATE = /^\d{4}-\d{2}-\d{2}$/
const DATE_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/

/** Lee lo que devuelve `calendar_feed`; un evento que no se entiende se salta, no tumba el feed. */
export function parseFeed(data: unknown): Feed | null {
  if (!isRecord(data) || typeof data.timezone !== 'string' || !Array.isArray(data.events)) {
    return null
  }
  const events: FeedEvent[] = []
  for (const row of data.events) {
    if (!isRecord(row)) continue
    const { id, list_id, list_name, title, notes, all_day, start, recurrence, updated_at } = row
    if (
      typeof id !== 'string' ||
      typeof list_id !== 'string' ||
      typeof list_name !== 'string' ||
      typeof title !== 'string' ||
      typeof all_day !== 'boolean' ||
      typeof start !== 'string' ||
      !(all_day ? DATE : DATE_TIME).test(start) ||
      typeof updated_at !== 'string'
    ) {
      continue
    }
    events.push({
      id,
      listId: list_id,
      listName: list_name,
      title,
      notes: typeof notes === 'string' && notes.trim() !== '' ? notes : null,
      allDay: all_day,
      start,
      recurrence: typeof recurrence === 'string' ? recurrence : null,
      updatedAt: new Date(updated_at),
    })
  }
  return { timezone: data.timezone, events }
}

/** El enlace de la URL (`…/calendar-feed/<enlace>.ics`), o `null` si no tiene su forma. */
export function tokenFromPath(pathname: string): string | null {
  const last = pathname.split('/').filter(Boolean).at(-1) ?? ''
  const token = last.replace(/\.ics$/, '')
  return /^[A-Za-z0-9_-]{32}$/.test(token) ? token : null
}

// ─── El texto ─────────────────────────────────────────────────────────────────────────────────

/** Escapa un valor de texto: `\`, `;`, `,` y los saltos de línea (RFC 5545 §3.3.11). */
export function escapeText(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r\n?|\n/g, '\\n')
}

const encoder = new TextEncoder()

/**
 * Parte una línea en trozos de 75 bytes como mucho, los siguientes empezando por un espacio (RFC
 * 5545 §3.1). Cuenta bytes y no letras, y nunca corta una letra de varios bytes («ñ», «é», «💡»).
 */
export function foldLine(line: string): string {
  if (encoder.encode(line).length <= 75) return line
  const parts: string[] = []
  let current = ''
  let bytes = 0
  for (const char of line) {
    const size = encoder.encode(char).length
    // La primera línea tiene 75 bytes; las demás, 74 más el espacio del principio.
    const limit = parts.length === 0 ? 75 : 74
    if (bytes + size > limit) {
      parts.push(current)
      current = ''
      bytes = 0
    }
    current += char
    bytes += size
  }
  parts.push(current)
  return parts.join('\r\n ')
}

/** «2026-11-13T21:00:00» → «20261113T210000»; «2026-12-07» → «20261207». */
function basic(local: string): string {
  return local.replace(/[-:]/g, '')
}

/** Un instante en UTC: «20261007T084941Z». */
export function utcStamp(date: Date): string {
  return `${date.toISOString().slice(0, 19).replace(/[-:]/g, '')}Z`
}

/** El día siguiente a «2026-12-07», para el final de uno de todo el día (no incluido). */
function nextDay(date: string): string {
  const [year = 0, month = 1, day = 1] = date.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, day + 1)).toISOString().slice(0, 10)
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate()
}

/**
 * La regla tal cual, salvo donde la app y el RFC no dicen lo mismo (nota de la 3.6). En la app, un
 * día que el mes no tiene es el último del mes: «cada mes, el 31» cae el 30 de noviembre y el 28 de
 * febrero, y el 29 de febrero, cada año, cae el 28 si no es bisiesto. El RFC se salta esos meses y
 * esos años, así que se escriben como «el último de estos días»: `BYMONTHDAY=28,29,30;BYSETPOS=-1`
 * para el 30, y `BYMONTHDAY=-1` para el 31.
 */
export function feedRule(rule: string, start: string): string {
  const parts = new Map(
    rule.split(';').map((part) => {
      const [key = '', value = ''] = part.split('=')
      return [key, value] as const
    }),
  )
  const [, startMonth = 1, startDay = 1] = start.slice(0, 10).split('-').map(Number)
  const freq = parts.get('FREQ')

  if (freq === 'MONTHLY' && !parts.has('BYDAY')) {
    const day = Number(parts.get('BYMONTHDAY') ?? startDay)
    if (day < 29) return rule
    parts.delete('BYMONTHDAY')
    if (day === 31) parts.set('BYMONTHDAY', '-1')
    else {
      parts.set('BYMONTHDAY', Array.from({ length: day - 27 }, (_, i) => 28 + i).join(','))
      parts.set('BYSETPOS', '-1')
    }
  } else if (freq === 'YEARLY' && startMonth === 2 && startDay === 29) {
    parts.set('BYMONTH', '2')
    parts.set('BYMONTHDAY', '28,29')
    parts.set('BYSETPOS', '-1')
  } else {
    return rule
  }
  return [...parts].map(([key, value]) => `${key}=${value}`).join(';')
}

// ─── La zona ──────────────────────────────────────────────────────────────────────────────────

/** Los minutos que la zona va por delante de UTC en ese instante (Madrid en verano, 120). */
export function offsetMinutes(timeZone: string, date: Date): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
  }).formatToParts(date)
  const get = (type: string) => Number(parts.find((part) => part.type === type)?.value ?? 0)
  const wall = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'))
  const instant = Math.floor(date.getTime() / 60_000) * 60_000
  return Math.round((wall - instant) / 60_000)
}

/** «+0100», «-0330». */
function formatOffset(minutes: number): string {
  const sign = minutes < 0 ? '-' : '+'
  const abs = Math.abs(minutes)
  return `${sign}${String(Math.floor(abs / 60)).padStart(2, '0')}${String(abs % 60).padStart(2, '0')}`
}

interface Transition {
  /** El instante del cambio. */
  at: Date
  from: number
  to: number
}

/** Los cambios de hora de la zona en ese año: se busca el día y luego el minuto. */
function transitions(timeZone: string, year: number): Transition[] {
  const found: Transition[] = []
  const day = 86_400_000
  let previous = Date.UTC(year, 0, 1)
  let previousOffset = offsetMinutes(timeZone, new Date(previous))
  for (let t = previous + day; t <= Date.UTC(year + 1, 0, 1); t += day) {
    const offset = offsetMinutes(timeZone, new Date(t))
    if (offset !== previousOffset) {
      let [low, high] = [previous, t]
      while (high - low > 60_000) {
        const mid = Math.floor((low + high) / 120_000) * 60_000
        if (offsetMinutes(timeZone, new Date(mid)) === previousOffset) low = mid
        else high = mid
      }
      found.push({ at: new Date(high), from: previousOffset, to: offset })
    }
    previous = t
    previousOffset = offset
  }
  return found
}

const WEEKDAY_CODES = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'] as const

/**
 * Una parte de la zona (horario de verano o de invierno) con la regla que la repite cada año:
 * «el último domingo de marzo a las 2:00». Empieza en 1970 para que valga también para los eventos
 * de hace años.
 */
function observance(kind: 'STANDARD' | 'DAYLIGHT', change: Transition): string[] {
  // La hora del cambio en el reloj de antes, que es como la escribe el RFC.
  const local = new Date(change.at.getTime() + change.from * 60_000)
  const month = local.getUTCMonth() + 1
  const day = local.getUTCDate()
  const weekday = local.getUTCDay()
  const nth = day + 7 > daysInMonth(local.getUTCFullYear(), month) ? -1 : Math.ceil(day / 7)
  const time = local.toISOString().slice(11, 19).replace(/:/g, '')

  // El mismo «enésimo día de la semana» de ese mes, en 1970.
  const first = new Date(Date.UTC(1970, month - 1, 1)).getUTCDay()
  const last = daysInMonth(1970, month)
  const lastWeekday = new Date(Date.UTC(1970, month - 1, last)).getUTCDay()
  const day1970 =
    nth > 0
      ? 1 + ((weekday - first + 7) % 7) + (nth - 1) * 7
      : last - ((lastWeekday - weekday + 7) % 7)

  return [
    `BEGIN:${kind}`,
    `DTSTART:1970${String(month).padStart(2, '0')}${String(day1970).padStart(2, '0')}T${time}`,
    `RRULE:FREQ=YEARLY;BYMONTH=${String(month)};BYDAY=${String(nth)}${WEEKDAY_CODES[weekday] ?? 'SU'}`,
    `TZOFFSETFROM:${formatOffset(change.from)}`,
    `TZOFFSETTO:${formatOffset(change.to)}`,
    `END:${kind}`,
  ]
}

/**
 * El VTIMEZONE de la zona con sus reglas de este año (RFC 5545 §3.6.5). El RFC lo pide para cada
 * `TZID`. El Calendario de Apple ya conoce las zonas por su nombre, pero un validador no: así vale
 * para los dos. Una zona sin cambios de hora es una sola parte; una con cambios raros (no dos al
 * año), su hora de ahora, que es lo mejor que se puede decir con una regla anual.
 */
export function vtimezone(timeZone: string, now: Date): string[] {
  const changes = transitions(timeZone, now.getUTCFullYear())
  const lines = ['BEGIN:VTIMEZONE', `TZID:${timeZone}`]
  const [a, b] = changes
  if (changes.length === 2 && a && b) {
    for (const change of [a, b]) {
      lines.push(...observance(change.to > change.from ? 'DAYLIGHT' : 'STANDARD', change))
    }
  } else {
    const offset = formatOffset(offsetMinutes(timeZone, now))
    lines.push(
      'BEGIN:STANDARD',
      'DTSTART:19700101T000000',
      `TZOFFSETFROM:${offset}`,
      `TZOFFSETTO:${offset}`,
      'END:STANDARD',
    )
  }
  lines.push('END:VTIMEZONE')
  return lines
}

// ─── El calendario ────────────────────────────────────────────────────────────────────────────

function eventLines(event: FeedEvent, timeZone: string, now: Date, appUrl: string): string[] {
  const lines = [
    'BEGIN:VEVENT',
    `UID:${event.id}@onmymind`,
    `DTSTAMP:${utcStamp(now)}`,
    `LAST-MODIFIED:${utcStamp(event.updatedAt)}`,
    `SUMMARY:${escapeText(event.title)}`,
  ]
  if (event.allDay) {
    lines.push(
      `DTSTART;VALUE=DATE:${basic(event.start)}`,
      `DTEND;VALUE=DATE:${basic(nextDay(event.start))}`,
      // De todo el día: no ocupa el día en el Calendario, como un cumpleaños.
      'TRANSP:TRANSPARENT',
    )
  } else {
    lines.push(`DTSTART;TZID=${timeZone}:${basic(event.start)}`, `DURATION:${TIMED_DURATION}`)
  }
  if (event.recurrence) lines.push(`RRULE:${feedRule(event.recurrence, event.start)}`)
  lines.push(`CATEGORIES:${escapeText(event.listName)}`)
  if (event.notes) lines.push(`DESCRIPTION:${escapeText(event.notes)}`)
  lines.push(`URL:${appUrl}/lists/${event.listId}?item=${event.id}`, 'END:VEVENT')
  return lines
}

/**
 * El calendario entero: la cabecera (nombre, color y cada cuánto mirarlo), la zona si algún evento
 * tiene hora, y un VEVENT por evento. Líneas de 75 bytes como mucho, separadas por CRLF.
 */
export function buildCalendar(
  feed: Feed,
  now: Date = new Date(),
  appUrl: string = APP_URL,
): string {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//OnMyMind//Calendario//ES',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:OnMyMind',
    `X-WR-TIMEZONE:${feed.timezone}`,
    `X-APPLE-CALENDAR-COLOR:${CALENDAR_COLOR}`,
    // Lo que se pide; el iPhone decide al final cada cuánto lo mira.
    'REFRESH-INTERVAL;VALUE=DURATION:PT1H',
    'X-PUBLISHED-TTL:PT1H',
  ]
  if (feed.events.some((event) => !event.allDay)) lines.push(...vtimezone(feed.timezone, now))
  for (const event of feed.events) lines.push(...eventLines(event, feed.timezone, now, appUrl))
  lines.push('END:VCALENDAR')
  return `${lines.map(foldLine).join('\r\n')}\r\n`
}
