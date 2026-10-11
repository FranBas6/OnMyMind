import { describe, expect, it } from 'vitest'

import {
  cheapestOption,
  choicePrice,
  chosenLabel,
  chosenOption,
  countedOption,
  isChoosing,
  optionMarks,
  optionsMeta,
} from './chooseOne'
import { pendingTotals } from './prices'
import { countItems, duplicateSublist, sublistMeta, sublistSummary } from './sublists'
import type { Item } from './types'

function item(id: string, overrides: Partial<Item> = {}): Item {
  return {
    id,
    listId: 'compras',
    kind: 'shopping',
    parentId: 'volantes',
    chooseOne: false,
    chosenId: null,
    title: id,
    notes: null,
    status: 'pending',
    priority: null,
    dueAt: null,
    allDay: false,
    recurrence: null,
    position: 1000,
    completedAt: null,
    createdAt: new Date(2026, 9, 11),
    leftInboxId: null,
    leftInboxAt: null,
    url: null,
    urlTitle: null,
    imageUrl: null,
    imagePath: null,
    urlSite: null,
    priceCents: null,
    currency: 'EUR',
    priceSource: null,
    previousPriceCents: null,
    priceCheckedAt: null,
    links: [],
    images: [],
    priceLinkId: null,
    priceStore: null,
    priceTracking: null,
    createdBy: null,
    completedBy: null,
    ...overrides,
  }
}

const NBSP = ' '
const volantes = item('volantes', {
  kind: 'sublist',
  parentId: null,
  title: 'Volantes',
  chooseOne: true,
})
const g29 = item('g29', { title: 'Logitech G29', priceCents: 19900, position: 1000 })
const g923 = item('g923', { title: 'Logitech G923', priceCents: 24999, position: 2000 })
const moza = item('moza', { title: 'Moza R3', position: 3000 })
const leche = item('leche', { parentId: null, priceCents: 249, position: 2000 })
const opciones = [g29, g923]

describe('elegir una: la más barata (diseño 24, A2)', () => {
  it('solo se elige en una sublista activa «para elegir una»', () => {
    expect(isChoosing(volantes)).toBe(true)
    expect(isChoosing({ ...volantes, chooseOne: false })).toBe(false)
    expect(isChoosing({ ...volantes, status: 'paused' })).toBe(false)
    expect(isChoosing({ ...volantes, status: 'done' })).toBe(false)
  })

  it('la más barata es la compra pendiente con precio que menos cuesta, en euros primero', () => {
    expect(cheapestOption(opciones)?.id).toBe('g29')
    expect(cheapestOption([...opciones, moza])?.id).toBe('g29')
    const usd = item('usd', { priceCents: 100, currency: 'USD' })
    expect(cheapestOption([usd, g923])?.id).toBe('g923')
    expect(cheapestOption([{ ...g29, status: 'discarded' }, g923])?.id).toBe('g923')
    expect(cheapestOption([moza])).toBeNull()
  })

  it('«Más barata» en la ganadora, cuánto más en las demás y «Sin precio» (A2, A8)', () => {
    const marks = optionMarks(volantes, [...opciones, moza])
    expect(marks.get('g29')).toEqual({ kind: 'cheapest' })
    expect(marks.get('g923')).toEqual({ kind: 'extra', text: `+50,99${NBSP}€` })
    expect(marks.get('moza')).toEqual({ kind: 'unpriced' })
  })

  it('con una sola con precio no hay «Más barata» (A8b), ni en lo que no es compra (A7)', () => {
    expect(optionMarks(volantes, [g29]).size).toBe(0)
    const hoteles = [item('plaza', { kind: 'task' }), item('bairro', { kind: 'task' })]
    expect(optionMarks(volantes, hoteles).size).toBe(0)
  })

  it('debajo del nombre: «2 opciones · desde 199 €», «1 opción · 199 €», «2 opciones»', () => {
    expect(optionsMeta(volantes, opciones)).toBe(`2 opciones · desde 199${NBSP}€`)
    expect(optionsMeta(volantes, [...opciones, moza])).toBe(`3 opciones · desde 199${NBSP}€`)
    expect(optionsMeta(volantes, [g29])).toBe(`1 opción · 199${NBSP}€`)
    expect(optionsMeta(volantes, [item('a', { kind: 'task' }), item('b', { kind: 'task' })])).toBe(
      '2 opciones',
    )
    expect(optionsMeta(volantes, [{ ...g29, status: 'discarded' }])).toBeNull()
  })

  it('la fila y la cabecera de la sublista lo dicen; si no es «para elegir una», como siempre', () => {
    expect(sublistMeta(volantes, opciones)).toBe(`2 opciones · desde 199${NBSP}€`)
    expect(sublistMeta({ ...volantes, status: 'in_progress' }, opciones)).toBe(
      `2 opciones · desde 199${NBSP}€ · En curso`,
    )
    expect(sublistSummary(volantes, opciones, 'Compras')).toBe(`2 opciones · desde 199${NBSP}€`)
    expect(sublistMeta({ ...volantes, chooseOne: false }, opciones)).toBe('2 pendientes')
  })

  it('cuenta en su lista lo de la más barata (A2)', () => {
    expect(choicePrice(volantes, opciones)).toEqual({ paid: false, cents: 19900, currency: 'EUR' })
    expect(choicePrice(volantes, [moza])).toBeNull()
  })
})

describe('elegir una: contadores y total (A3)', () => {
  const compras = [volantes, ...opciones, leche]

  it('las opciones pendientes cuentan como una sola cosa, y en el total la más barata', () => {
    expect(countItems(compras)).toEqual({ pending: 2, done: 0, notes: 0 })
    expect(pendingTotals(compras).euros).toBe(19900 + 249)
  })

  it('sin «elegir una», suman todas', () => {
    const sumando = [{ ...volantes, chooseOne: false }, ...opciones, leche]
    expect(countItems(sumando)).toEqual({ pending: 3, done: 0, notes: 0 })
    expect(pendingTotals(sumando).euros).toBe(19900 + 24999 + 249)
  })

  it('hecha, se calla como cualquier sublista', () => {
    const hecha = [{ ...volantes, status: 'done' as const }, ...opciones, leche]
    expect(countItems(hecha)).toEqual({ pending: 1, done: 0, notes: 0 })
    expect(pendingTotals(hecha).euros).toBe(249)
  })
})

describe('«Elegir esta»: la preferida (Fran, 2026-10-11)', () => {
  const elegida = { ...volantes, chosenId: 'g923' }

  it('la elegida cuenta en el total, aunque no sea la más barata', () => {
    expect(countedOption(elegida, opciones)?.id).toBe('g923')
    expect(choicePrice(elegida, opciones)).toEqual({ paid: false, cents: 24999, currency: 'EUR' })
    expect(pendingTotals([elegida, ...opciones, leche]).euros).toBe(24999 + 249)
    expect(countItems([elegida, ...opciones, leche])).toEqual({ pending: 2, done: 0, notes: 0 })
  })

  it('lleva «Elegida»; las demás siguen comparándose', () => {
    expect(optionMarks(elegida, opciones)).toEqual(
      new Map([
        ['g923', { kind: 'chosen' }],
        ['g29', { kind: 'cheapest' }],
      ]),
    )
    expect(optionsMeta(elegida, opciones)).toBe('2 opciones · elegida Logitech G923')
    expect(sublistMeta(elegida, opciones)).toBe('2 opciones · elegida Logitech G923')
  })

  it('comprada la elegida, cuenta la más barata de lo que queda pendiente', () => {
    const comprada = [g29, { ...g923, status: 'bought' as const }]
    expect(countedOption(elegida, comprada)?.id).toBe('g29')
    expect(optionsMeta(elegida, comprada)).toBe(`1 opción · 199${NBSP}€`)
    expect(countItems([elegida, ...comprada])).toEqual({ pending: 1, done: 1, notes: 0 })
  })

  it('cerrada a mano: «Hecha · elegida…», «Elegida…» en su fila y «Pagaste» si se compró', () => {
    const hecha = { ...elegida, status: 'done' as const }
    const comprada = [
      { ...g29, status: 'discarded' as const },
      { ...g923, status: 'bought' as const },
    ]
    expect(chosenOption(hecha, comprada)?.id).toBe('g923')
    expect(sublistSummary(hecha, comprada, 'Compras')).toBe('Hecha · elegida Logitech G923')
    expect(sublistMeta(hecha, comprada)).toBe('Elegida Logitech G923')
    expect(choicePrice(hecha, comprada)).toEqual({ paid: true, cents: 24999, currency: 'EUR' })
  })

  it('el aviso: «Elegida Logitech G923»', () => {
    expect(chosenLabel(g923)).toBe('Elegida Logitech G923')
  })

  it('duplicar la conserva «para elegir una», sin la elegida', () => {
    let next = 0
    const [copy] = duplicateSublist(elegida, opciones, {
      newId: () => `copia-${String((next += 1))}`,
      position: 5000,
    })
    expect(copy).toMatchObject({ chooseOne: true, chosenId: null, status: 'pending' })
  })
})
