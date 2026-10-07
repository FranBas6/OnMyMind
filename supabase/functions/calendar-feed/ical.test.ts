import { describe, expect, it } from 'vitest'

import { occurrencesFrom, parseRule } from '@/features/items/recurrence'

import {
  buildCalendar,
  escapeText,
  type Feed,
  type FeedEvent,
  feedRule,
  foldLine,
  offsetMinutes,
  parseFeed,
  tokenFromPath,
  vtimezone,
} from './ical'

const NOW = new Date('2026-10-07T08:49:41Z')
const TOKEN = 'jAtRC-zPHNKrj7nVnY8N7wn4JgSs3Mup'

function event(overrides: Partial<FeedEvent> = {}): FeedEvent {
  return {
    id: '5a0c3e0e-1f7e-4d59-9a39-1c3b9f7a0b01',
    listId: '01c90dfa-4eb3-478f-b030-04d51a830ef7',
    listName: 'Agenda',
    title: 'Cena con Marta',
    notes: null,
    allDay: false,
    start: '2026-11-13T21:00:00',
    recurrence: null,
    updatedAt: new Date('2026-10-06T18:30:00Z'),
    ...overrides,
  }
}

/** Las líneas lógicas del texto: deshace el plegado de 75 bytes. */
function unfold(text: string): string[] {
  return text.replace(/\r\n /g, '').split('\r\n').filter(Boolean)
}

describe('el texto', () => {
  it('escapa barras, puntos y comas, comas y saltos de línea', () => {
    expect(escapeText('Mesa 4; terraza, si hace bueno\nLlevar C:\\vino')).toBe(
      'Mesa 4\\; terraza\\, si hace bueno\\nLlevar C:\\\\vino',
    )
    expect(escapeText('a\r\nb\rc')).toBe('a\\nb\\nc')
  })

  it('pliega en 75 bytes sin partir una letra de varios bytes', () => {
    const line = `SUMMARY:${'Cumpleaños de la abuela 🎂 en Málaga, '.repeat(4)}`
    const folded = foldLine(line)
    const parts = folded.split('\r\n')
    expect(parts.length).toBeGreaterThan(1)
    for (const part of parts) expect(new TextEncoder().encode(part).length).toBeLessThanOrEqual(75)
    expect(parts.slice(1).every((part) => part.startsWith(' '))).toBe(true)
    expect(unfold(folded)).toEqual([line])
  })

  it('una línea corta se queda como está', () => {
    expect(foldLine('SUMMARY:Puente')).toBe('SUMMARY:Puente')
  })
})

describe('la dirección', () => {
  it.each([
    [`/calendar-feed/${TOKEN}.ics`, TOKEN],
    [`/functions/v1/calendar-feed/${TOKEN}`, TOKEN],
    [`/calendar-feed/${TOKEN}.ics/`, TOKEN],
    ['/calendar-feed/', null],
    ['/calendar-feed/corto.ics', null],
    [`/calendar-feed/${TOKEN.slice(1)}%27.ics`, null],
  ])('%s → %s', (path, token) => {
    expect(tokenFromPath(path)).toBe(token)
  })
})

describe('lo que da la base', () => {
  const row = {
    id: 'e1',
    list_id: 'l1',
    list_name: 'Agenda',
    title: 'Puente',
    notes: '  ',
    all_day: true,
    start: '2026-12-07',
    recurrence: null,
    updated_at: '2026-10-06T18:30:00.123456+00:00',
  }

  it('lee los eventos y salta los que no se entienden', () => {
    expect(
      parseFeed({
        timezone: 'Europe/Madrid',
        events: [row, { ...row, start: '2026-12-07T10:00:00' }, { ...row, title: 3 }],
      }),
    ).toEqual({
      timezone: 'Europe/Madrid',
      events: [
        {
          id: 'e1',
          listId: 'l1',
          listName: 'Agenda',
          title: 'Puente',
          notes: null,
          allDay: true,
          start: '2026-12-07',
          recurrence: null,
          updatedAt: new Date('2026-10-06T18:30:00.123Z'),
        },
      ],
    })
  })

  it('un enlace que no existe (`null`) no es un calendario', () => {
    expect(parseFeed(null)).toBeNull()
    expect(parseFeed({ timezone: 'Europe/Madrid' })).toBeNull()
  })
})

describe('la repetición (nota de la 3.6)', () => {
  it.each([
    ['FREQ=WEEKLY;BYDAY=TU,FR', '2026-10-09', 'FREQ=WEEKLY;BYDAY=TU,FR'],
    ['FREQ=MONTHLY;BYMONTHDAY=15', '2026-10-15', 'FREQ=MONTHLY;BYMONTHDAY=15'],
    ['FREQ=MONTHLY;BYDAY=-1FR', '2026-10-30', 'FREQ=MONTHLY;BYDAY=-1FR'],
    ['FREQ=MONTHLY', '2026-10-28T10:00:00', 'FREQ=MONTHLY'],
    ['FREQ=MONTHLY', '2026-10-31T10:00:00', 'FREQ=MONTHLY;BYMONTHDAY=-1'],
    ['FREQ=MONTHLY;BYMONTHDAY=31', '2026-10-31', 'FREQ=MONTHLY;BYMONTHDAY=-1'],
    [
      'FREQ=MONTHLY;INTERVAL=2;BYMONTHDAY=30',
      '2026-09-30',
      'FREQ=MONTHLY;INTERVAL=2;BYMONTHDAY=28,29,30;BYSETPOS=-1',
    ],
    ['FREQ=MONTHLY;BYMONTHDAY=29', '2026-10-29', 'FREQ=MONTHLY;BYMONTHDAY=28,29;BYSETPOS=-1'],
    ['FREQ=YEARLY', '2024-02-29', 'FREQ=YEARLY;BYMONTH=2;BYMONTHDAY=28,29;BYSETPOS=-1'],
    ['FREQ=YEARLY;INTERVAL=2', '2026-10-09', 'FREQ=YEARLY;INTERVAL=2'],
    ['FREQ=DAILY;INTERVAL=3', '2026-10-09', 'FREQ=DAILY;INTERVAL=3'],
  ])('%s desde el %s → %s', (rule, start, expected) => {
    expect(feedRule(rule, start)).toBe(expected)
  })

  /**
   * Lo que el Calendario hará con la regla escrita, para las de días del mes: cada mes (o cada
   * año, en febrero), el último de los días de la lista que el mes tenga.
   */
  function rfcDays(rule: string, start: string, count: number): string[] {
    const parts = Object.fromEntries(rule.split(';').map((part) => part.split('=')))
    const days = String(parts.BYMONTHDAY).split(',').map(Number)
    const step = Number(parts.INTERVAL ?? 1) * (parts.FREQ === 'YEARLY' ? 12 : 1)
    const [year = 0, month = 1] = start.split('-').map(Number)
    return Array.from({ length: count }, (_, k) => {
      const m = month - 1 + k * step
      const last = new Date(Date.UTC(year, m + 1, 0)).getUTCDate()
      const inMonth = days.map((d) => (d < 0 ? last + 1 + d : d)).filter((d) => d <= last)
      const day = Math.max(...inMonth)
      return new Date(Date.UTC(year, m, day)).toISOString().slice(0, 10)
    })
  }

  /** Lo que enseña la app (`recurrence.ts`), en las mismas fechas. */
  function appDays(rule: string, start: string, count: number): string[] {
    const parsed = parseRule(rule)
    if (!parsed) throw new Error(rule)
    const [year = 0, month = 1, day = 1] = start.split('-').map(Number)
    const first = new Date(year, month - 1, day, 10)
    const days: string[] = []
    for (const date of occurrencesFrom(first, parsed, first)) {
      days.push(
        `${String(date.getFullYear())}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`,
      )
      if (days.length === count) break
    }
    return days
  }

  it.each([
    ['FREQ=MONTHLY', '2026-01-31'],
    ['FREQ=MONTHLY;BYMONTHDAY=30', '2026-01-30'],
    ['FREQ=MONTHLY;INTERVAL=2;BYMONTHDAY=29', '2027-12-29'],
    ['FREQ=MONTHLY;INTERVAL=3', '2026-11-30'],
    ['FREQ=YEARLY', '2024-02-29'],
  ])('%s desde el %s: el Calendario y la app dicen los mismos días', (rule, start) => {
    const count = rule.includes('YEARLY') ? 9 : 30
    expect(rfcDays(feedRule(rule, start), start, count)).toEqual(appDays(rule, start, count))
  })
})

describe('la zona', () => {
  it('sabe cuánto va por delante de UTC', () => {
    expect(offsetMinutes('Europe/Madrid', new Date('2026-07-01T12:00:00Z'))).toBe(120)
    expect(offsetMinutes('Europe/Madrid', new Date('2026-12-01T12:00:00Z'))).toBe(60)
    expect(offsetMinutes('America/St_Johns', new Date('2026-12-01T12:00:00Z'))).toBe(-210)
  })

  it('Madrid: el último domingo de marzo a las 2 y el de octubre a las 3, desde 1970', () => {
    expect(vtimezone('Europe/Madrid', NOW)).toEqual([
      'BEGIN:VTIMEZONE',
      'TZID:Europe/Madrid',
      'BEGIN:DAYLIGHT',
      'DTSTART:19700329T020000',
      'RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU',
      'TZOFFSETFROM:+0100',
      'TZOFFSETTO:+0200',
      'END:DAYLIGHT',
      'BEGIN:STANDARD',
      'DTSTART:19701025T030000',
      'RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU',
      'TZOFFSETFROM:+0200',
      'TZOFFSETTO:+0100',
      'END:STANDARD',
      'END:VTIMEZONE',
    ])
  })

  it('Nueva York (el segundo y el primer domingo) y Sídney (al revés, en el sur)', () => {
    const ny = vtimezone('America/New_York', NOW)
    expect(ny).toContain('RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=2SU')
    expect(ny).toContain('DTSTART:19700308T020000')
    expect(ny).toContain('RRULE:FREQ=YEARLY;BYMONTH=11;BYDAY=1SU')
    expect(ny).toContain('DTSTART:19701101T020000')

    const sydney = vtimezone('Australia/Sydney', NOW)
    expect(sydney.slice(2, 8)).toEqual([
      'BEGIN:STANDARD',
      'DTSTART:19700405T030000',
      'RRULE:FREQ=YEARLY;BYMONTH=4;BYDAY=1SU',
      'TZOFFSETFROM:+1100',
      'TZOFFSETTO:+1000',
      'END:STANDARD',
    ])
  })

  it('una zona sin cambios de hora es una sola parte', () => {
    expect(vtimezone('Asia/Tokyo', NOW)).toEqual([
      'BEGIN:VTIMEZONE',
      'TZID:Asia/Tokyo',
      'BEGIN:STANDARD',
      'DTSTART:19700101T000000',
      'TZOFFSETFROM:+0900',
      'TZOFFSETTO:+0900',
      'END:STANDARD',
      'END:VTIMEZONE',
    ])
  })
})

describe('el calendario', () => {
  const feed: Feed = {
    timezone: 'Europe/Madrid',
    events: [
      event({ notes: 'Reservado en La Tasquita; mesa 4, terraza' }),
      event({
        id: 'b2',
        title: 'Puente',
        allDay: true,
        start: '2026-12-07',
        listName: 'Casa, la de verdad',
      }),
      event({
        id: 'c3',
        title: 'Reunión de equipo',
        start: '2026-11-02T10:00:00',
        recurrence: 'FREQ=MONTHLY;BYDAY=1MO',
      }),
      event({
        id: 'd4',
        title: 'Pagar el alquiler',
        start: '2026-10-31T09:00:00',
        recurrence: 'FREQ=MONTHLY',
      }),
    ],
  }
  const text = buildCalendar(feed, NOW)
  const lines = unfold(text)

  it('es un VCALENDAR con CRLF y líneas de 75 bytes como mucho', () => {
    expect(text.startsWith('BEGIN:VCALENDAR\r\nVERSION:2.0\r\n')).toBe(true)
    expect(text.endsWith('END:VCALENDAR\r\n')).toBe(true)
    expect(text.replace(/\r\n/g, '')).not.toMatch(/[\r\n]/)
    for (const line of text.split('\r\n')) {
      expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75)
    }
  })

  it('se llama OnMyMind, va en la zona de la persona y pide mirarlo cada hora', () => {
    expect(lines).toEqual(
      expect.arrayContaining([
        'PRODID:-//OnMyMind//Calendario//ES',
        'METHOD:PUBLISH',
        'X-WR-CALNAME:OnMyMind',
        'X-WR-TIMEZONE:Europe/Madrid',
        'REFRESH-INTERVAL;VALUE=DURATION:PT1H',
        'TZID:Europe/Madrid',
      ]),
    )
  })

  it('un evento con hora: en su zona, una hora, con la lista, las notas y el enlace a la app', () => {
    const start = lines.indexOf('BEGIN:VEVENT')
    expect(lines.slice(start, lines.indexOf('END:VEVENT') + 1)).toEqual([
      'BEGIN:VEVENT',
      'UID:5a0c3e0e-1f7e-4d59-9a39-1c3b9f7a0b01@onmymind',
      'DTSTAMP:20261007T084941Z',
      'LAST-MODIFIED:20261006T183000Z',
      'SUMMARY:Cena con Marta',
      'DTSTART;TZID=Europe/Madrid:20261113T210000',
      'DURATION:PT1H',
      'CATEGORIES:Agenda',
      'DESCRIPTION:Reservado en La Tasquita\\; mesa 4\\, terraza',
      'URL:https://onmymind.pages.dev/lists/01c90dfa-4eb3-478f-b030-04d51a830ef7?item=5a0c3e0e-1f7e-4d59-9a39-1c3b9f7a0b01',
      'END:VEVENT',
    ])
  })

  it('uno de todo el día: el día entero, sin ocupar, y la coma del nombre de la lista escapada', () => {
    expect(lines).toEqual(
      expect.arrayContaining([
        'DTSTART;VALUE=DATE:20261207',
        'DTEND;VALUE=DATE:20261208',
        'TRANSP:TRANSPARENT',
        'CATEGORIES:Casa\\, la de verdad',
      ]),
    )
  })

  it('la repetición, tal cual o traducida', () => {
    expect(lines).toContain('RRULE:FREQ=MONTHLY;BYDAY=1MO')
    expect(lines).toContain('RRULE:FREQ=MONTHLY;BYMONTHDAY=-1')
  })

  it('sin eventos con hora no lleva zona; sin eventos, es un calendario vacío', () => {
    const allDay = buildCalendar(
      { timezone: 'Europe/Madrid', events: [feed.events[1] ?? event()] },
      NOW,
    )
    expect(allDay).not.toContain('VTIMEZONE')
    const empty = unfold(buildCalendar({ timezone: 'Europe/Madrid', events: [] }, NOW))
    expect(empty.at(0)).toBe('BEGIN:VCALENDAR')
    expect(empty.at(-1)).toBe('END:VCALENDAR')
    expect(empty).not.toContain('BEGIN:VEVENT')
  })
})
