import { describe, expect, it } from 'vitest'

import {
  inTrial,
  monthlyCents,
  paidToast,
  paymentDateLong,
  paymentRepeatLabel,
  paymentTotals,
  paymentWhen,
  perYear,
  priceEvery,
  returnsShort,
  statusLabel,
} from './payments'
import { parseRule } from './recurrence'
import type { Item } from './types'

/** El domingo 15 de noviembre de 2026, el día que cobra Spotify (diseño 30). */
const NOW = new Date(2026, 10, 15, 10)
const day = (month: number, date: number, year = 2026) => new Date(year, month - 1, date)

function compra(overrides: Partial<Item> = {}): Item {
  return {
    id: crypto.randomUUID(),
    listId: 'l',
    kind: 'shopping',
    parentId: null,
    chooseOne: false,
    chosenId: null,
    sealed: null,
    title: 'Algo',
    notes: null,
    status: 'pending',
    priority: null,
    dueAt: null,
    allDay: false,
    recurrence: null,
    trial: false,
    autoPay: true,
    position: 1000,
    completedAt: null,
    createdAt: NOW,
    leftInboxId: null,
    leftInboxAt: null,
    url: null,
    urlTitle: null,
    imageUrl: null,
    imagePath: null,
    urlSite: null,
    priceCents: 1000,
    currency: 'EUR',
    priceSource: 'manual',
    previousPriceCents: null,
    priceCheckedAt: null,
    links: [],
    images: [],
    files: [],
    priceLinkId: null,
    priceStore: null,
    priceTracking: null,
    createdBy: null,
    completedBy: null,
    ...overrides,
  }
}

/** Uno que se paga a mano (6.5): el de las fechas «Jue 3 dic», «Hoy» y «Venció el 12». */
const netflix = compra({
  autoPay: false,
  title: 'Netflix',
  priceCents: 1299,
  dueAt: day(12, 3),
  recurrence: 'FREQ=MONTHLY;BYMONTHDAY=3',
})

describe('qué es un pago', () => {
  it('«Pagado» en una compra con fecha; «Comprado» en una sin ella', () => {
    expect(statusLabel(netflix, 'bought')).toBe('Pagado')
    expect(statusLabel(compra(), 'bought')).toBe('Comprado')
    expect(statusLabel(netflix, 'discarded')).toBe('Descartado')
  })

  it('en prueba hasta el día que empieza a cobrar', () => {
    const disney = compra({ trial: true, dueAt: day(11, 20), recurrence: 'FREQ=MONTHLY' })
    expect(inTrial(disney, NOW)).toBe(true)
    expect(inTrial({ ...disney, dueAt: day(11, 15) }, NOW)).toBe(false)
    expect(inTrial({ ...disney, recurrence: null }, NOW)).toBe(false)
  })
})

describe('las fechas de un pago', () => {
  it('en la fila (L1, L2)', () => {
    expect(paymentWhen(netflix, NOW)).toEqual({ text: 'Jue 3 dic', tone: 'plain' })
    expect(paymentWhen({ ...netflix, dueAt: day(11, 15) }, NOW)).toEqual({
      text: 'Hoy',
      tone: 'today',
    })
    expect(paymentWhen({ ...netflix, dueAt: day(11, 12) }, NOW)).toEqual({
      text: 'Venció el 12',
      tone: 'overdue',
    })
    const multa = compra({ dueAt: day(11, 30) })
    expect(paymentWhen(multa, NOW)).toEqual({ text: 'Antes del lun 30', tone: 'plain' })
    const disney = compra({ trial: true, dueAt: day(11, 20), recurrence: 'FREQ=MONTHLY' })
    expect(paymentWhen(disney, NOW)).toEqual({ text: 'Prueba · cobra desde el 20', tone: 'trial' })
    expect(paymentWhen(compra(), NOW)).toBeNull()
  })

  it('lo que se cobra solo no vence (6.5): «Se cobra el 2 dic», «Se cobra hoy»', () => {
    const youtube = { ...netflix, autoPay: true, dueAt: day(12, 2) }
    expect(paymentWhen(youtube, NOW)).toEqual({ text: 'Se cobra el 2 dic', tone: 'plain' })
    expect(paymentWhen({ ...youtube, dueAt: day(11, 15) }, NOW)?.text).toBe('Se cobra hoy')
    expect(paymentWhen({ ...youtube, dueAt: day(11, 16) }, NOW)?.text).toBe('Se cobra mañana')
  })

  it('en la ficha (F1, F6, F7)', () => {
    expect(paymentDateLong(netflix, NOW)?.text).toBe('Jue 3 dic')
    expect(paymentDateLong(compra({ dueAt: day(11, 30) }), NOW)?.text).toBe('Antes del lun 30 nov')
    expect(paymentDateLong(compra({ dueAt: day(11, 10) }), NOW)).toEqual({
      text: 'Venció el mar 10 nov',
      urgent: true,
    })
  })
})

describe('la repetición de un pago', () => {
  it('en la fila: «Cada mes · el 3», «Cada año · en marzo»', () => {
    expect(paymentRepeatLabel(netflix)).toBe('Cada mes · el 3')
    expect(paymentRepeatLabel({ dueAt: day(3, 3, 2027), recurrence: 'FREQ=YEARLY' })).toBe(
      'Cada año · en marzo',
    )
    expect(paymentRepeatLabel({ dueAt: day(12, 3), recurrence: 'FREQ=WEEKLY;BYDAY=TH' })).toBe(
      'Cada semana · los jueves',
    )
    expect(paymentRepeatLabel(netflix, { bare: true })).toBe('Cada mes')
  })

  it('tras el precio: «cada mes», y en prueba desde cuándo', () => {
    expect(priceEvery(netflix, NOW)).toBe('cada mes')
    const disney = compra({ trial: true, dueAt: day(11, 20), recurrence: 'FREQ=MONTHLY' })
    expect(priceEvery(disney, NOW)).toBe('cada mes, desde el 20 nov')
    expect(priceEvery(compra({ dueAt: day(11, 30) }), NOW)).toBeNull()
  })

  it('al pagar', () => {
    expect(paidToast(day(1, 3, 2027))).toBe('Pagado · vuelve el 3 de enero')
    expect(returnsShort(day(1, 3, 2027), NOW)).toBe('vuelve el 3 ene 2027')
    expect(returnsShort(day(12, 15), NOW)).toBe('vuelve el 15 dic')
  })
})

describe('lo que suman', () => {
  it('cuántas veces al año, como `recurrence_per_year`', () => {
    const times = (text: string) => {
      const rule = parseRule(text)
      if (!rule) throw new Error(text)
      return perYear(rule)
    }
    expect(times('FREQ=MONTHLY')).toBe(12)
    expect(times('FREQ=WEEKLY;BYDAY=TU,FR')).toBe(104)
    expect(times('FREQ=YEARLY;INTERVAL=2')).toBe(0.5)
  })

  it('la sublista «Suscripciones» (L1): 4 pagos, 1 en prueba, 43,98 € al mes', () => {
    const totals = paymentTotals(
      [
        netflix,
        compra({ priceCents: 1099, dueAt: day(11, 15), recurrence: 'FREQ=MONTHLY' }),
        compra({ priceCents: 24000, dueAt: day(3, 3, 2027), recurrence: 'FREQ=YEARLY' }),
        compra({ priceCents: 899, trial: true, dueAt: day(11, 20), recurrence: 'FREQ=MONTHLY' }),
        compra({
          priceCents: 999,
          status: 'discarded',
          dueAt: day(10, 2),
          recurrence: 'FREQ=MONTHLY',
        }),
        compra({ priceCents: 2000 }),
      ],
      NOW,
    )
    expect(totals).toEqual({ payments: 4, trials: 1, yearlyCents: 52776, recurringCents: 27297 })
    expect(monthlyCents(52776)).toBe(4398)
  })

  it('sin nada que se repita, sin total al año', () => {
    expect(paymentTotals([compra({ dueAt: day(11, 30) })], NOW)).toEqual({
      payments: 1,
      trials: 0,
      yearlyCents: null,
      recurringCents: 0,
    })
  })
})
