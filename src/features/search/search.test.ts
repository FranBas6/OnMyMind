import { describe, expect, it } from 'vitest'

import type { Item } from '@/features/items'
import type { List } from '@/features/lists'

import {
  findRanges,
  noteSnippet,
  otherFilterNote,
  resultMeta,
  resultsSummary,
  searchItems,
  searchLists,
  searchTerms,
} from './search'

const now = new Date(2026, 8, 28, 10, 0)

function list(id: string, overrides: Partial<List> = {}): List {
  return {
    id,
    name: id,
    color: 'coral',
    icon: null,
    kind: 'tasks',
    view: 'list',
    position: 2000,
    counters: {
      pending: 0,
      done: 0,
      pendingPriceCents: 0,
      notes: 0,
      kinds: { note: 0, task: 0, shopping: 0, event: 0 },
    },
    archivedAt: null,
    isOwner: true,
    hidden: false,
    ...overrides,
  }
}

function item(id: string, title: string, overrides: Partial<Item> = {}): Item {
  return {
    id,
    listId: 'casa',
    kind: 'task',
    parentId: null,
    chooseOne: false,
    chosenId: null,
    sealed: null,
    title,
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

const inbox = list('inbox', { kind: 'inbox', position: 1000 })
const casa = list('casa', { position: 2000 })
const tech = list('tech', { kind: 'shopping', position: 3000 })
const mudanza = list('mudanza', { position: 500, archivedAt: new Date(2026, 5, 1) })
const lists = [inbox, casa, tech, mudanza]

/** Lo que se resalta, como texto. */
const marked = (text: string, ranges: readonly (readonly [number, number])[]) =>
  ranges.map(([from, to]) => text.slice(from, to))

const found = (outcome: ReturnType<typeof searchItems>) =>
  outcome.sections.map((section) => [
    section.list.id,
    section.results.map((result) => result.item.id),
  ])

describe('searchTerms y findRanges', () => {
  it('ignora acentos y mayúsculas, y resalta sobre el texto original', () => {
    expect(searchTerms('  Café   SEGURO ')).toEqual(['cafe', 'seguro'])
    expect(marked('Comprar café', findRanges('Comprar café', ['cafe']))).toEqual(['café'])
    expect(marked('Seguro del coche', findRanges('Seguro del coche', ['seguro']))).toEqual([
      'Seguro',
    ])
  })

  it('encuentra todas las apariciones y junta las que se solapan', () => {
    expect(findRanges('ana y banana', ['ana'])).toEqual([
      [0, 3],
      [7, 10],
    ])
    expect(findRanges('seguro', ['segur', 'guro'])).toEqual([[0, 6]])
  })

  it('palabras dentro de otras: «segur» encuentra «Seguro» y «asegurar»', () => {
    expect(marked('Asegurar el seguro', findRanges('Asegurar el seguro', ['segur']))).toEqual([
      'segur',
      'segur',
    ])
  })
})

describe('noteSnippet', () => {
  const notes =
    'Antes de que llegue el frío, preguntar si el seguro de hogar cubre la revisión anual de la caldera.'

  it('empieza poco antes de la coincidencia, en una palabra, con «…» delante', () => {
    const snippet = noteSnippet(notes, ['seguro'])
    expect(snippet?.text.startsWith('…preguntar si el seguro')).toBe(true)
    expect(snippet && marked(snippet.text, snippet.ranges)).toEqual(['seguro'])
  })

  it('sin «…» si la coincidencia está al principio, y en una sola línea', () => {
    expect(noteSnippet('Seguro\nde hogar', ['seguro'])?.text).toBe('Seguro de hogar')
  })
})

describe('searchItems', () => {
  const items = [
    item('coche', 'Llamar al seguro del coche', { status: 'in_progress' }),
    item('caldera', 'Revisar la caldera', { notes: 'preguntar si el seguro de hogar cubre' }),
    item('funda', 'Funda con seguro para el portátil', {
      listId: 'tech',
      status: 'bought',
      completedAt: new Date(2026, 8, 2),
    }),
    item('luis', 'Preguntar a Luis qué seguro tiene', { listId: 'inbox' }),
    item('direccion', 'Cambiar la dirección del seguro', {
      listId: 'mudanza',
      status: 'done',
      completedAt: new Date(2026, 5, 3),
    }),
    item('cafe', 'Comprar café'),
  ]

  it('en título y notas; «En mente» primero y las archivadas al final', () => {
    const outcome = searchItems(items, lists, 'seguro', { filter: 'all', now })
    expect(found(outcome)).toEqual([
      ['inbox', ['luis']],
      ['casa', ['coche', 'caldera']],
      ['tech', ['funda']],
      ['mudanza', ['direccion']],
    ])
    expect(outcome.count).toBe(5)
  })

  it('«cafe» encuentra «café»; sin nada escrito no hay resultados', () => {
    expect(found(searchItems(items, lists, 'cafe', { filter: 'all', now }))).toEqual([
      ['casa', ['cafe']],
    ])
    expect(searchItems(items, lists, '   ', { filter: 'all', now }).count).toBe(0)
  })

  it('cada palabra tiene que estar en el título o en las notas', () => {
    expect(found(searchItems(items, lists, 'caldera hogar', { filter: 'all', now }))).toEqual([
      ['casa', ['caldera']],
    ])
    expect(searchItems(items, lists, 'caldera coche', { filter: 'all', now }).count).toBe(0)
  })

  it('el fragmento de la nota solo sale si algo no está en el título', () => {
    const [casaSection] = searchItems(items, lists, 'seguro', {
      filter: 'all',
      now,
    }).sections.filter((section) => section.list.id === 'casa')
    const [coche, caldera] = casaSection?.results ?? []
    expect(coche?.snippet).toBeNull()
    expect(caldera?.snippet?.text).toBe('preguntar si el seguro de hogar cubre')
  })

  it('Pendientes y Hechas, y cuántos hay en el otro filtro', () => {
    const open = searchItems(items, lists, 'seguro', { filter: 'open', now })
    expect(found(open)).toEqual([
      ['inbox', ['luis']],
      ['casa', ['coche', 'caldera']],
    ])
    expect(open.otherCount).toBe(2)
    const done = searchItems(items, lists, 'seguro', { filter: 'done', now })
    expect(found(done)).toEqual([
      ['tech', ['funda']],
      ['mudanza', ['direccion']],
    ])
    expect(done.otherCount).toBe(3)
  })

  it('un recién terminado sigue en Pendientes mientras está en `lingering`', () => {
    const coche = item('coche', 'Llamar al seguro', { status: 'done', completedAt: now })
    const outcome = searchItems([coche], lists, 'seguro', {
      filter: 'open',
      now,
      lingering: new Set(['coche']),
    })
    expect(found(outcome)).toEqual([['casa', ['coche']]])
  })

  it('no salen ítems de listas que no están en caché', () => {
    const lost = item('x', 'Seguro perdido', { listId: 'otra' })
    expect(searchItems([lost], lists, 'seguro', { filter: 'all', now }).count).toBe(0)
  })
})

describe('searchLists', () => {
  const regalos = list('regalos', { name: 'Regalos de Navidad', position: 4000 })
  const casaPlaya = list('playa', { name: 'Casa de la playa', position: 5000 })
  const all = [...lists, regalos, casaPlaya]

  it('por nombre, sin acentos, con todas las palabras y el trozo a resaltar', () => {
    const [match] = searchLists(all, 'navidad')
    expect(match?.list.id).toBe('regalos')
    expect(match && marked(match.list.name, match.ranges)).toEqual(['Navidad'])
    expect(searchLists(all, 'casa playa').map((entry) => entry.list.id)).toEqual(['playa'])
    expect(searchLists(all, '')).toEqual([])
  })

  it('en el orden de las secciones, las archivadas al final, y tres como mucho', () => {
    const many = [
      list('a', { name: 'Ideas uno', position: 3000 }),
      list('b', { name: 'Ideas dos', position: 1000, archivedAt: new Date(2026, 5, 1) }),
      list('c', { name: 'Ideas tres', position: 2000 }),
      list('d', { name: 'Ideas cuatro', position: 4000 }),
    ]
    expect(searchLists(many, 'ideas').map((entry) => entry.list.id)).toEqual(['c', 'a', 'd'])
    expect(searchLists(many.slice(0, 2), 'ideas').map((entry) => entry.list.id)).toEqual(['a', 'b'])
  })
})

describe('textos', () => {
  it('la línea de estado y fecha de cada resultado', () => {
    expect(
      resultMeta(item('a', 'a', { status: 'in_progress', dueAt: new Date(2026, 8, 29) }), now),
    ).toBe('En curso · Mañana')
    expect(resultMeta(item('b', 'b', { dueAt: new Date(2026, 9, 15) }), now)).toBe(
      'Pendiente · 15 oct',
    )
    expect(resultMeta(item('c', 'c'), now)).toBe('Pendiente')
    expect(
      resultMeta(item('d', 'd', { status: 'done', completedAt: new Date(2026, 8, 2) }), now),
    ).toBe('Hecha · 2 sep')
    expect(
      resultMeta(
        item('e', 'e', {
          kind: 'shopping',
          status: 'discarded',
          completedAt: new Date(2026, 7, 12),
        }),
        now,
      ),
    ).toBe('Descartado · 12 ago')
    expect(
      resultMeta(
        item('f', 'f', { listId: 'inbox', kind: 'note', createdAt: new Date(2026, 8, 27, 9) }),
        now,
      ),
    ).toBe('Sin ordenar · ayer')
  })

  it('el contador y la nota del otro filtro', () => {
    expect(resultsSummary(7, 6)).toBe('7 resultados en 6 listas')
    expect(resultsSummary(1, 1)).toBe('1 resultado en 1 lista')
    expect(resultsSummary(1, 1, 2)).toBe('2 listas · 1 resultado en 1 lista')
    expect(resultsSummary(0, 0, 1)).toBe('1 lista')
    expect(otherFilterNote('open', 4)).toBe('Nada pendiente. Hay 4 en Hechas.')
    expect(otherFilterNote('done', 2)).toBe('Nada hecho. Hay 2 en Pendientes.')
    expect(otherFilterNote('all', 3)).toBeNull()
    expect(otherFilterNote('open', 0)).toBeNull()
  })
})

describe('sublistas en Buscar (diseño 12, A2)', () => {
  const viajes = list('viajes', { position: 2500 })
  const lisboa = item('lisboa', 'Lisboa', {
    listId: 'viajes',
    kind: 'sublist',
    status: 'in_progress',
  })
  const vuelo = item('vuelo', 'Vuelo IB3110 a Lisboa', {
    listId: 'viajes',
    parentId: 'lisboa',
    kind: 'event',
    status: 'upcoming',
    dueAt: new Date(2026, 9, 12, 7, 45),
  })
  const tranvia = item('tranvia', 'Tranvía 28', { listId: 'viajes', parentId: 'lisboa' })

  it('la sublista es un resultado con lo de dentro, y lo de dentro trae su sublista', () => {
    const { sections } = searchItems([lisboa, vuelo, tranvia], [...lists, viajes], 'lisboa', {
      filter: 'all',
      now,
    })
    const results = sections[0]?.results ?? []
    expect(results.map((result) => result.item.id)).toEqual(['lisboa', 'vuelo'])
    expect(results[0]?.children.map((child) => child.id)).toEqual(['vuelo', 'tranvia'])
    expect(results[1]?.parent?.id).toBe('lisboa')
  })

  it('la ruta va delante; un evento próximo dice su día y su hora', () => {
    expect(resultMeta(vuelo, now, 'Viajes › Lisboa')).toBe('Viajes › Lisboa · Lun 12 oct · 07:45')
    expect(resultMeta(tranvia, now, 'Viajes › Lisboa')).toBe('Viajes › Lisboa · Pendiente')
  })
})

describe('las notas protegidas en Buscar (5.7)', () => {
  it('salen por su primera línea, nunca por su texto', () => {
    const wifi = item('wifi', 'Wifi de casa', {
      kind: 'note',
      sealed: { sealed: 'dGV4dG8tY2lmcmFkbw==', iv: 'aXYtZGUtMTItYnl0', keyId: 'caja' },
    })
    expect(found(searchItems([wifi], lists, 'wifi', { filter: 'all', now }))).toEqual([
      ['casa', ['wifi']],
    ])
    expect(searchItems([wifi], lists, 'tq8M', { filter: 'all', now }).count).toBe(0)
    expect(searchItems([wifi], lists, 'dGV4', { filter: 'all', now }).count).toBe(0)
  })
})
