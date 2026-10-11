import { type QueryClient } from '@tanstack/react-query'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import * as itemsApi from '@/features/items/api'
import type { Item } from '@/features/items'
import * as listsApi from '@/features/lists/api'
import * as pricesApi from '@/features/prices/api'
import type { List } from '@/features/lists'
import { queryKeys } from '@/lib/queryKeys'
import { fakeSession, renderRoute } from '@/test/render-route'

vi.mock('@/features/items/api')
vi.mock('@/features/lists/api')
vi.mock('@/features/prices/api')

const session = fakeSession()
const DAY = 24 * 60 * 60 * 1000

const ID = {
  volantes: '00000000-0000-4000-8000-00000000000a',
  hoteles: '00000000-0000-4000-8000-00000000000b',
  g29: '00000000-0000-4000-8000-000000000001',
  g923: '00000000-0000-4000-8000-000000000002',
  leche: '00000000-0000-4000-8000-000000000003',
  plaza: '00000000-0000-4000-8000-000000000004',
  bairro: '00000000-0000-4000-8000-000000000005',
}

function list(id: string, name: string, overrides: Partial<List> = {}): List {
  return {
    id,
    name,
    color: 'blue',
    icon: null,
    kind: 'shopping',
    position: 2000,
    counters: { pending: 0, done: 0, pendingPriceCents: 0 },
    archivedAt: null,
    isOwner: true,
    ...overrides,
  }
}

function item(id: string, title: string, overrides: Partial<Item> = {}): Item {
  return {
    id,
    listId: 'compras',
    kind: 'shopping',
    parentId: null,
    chooseOne: false,
    chosenId: null,
    title,
    notes: null,
    status: 'pending',
    priority: null,
    dueAt: null,
    allDay: false,
    recurrence: null,
    position: 1000,
    completedAt: null,
    createdAt: new Date(Date.now() - DAY),
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

const inbox = list('i', 'En mente', { kind: 'inbox', color: 'indigo', position: 1000 })
const compras = list('compras', 'Compras')

// «Volantes» del diseño 24 (A2): el G29 a 199 € y el G923 a 249,99 €, para elegir uno.
const volantes = item(ID.volantes, 'Volantes', { kind: 'sublist', chooseOne: true })
const g29 = item(ID.g29, 'Logitech G29', {
  parentId: ID.volantes,
  priceCents: 19900,
  previousPriceCents: 21900,
  url: 'https://www.amazon.es/logitech-g29',
  urlSite: 'Amazon',
  notes: 'Sin embrague en H. Cabe en el escritorio.',
})
const g923 = item(ID.g923, 'Logitech G923', {
  parentId: ID.volantes,
  priceCents: 24999,
  position: 2000,
  notes: 'Tiene embrague y force feedback mejor.',
})
const leche = item(ID.leche, 'Leche de avena', { priceCents: 249, position: 2000 })
// Dos hoteles (A7): tareas, sin precio.
const hoteles = item(ID.hoteles, 'Hotel en Lisboa', {
  kind: 'sublist',
  chooseOne: true,
  position: 3000,
})
const plaza = item(ID.plaza, 'Hotel Lisboa Plaza', {
  kind: 'task',
  parentId: ID.hoteles,
  url: 'https://www.booking.com/lisboa-plaza',
  notes: 'Junto a la Avenida. Desayuno incluido.',
})
const bairro = item(ID.bairro, 'Casa do Bairro', {
  kind: 'task',
  parentId: ID.hoteles,
  position: 2000,
})

function setDesktop(on: boolean) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn((query: string) => ({
      matches: on && query.includes('min-width: 768px'),
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  })
}

function renderAt(
  path: string,
  items: Item[] = [volantes, g29, g923, leche, hoteles, plaza, bairro],
) {
  let client: QueryClient | undefined
  vi.mocked(listsApi.fetchLists).mockResolvedValue([inbox, compras])
  vi.mocked(listsApi.fetchArchivedLists).mockResolvedValue([])
  // El servidor no contesta: lo que se ve es la caché con los cambios optimistas.
  vi.mocked(itemsApi.fetchItems).mockReturnValue(new Promise(() => undefined))
  vi.mocked(itemsApi.fetchMovedFromInbox).mockResolvedValue([])
  const rendered = renderRoute(path, {
    session,
    seed: (queryClient) => {
      client = queryClient
      queryClient.setQueryData(queryKeys.lists.all, [inbox, compras])
      queryClient.setQueryData(queryKeys.lists.archived, [])
      queryClient.setQueryData(queryKeys.items.byList('compras'), items)
    },
  })
  const cached = () => client?.getQueryData<Item[]>(queryKeys.items.byList('compras')) ?? []
  return { ...rendered, cached }
}

describe('comparar (5.2, diseño 24)', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(pricesApi.fetchPriceHistory).mockResolvedValue([
      {
        cents: 21900,
        currency: 'EUR',
        source: 'web',
        recordedAt: new Date(Date.now() - 9 * DAY),
        store: 'Amazon',
      },
      {
        cents: 18900,
        currency: 'EUR',
        source: 'auto',
        recordedAt: new Date(Date.now() - 5 * DAY),
        store: 'Amazon',
      },
      {
        cents: 19900,
        currency: 'EUR',
        source: 'auto',
        recordedAt: new Date(Date.now() - DAY),
        store: 'Amazon',
      },
    ])
  })
  afterEach(() => {
    setDesktop(false)
  })

  it('en el móvil: «Comparar» abre las tarjetas, con su precio, tienda, notas y enlaces (A5)', async () => {
    const user = userEvent.setup()
    const { router } = renderAt(`/lists/compras/${ID.volantes}`)

    await user.click(await screen.findByRole('button', { name: 'Comparar' }))

    const sheet = await screen.findByRole('dialog', { name: 'Comparar · Volantes' })
    expect(router.state.location.search).toMatchObject({ comparar: true })
    const cards = within(sheet).getAllByRole('article')
    expect(cards.map((card) => card.getAttribute('aria-label'))).toEqual([
      'Logitech G29',
      'Logitech G923',
    ])
    const [first, second] = cards as [HTMLElement, HTMLElement]
    expect(first).toHaveTextContent('Más barata')
    expect(first).toHaveTextContent('Amazon')
    expect(first).toHaveTextContent('Sin embrague en H. Cabe en el escritorio.')
    expect(within(first).getByRole('link', { name: /amazon\.es/ })).toHaveAttribute(
      'href',
      'https://www.amazon.es/logitech-g29',
    )
    expect(await within(first).findByText('Más bajo visto: 189 €')).toBeInTheDocument()
    expect(second).toHaveTextContent('+50,99 €')

    await user.click(within(sheet).getByRole('button', { name: 'Cerrar Comparar' }))
    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'Comparar · Volantes' })).not.toBeInTheDocument()
    })
    expect(router.state.location.search).not.toHaveProperty('comparar', true)
  })

  it('«Elegir esta» desde una tarjeta la marca, como en la 5.1, y la tarjeta dice «Elegida»', async () => {
    const user = userEvent.setup()
    vi.mocked(itemsApi.updateItem).mockResolvedValue()
    renderAt(`/lists/compras/${ID.volantes}?comparar=true`)

    const sheet = await screen.findByRole('dialog', { name: 'Comparar · Volantes' })
    const second = within(sheet).getByRole('article', { name: 'Logitech G923' })
    await user.click(within(second).getByRole('button', { name: 'Elegir esta' }))

    await waitFor(() => {
      expect(itemsApi.updateItem).toHaveBeenCalledWith(ID.volantes, { chosenId: ID.g923 })
    })
    expect(
      await within(second).findByRole('button', { name: 'Elegida', pressed: true }),
    ).toBeInTheDocument()
    expect(itemsApi.updateItemStatus).not.toHaveBeenCalled()
  })

  it('en escritorio, columnas en vez de las filas, con «Comparar» encendido (D2)', async () => {
    setDesktop(true)
    const user = userEvent.setup()
    renderAt(`/lists/compras/${ID.volantes}`)

    await user.click(await screen.findByRole('button', { name: 'Comparar', pressed: false }))

    const region = await screen.findByRole('region', { name: 'Comparar' })
    expect(within(region).getAllByRole('article')).toHaveLength(2)
    expect(region).toHaveTextContent('Las opciones una al lado de otra.')
    expect(screen.getByRole('button', { name: 'Comparar', pressed: true })).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.queryByText('Cuenta en Compras')).not.toBeInTheDocument()
    expect(
      screen.queryByRole('textbox', { name: 'Añadir una opción a Volantes…' }),
    ).not.toBeInTheDocument()
  })

  it('dos hoteles se comparan sin precio (A7b)', async () => {
    renderAt(`/lists/compras/${ID.hoteles}?comparar=true`)

    const sheet = await screen.findByRole('dialog', { name: 'Comparar · Hotel en Lisboa' })
    const plazaCard = within(sheet).getByRole('article', { name: 'Hotel Lisboa Plaza' })
    expect(plazaCard).toHaveTextContent('booking.com')
    expect(plazaCard).toHaveTextContent('Junto a la Avenida.')
    expect(plazaCard).not.toHaveTextContent('€')
    expect(plazaCard).not.toHaveTextContent('Sin precio')
    expect(pricesApi.fetchPriceHistory).not.toHaveBeenCalled()
  })

  it('con una sola opción, «Comparar» se ve en gris y no abre nada (A8b)', async () => {
    renderAt(`/lists/compras/${ID.volantes}?comparar=true`, [volantes, g29, leche])

    expect(await screen.findByRole('button', { name: 'Comparar' })).toBeDisabled()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByText('Añade otra opción para comparar.')).toBeInTheDocument()
  })
})
