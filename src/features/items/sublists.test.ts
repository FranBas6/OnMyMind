import { describe, expect, it } from 'vitest'

import {
  copyTitle,
  countItems,
  deleteSublistLabel,
  deleteSublistMessage,
  duplicateSublist,
  openSublistsLabel,
  positionAfter,
  sublistMeta,
  sublistSummary,
} from './sublists'
import type { Item } from './types'

function item(id: string, overrides: Partial<Item> = {}): Item {
  return {
    id,
    listId: 'viajes',
    kind: 'task',
    parentId: null,
    title: id,
    notes: null,
    status: 'pending',
    priority: null,
    dueAt: null,
    allDay: false,
    recurrence: null,
    position: 1000,
    completedAt: null,
    createdAt: new Date(2026, 8, 20),
    leftInboxId: null,
    leftInboxAt: null,
    url: null,
    urlTitle: null,
    imageUrl: null,
    imagePath: null,
    ...overrides,
  }
}

const hecha = { status: 'done' as const, completedAt: new Date(2026, 8, 25) }
const lisboa = item('lisboa', { kind: 'sublist', status: 'in_progress', title: 'Lisboa' })
const roma = item('roma', { kind: 'sublist', status: 'paused' })
const dentroLisboa = [
  item('vuelo', {
    parentId: 'lisboa',
    kind: 'event',
    status: 'upcoming',
    dueAt: new Date(2099, 0, 1),
  }),
  item('tranvia', { parentId: 'lisboa' }),
  item('hotel', { parentId: 'lisboa', ...hecha }),
]
const dentroRoma = [item('coliseo', { parentId: 'roma' })]
const pasaporte = item('pasaporte')

describe('countItems (las reglas de list_counters)', () => {
  it('suma lo de dentro de las sublistas activas y no la sublista', () => {
    expect(countItems([lisboa, ...dentroLisboa, pasaporte])).toEqual({ pending: 3, done: 1 })
  })

  it('lo de dentro de una pausada o hecha se calla', () => {
    expect(countItems([roma, ...dentroRoma, pasaporte])).toEqual({ pending: 1, done: 0 })
    const oporto = item('oporto', { kind: 'sublist', ...hecha })
    expect(countItems([oporto, item('x', { parentId: 'oporto' })])).toEqual({ pending: 0, done: 0 })
  })
})

describe('textos de la sublista (diseño 12)', () => {
  it('meta de la fila en sus estados', () => {
    expect(sublistMeta(lisboa, dentroLisboa)).toBe('2 pendientes · En curso')
    expect(sublistMeta(roma, dentroRoma)).toBe('1 pendiente · Pausada')
    expect(sublistMeta({ status: 'pending' }, [item('a', hecha)])).toBe('1 cosa')
    expect(sublistMeta({ status: 'pending' }, [])).toBe('Vacía')
    expect(sublistMeta({ status: 'done' }, dentroLisboa)).toBe('Hecha · 3 dentro')
  })

  it('subtítulo de su pantalla', () => {
    expect(sublistSummary(lisboa, dentroLisboa, 'Viajes')).toBe('2 pendientes · 1 hecha · En curso')
    expect(sublistSummary({ status: 'pending' }, [], 'Viajes')).toBe('Sublista de Viajes')
  })

  it('«· 3 sublistas» cuenta las que no están hechas', () => {
    expect(openSublistsLabel([lisboa, roma, item('o', { kind: 'sublist', ...hecha })])).toBe(
      '2 sublistas',
    )
    expect(openSublistsLabel([pasaporte])).toBeNull()
  })

  it('borrar con recuento', () => {
    expect(deleteSublistMessage(dentroLisboa)).toBe(
      'Se borran también las 3 cosas de dentro, 1 de ellas ya hecha. Tendrás cinco segundos para deshacer.',
    )
    expect(deleteSublistMessage(dentroRoma)).toBe(
      'Se borra también la cosa de dentro. Tendrás cinco segundos para deshacer.',
    )
    expect(deleteSublistLabel(dentroLisboa)).toBe('Borrar sublista y 3 cosas')
  })
})

describe('duplicar', () => {
  it('la copia va pendiente con lo de dentro, todo pendiente y colgando de la copia', () => {
    let n = 0
    const [copy, ...children] = duplicateSublist(lisboa, dentroLisboa, {
      newId: () => `nuevo-${++n}`,
      position: 1500,
    })
    expect(copy).toMatchObject({
      id: 'nuevo-1',
      title: 'Lisboa (copia)',
      status: 'pending',
      position: 1500,
    })
    expect(children.map((child) => [child.parentId, child.status, child.completedAt])).toEqual([
      ['nuevo-1', 'upcoming', null],
      ['nuevo-1', 'pending', null],
      ['nuevo-1', 'pending', null],
    ])
  })

  it('el título no pasa del límite y la posición cae entre la original y la siguiente', () => {
    expect(copyTitle('x'.repeat(300))).toHaveLength(300)
    const lista = [item('a', { position: 1000 }), item('b', { position: 2000 })]
    expect(positionAfter(lista, { position: 1000 })).toBe(1500)
    expect(positionAfter(lista, { position: 2000 })).toBe(3000)
  })
})
