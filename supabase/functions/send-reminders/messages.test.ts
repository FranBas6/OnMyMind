import { addDays, format } from 'date-fns'
import { describe, expect, it } from 'vitest'

import { shortDay as appShortDay } from '@/features/items/events'
import { VAPID_PUBLIC_KEY as APP_VAPID_PUBLIC_KEY } from '@/features/reminders/vapid'
import { parsePush } from '@/sw/push'

import {
  daysBetween,
  type DueReminder,
  groupByUser,
  isGoneStatus,
  planReminder,
  reminderBody,
  shortDay,
  summaryMessage,
  type SummaryEntry,
  toDueReminder,
  toSummaryEntry,
  untilLabel,
  VAPID_PUBLIC_KEY,
  vapidJwk,
} from './messages'

// Lunes 5 de octubre de 2026, a las 9:00 en Madrid (7:00 UTC).
const NOW = new Date('2026-10-05T07:00:20Z')
const NOW_LOCAL = '2026-10-05T09:00'

function reminder(overrides: Partial<DueReminder> = {}): DueReminder {
  return {
    reminderId: 'r1',
    userId: 'u1',
    itemId: 'i1',
    listId: 'agenda',
    title: 'Dentista',
    kind: 'event',
    allDay: false,
    listName: 'Agenda',
    remindAt: new Date('2026-10-05T07:00:00Z'),
    occursAt: new Date('2026-10-05T08:00:00Z'),
    occursLocal: '2026-10-05T10:00',
    nowLocal: NOW_LOCAL,
    done: false,
    hidden: false,
    ...overrides,
  }
}

describe('qué se envía de un aviso vencido', () => {
  it('un evento con hora: «En 1 h · 10:00 · Agenda», que abre el ítem (diseño 18, N1)', () => {
    expect(planReminder(reminder(), NOW)).toEqual({
      send: true,
      message: {
        title: 'Dentista',
        body: 'En 1 h · 10:00 · Agenda',
        url: '/lists/agenda?item=i1',
        tag: 'reminder:i1',
      },
    })
  })

  it('el mensaje es el que entiende el service worker', () => {
    const plan = planReminder(reminder(), NOW)
    if (!plan.send) throw new Error('debería enviarse')
    expect(parsePush(JSON.stringify(plan.message))).toEqual(plan.message)
  })

  it('lo terminado o callado no sale', () => {
    expect(planReminder(reminder({ done: true }), NOW)).toEqual({ send: false, reason: 'done' })
    expect(planReminder(reminder({ hidden: true }), NOW)).toEqual({ send: false, reason: 'hidden' })
  })

  it('hasta 15 minutos tarde se envía, con lo que falta de verdad; más tarde, no', () => {
    const late = new Date('2026-10-05T07:15:00Z')
    const plan = planReminder(reminder(), late)
    expect(plan.send && plan.message.body).toBe('En 45 min · 10:00 · Agenda')
    expect(planReminder(reminder(), new Date('2026-10-05T07:15:01Z'))).toEqual({
      send: false,
      reason: 'late',
    })
  })
})

describe('el texto de un aviso', () => {
  it('con hora, cuánto falta hoy; mañana u otro día, el día', () => {
    expect(reminderBody(reminder(), NOW)).toBe('En 1 h · 10:00 · Agenda')
    const tomorrow = reminder({
      occursAt: new Date('2026-10-06T08:00:00Z'),
      occursLocal: '2026-10-06T10:00',
    })
    expect(reminderBody(tomorrow, NOW)).toBe('Mañana · 10:00 · Agenda')
    const thursday = reminder({
      occursAt: new Date('2026-10-08T08:00:00Z'),
      occursLocal: '2026-10-08T10:00',
    })
    expect(reminderBody(thursday, NOW)).toBe('Jue 8 · 10:00 · Agenda')
  })

  it('cuánto falta redondea hacia arriba: el de «1 hora antes» dice 1 h aunque salga tarde unos segundos', () => {
    const at = new Date('2026-10-05T08:00:00Z')
    expect(untilLabel(at, new Date('2026-10-05T07:00:40Z'))).toBe('En 1 h')
    expect(untilLabel(at, new Date('2026-10-05T07:50:30Z'))).toBe('En 10 min')
    expect(untilLabel(at, new Date('2026-10-05T06:30:00Z'))).toBe('En 1 h 30 min')
    expect(untilLabel(at, new Date('2026-10-05T08:00:30Z'))).toBe('Ahora')
    expect(untilLabel(at, new Date('2026-10-05T07:59:59Z'))).toBe('En 1 min')
  })

  it('una tarea con fecha: «Vence hoy · Casa» (N2), mañana, otro día o ya vencida', () => {
    const task = (occursLocal: string) =>
      reminder({
        kind: 'task',
        allDay: true,
        listName: 'Casa',
        occursAt: new Date(`${occursLocal.slice(0, 10)}T00:00:00+02:00`),
        occursLocal,
      })
    expect(reminderBody(task('2026-10-05T00:00'), NOW)).toBe('Vence hoy · Casa')
    expect(reminderBody(task('2026-10-06T00:00'), NOW)).toBe('Vence mañana · Casa')
    expect(reminderBody(task('2026-10-09T00:00'), NOW)).toBe('Vence el vie 9 · Casa')
    expect(reminderBody(task('2026-10-04T00:00'), NOW)).toBe('Venció ayer · Casa')
    expect(reminderBody(task('2026-09-28T00:00'), NOW)).toBe('Venció el lun 28 sep · Casa')
  })

  it('un evento de todo el día: «Hoy» o «Mañana» y la lista', () => {
    const birthday = (occursLocal: string) =>
      reminder({ title: 'Cumpleaños de Ana', allDay: true, occursLocal })
    expect(reminderBody(birthday('2026-10-05T00:00'), NOW)).toBe('Hoy · Agenda')
    expect(reminderBody(birthday('2026-10-06T00:00'), NOW)).toBe('Mañana · Agenda')
    expect(reminderBody(birthday('2026-11-02T00:00'), NOW)).toBe('Lun 2 nov · Agenda')
  })

  it('sin fecha (un aviso personalizado), solo la lista', () => {
    const undated = reminder({ kind: 'task', occursAt: null, occursLocal: null, listName: 'Casa' })
    expect(reminderBody(undated, NOW)).toBe('Casa')
  })
})

describe('el día corto, como el de la app', () => {
  it('dice lo mismo que `shortDay` de features/items/events.ts', () => {
    const today = new Date(2026, 9, 5, 9, 0)
    const local = (day: Date) => format(day, "yyyy-MM-dd'T'HH:mm")
    for (let offset = -40; offset <= 500; offset += 1) {
      if (offset === 0 || offset === 1) continue
      const day = addDays(today, offset)
      expect(shortDay(local(day), local(today))).toBe(appShortDay(day, today))
    }
  })

  it('los días entre dos fechas locales cruzan meses y años', () => {
    expect(daysBetween('2026-10-05T23:59', '2026-10-06T00:00')).toBe(1)
    expect(daysBetween('2026-12-31T09:00', '2027-01-01T09:00')).toBe(1)
    expect(daysBetween('2026-10-05T09:00', '2026-09-28T00:00')).toBe(-7)
  })
})

describe('el resumen de Hoy', () => {
  const entry = (title: string, overrides: Partial<SummaryEntry> = {}): SummaryEntry => ({
    userId: 'u1',
    kind: 'task',
    title,
    allDay: true,
    occursLocal: '2026-10-05T00:00',
    overdue: false,
    ...overrides,
  })
  const dentista = entry('Dentista', {
    kind: 'event',
    allDay: false,
    occursLocal: '2026-10-05T10:00',
  })

  it('«3 cosas para hoy» y «Dentista a las 10:00, Pagar el alquiler y 1 más» (N3)', () => {
    expect(
      summaryMessage([dentista, entry('Pagar el alquiler'), entry('Llamar al seguro')]),
    ).toEqual({
      title: '3 cosas para hoy',
      body: 'Dentista a las 10:00, Pagar el alquiler y 1 más',
      url: '/today',
      tag: 'summary',
    })
  })

  it('con una o dos, sin «más»; los de todo el día, sin hora', () => {
    expect(summaryMessage([dentista])).toMatchObject({
      title: '1 cosa para hoy',
      body: 'Dentista a las 10:00',
    })
    const birthday = entry('Cumpleaños de Ana', { kind: 'event' })
    expect(summaryMessage([birthday, dentista])).toMatchObject({
      title: '2 cosas para hoy',
      body: 'Cumpleaños de Ana y Dentista a las 10:00',
    })
  })

  it('sin nada para hoy, no hay resumen', () => {
    expect(summaryMessage([])).toBeNull()
  })

  it('se reparte por persona, en el orden en que llega', () => {
    const other = entry('Otra cosa', { userId: 'u2' })
    const grouped = groupByUser([dentista, other, entry('Pagar el alquiler')])
    expect([...grouped.keys()]).toEqual(['u1', 'u2'])
    expect(grouped.get('u1')?.map((item) => item.title)).toEqual(['Dentista', 'Pagar el alquiler'])
  })
})

describe('las filas de la base', () => {
  it('un aviso, de snake_case a lo de aquí; sin lo esencial, nada', () => {
    const row = {
      reminder_id: 'r1',
      user_id: 'u1',
      item_id: 'i1',
      list_id: 'agenda',
      title: 'Dentista',
      kind: 'event',
      all_day: false,
      list_name: 'Agenda',
      remind_at: '2026-10-05T07:00:00+00:00',
      occurs_at: '2026-10-05T08:00:00+00:00',
      occurs_local: '2026-10-05T10:00',
      now_local: NOW_LOCAL,
      done: false,
      hidden: false,
    }
    expect(toDueReminder(row)).toEqual(reminder())
    expect(toDueReminder({ ...row, occurs_at: null, occurs_local: null })).toMatchObject({
      occursAt: null,
      occursLocal: null,
    })
    expect(toDueReminder({ ...row, remind_at: 'no' })).toBeNull()
    expect(toDueReminder({ ...row, item_id: null })).toBeNull()
  })

  it('algo del resumen', () => {
    expect(
      toSummaryEntry({
        user_id: 'u1',
        kind: 'event',
        title: 'Dentista',
        all_day: false,
        occurs_local: '2026-10-05T10:00',
        overdue: false,
      }),
    ).toEqual({
      userId: 'u1',
      kind: 'event',
      title: 'Dentista',
      allDay: false,
      occursLocal: '2026-10-05T10:00',
      overdue: false,
    })
    expect(toSummaryEntry({ user_id: 'u1' })).toBeNull()
  })
})

describe('el envío', () => {
  it('una suscripción que ya no existe (404 o 410) se borra; otros errores, no', () => {
    expect(isGoneStatus(410)).toBe(true)
    expect(isGoneStatus(404)).toBe(true)
    expect(isGoneStatus(429)).toBe(false)
    expect(isGoneStatus(500)).toBe(false)
  })

  it('la clave pública es la de la app', () => {
    expect(VAPID_PUBLIC_KEY).toBe(APP_VAPID_PUBLIC_KEY)
  })

  it('el par VAPID en JWK firma y verifica con WebCrypto', async () => {
    // Un par cualquiera, en el formato de web-push (el de la app es secreto).
    const pair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, [
      'sign',
      'verify',
    ])
    const raw = new Uint8Array(await crypto.subtle.exportKey('raw', pair.publicKey))
    const jwk = await crypto.subtle.exportKey('jwk', pair.privateKey)
    const encode = (bytes: Uint8Array) =>
      btoa(String.fromCharCode(...bytes))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '')
    const keys = vapidJwk(encode(raw), jwk.d ?? '')

    const algorithm = { name: 'ECDSA', namedCurve: 'P-256' }
    const signing = await crypto.subtle.importKey('jwk', keys.privateKey, algorithm, false, [
      'sign',
    ])
    const verifying = await crypto.subtle.importKey('jwk', keys.publicKey, algorithm, true, [
      'verify',
    ])
    const data = new TextEncoder().encode('OnMyMind')
    const signature = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, signing, data)
    expect(
      await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, verifying, signature, data),
    ).toBe(true)
  })

  it('una clave que no es P-256 se rechaza', () => {
    expect(() => vapidJwk('AAAA', 'AAAA')).toThrow('pública')
    expect(() => vapidJwk(VAPID_PUBLIC_KEY, 'AAAA')).toThrow('privada')
  })
})
