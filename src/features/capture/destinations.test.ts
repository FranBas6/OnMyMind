import { describe, expect, it } from 'vitest'

import { destinationsOf, listDestination, type Destination, type Item } from '@/features/items'
import type { List } from '@/features/lists'

import { defaultDestination, destinationChips, shoppingDestination } from './destinations'

function list(id: string, overrides: Partial<List> = {}): List {
  return {
    id,
    name: id,
    color: 'coral',
    icon: null,
    kind: 'tasks',
    position: 1000,
    counters: { pending: 0, done: 0, pendingPriceCents: 0 },
    archivedAt: null,
    ...overrides,
  }
}

const inbox = list('en-mente', { kind: 'inbox', position: 0 })
const casa = list('casa', {
  position: 1000,
  counters: { pending: 4, done: 2, pendingPriceCents: 0 },
})
const trabajo = list('trabajo', {
  position: 2000,
  counters: { pending: 6, done: 3, pendingPriceCents: 0 },
})
const tech = list('tech', {
  position: 3000,
  counters: { pending: 3, done: 0, pendingPriceCents: 0 },
})
const regalos = list('regalos', {
  position: 4000,
  counters: { pending: 1, done: 0, pendingPriceCents: 0 },
})
const libros = list('libros', {
  position: 5000,
  counters: { pending: 1, done: 0, pendingPriceCents: 0 },
})
const all = [inbox, casa, trabajo, tech, regalos, libros].map(listDestination)
const ids = (destinations: Destination[]) => destinations.map((entry) => entry.id)

describe('destinationChips', () => {
  it('«En mente» y las tres más usadas por número de ítems', () => {
    expect(ids(destinationChips(all, { chosenId: inbox.id, originId: undefined }))).toEqual([
      'en-mente',
      'trabajo',
      'casa',
      'tech',
    ])
  })

  it('abierta desde una lista, esa primero y «En mente» segunda', () => {
    expect(ids(destinationChips(all, { chosenId: casa.id, originId: casa.id }))).toEqual([
      'casa',
      'en-mente',
      'trabajo',
      'tech',
    ])
  })

  it('una lista elegida con «···» pasa a ser la primera', () => {
    expect(ids(destinationChips(all, { chosenId: regalos.id, originId: undefined }))).toEqual([
      'regalos',
      'en-mente',
      'trabajo',
      'casa',
    ])
  })

  it('elegir un chip que ya está no reordena', () => {
    expect(ids(destinationChips(all, { chosenId: casa.id, originId: undefined }))).toEqual([
      'en-mente',
      'trabajo',
      'casa',
      'tech',
    ])
  })

  it('con lista por defecto en Perfil, va primera y «En mente» detrás', () => {
    expect(
      ids(
        destinationChips(all, { chosenId: regalos.id, originId: undefined, defaultId: regalos.id }),
      ),
    ).toEqual(['regalos', 'en-mente', 'trabajo', 'casa'])
    // Dentro de otra lista, la de origen sigue delante.
    expect(
      ids(destinationChips(all, { chosenId: casa.id, originId: casa.id, defaultId: regalos.id })),
    ).toEqual(['casa', 'regalos', 'en-mente', 'trabajo'])
  })

  it('«En mente» sale una sola vez si es la lista por defecto o la de origen', () => {
    const chips = ['en-mente', 'trabajo', 'casa', 'tech']
    expect(
      ids(destinationChips(all, { chosenId: inbox.id, originId: undefined, defaultId: inbox.id })),
    ).toEqual(chips)
    expect(ids(destinationChips(all, { chosenId: inbox.id, originId: inbox.id }))).toEqual(chips)
  })

  it('a igual uso, manda el orden de las listas', () => {
    expect(
      ids(
        destinationChips([inbox, regalos, libros].map(listDestination), {
          chosenId: undefined,
          originId: undefined,
        }),
      ),
    ).toEqual(['en-mente', 'regalos', 'libros'])
  })
})

describe('defaultDestination', () => {
  it('la de origen o, si no, «En mente»', () => {
    expect(defaultDestination(all, casa.id)?.id).toBe('casa')
    expect(defaultDestination(all, undefined)?.id).toBe('en-mente')
    expect(defaultDestination(all, 'borrada')?.id).toBe('en-mente')
  })

  it('sin origen, la lista por defecto de Perfil, si sigue ahí', () => {
    expect(defaultDestination(all, undefined, casa.id)?.id).toBe('casa')
    expect(defaultDestination(all, undefined, 'archivada')?.id).toBe('en-mente')
    // Dentro de una lista, manda la de origen.
    expect(defaultDestination(all, 'en-mente', casa.id)?.id).toBe('en-mente')
  })
})

describe('con sublistas (diseño 12, A4)', () => {
  const lisboa = {
    id: 'lisboa',
    listId: 'casa',
    kind: 'sublist',
    parentId: null,
    title: 'Lisboa',
    status: 'in_progress',
    position: 1000,
  } as Item
  const destinations = destinationsOf([inbox, casa, trabajo, tech, regalos, libros], [lisboa])

  it('las sublistas van bajo su lista y no compiten entre las más usadas', () => {
    expect(ids(destinations).slice(0, 3)).toEqual(['en-mente', 'casa', 'lisboa'])
    expect(
      ids(destinationChips(destinations, { chosenId: inbox.id, originId: undefined })),
    ).toEqual(['en-mente', 'trabajo', 'casa', 'tech'])
  })

  it('abierta desde dentro de una sublista, sale elegida y primera', () => {
    expect(defaultDestination(destinations, 'lisboa')?.sublist?.title).toBe('Lisboa')
    expect(ids(destinationChips(destinations, { chosenId: 'lisboa', originId: 'lisboa' }))).toEqual(
      ['lisboa', 'en-mente', 'trabajo', 'casa'],
    )
  })

  it('una sublista hecha ya no es destino', () => {
    const hecha = { ...lisboa, status: 'done' } as Item
    expect(ids(destinationsOf([casa], [hecha]))).toEqual(['casa'])
  })
})

describe('un producto (2.3)', () => {
  const compras = list('compras', {
    kind: 'shopping',
    position: 6000,
    counters: { pending: 2, done: 9, pendingPriceCents: 0 },
  })
  const regalosCompras = list('regalos-compras', {
    kind: 'shopping',
    position: 7000,
    counters: { pending: 1, done: 0, pendingPriceCents: 0 },
  })
  const destinations = [inbox, casa, trabajo, tech, compras, regalosCompras].map(listDestination)

  it('se propone la lista de compras más usada', () => {
    expect(shoppingDestination(destinations)?.id).toBe('compras')
    expect(shoppingDestination([inbox, casa].map(listDestination))).toBeUndefined()
  })

  it('la propuesta sale la primera, aunque ya estuviera entre los chips', () => {
    expect(
      ids(
        destinationChips(destinations, {
          chosenId: 'compras',
          originId: undefined,
          proposedId: 'compras',
        }),
      ),
    ).toEqual(['compras', 'en-mente', 'trabajo', 'casa'])
  })
})
