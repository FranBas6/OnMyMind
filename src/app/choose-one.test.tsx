import { type QueryClient } from '@tanstack/react-query'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import * as itemsApi from '@/features/items/api'
import type { Item } from '@/features/items'
import * as listsApi from '@/features/lists/api'
import type { List } from '@/features/lists'
import { queryKeys } from '@/lib/queryKeys'
import { fakeSession, renderRoute } from '@/test/render-route'

vi.mock('@/features/items/api')
vi.mock('@/features/lists/api')

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
    listId: 'compras',
    kind: 'shopping',
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
const g29 = item(ID.g29, 'Logitech G29', { parentId: ID.volantes, priceCents: 19900 })
const g923 = item(ID.g923, 'Logitech G923', {
  parentId: ID.volantes,
  priceCents: 24999,
  position: 2000,
})
const leche = item(ID.leche, 'Leche de avena', { priceCents: 249, position: 2000 })
// Dos hoteles (A7): tareas, sin precio.
const hoteles = item(ID.hoteles, 'Hotel en Lisboa', {
  kind: 'sublist',
  chooseOne: true,
  position: 3000,
})
const plaza = item(ID.plaza, 'Hotel Lisboa Plaza', { kind: 'task', parentId: ID.hoteles })
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

const rows = (name = 'Ítems') => within(screen.getByRole('list', { name })).getAllByRole('listitem')
const rowOf = (title: string, name?: string) =>
  rows(name).find((row) => row.textContent.includes(title)) ?? document.body

describe('elegir una (5.1, diseño 24)', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })
  afterEach(() => {
    setDesktop(false)
  })

  it('en Compras, Volantes dice sus opciones y cuenta solo la más barata (A3)', async () => {
    renderAt('/lists/compras')

    const row = await waitFor(() => rowOf('Volantes'))
    expect(row).toHaveTextContent(`2 opciones · desde 199 €`)
    expect(row).toHaveTextContent(`199 €`)
    expect(rowOf('Hotel en Lisboa')).toHaveTextContent('2 opciones')
    // 199 € del G29 y 2,49 € de la leche, no los 448,99 € de los dos volantes.
    expect(screen.getByText(`201,49 €`)).toBeInTheDocument()
  })

  it('dentro, «Cuenta en Compras», «Más barata» y cuánto más cuesta la otra (A2)', async () => {
    renderAt(`/lists/compras/${ID.volantes}`)

    expect(await screen.findByText(`2 opciones · desde 199 €`)).toBeInTheDocument()
    expect(screen.getByText('Cuenta en Compras')).toBeInTheDocument()
    expect(rowOf('Logitech G29')).toHaveTextContent('Más barata')
    expect(rowOf('Logitech G923')).toHaveTextContent(`+50,99 €`)
    expect(screen.getByRole('textbox', { name: 'Añadir una opción a Volantes…' })).toBeVisible()
    expect(screen.queryByRole('radiogroup', { name: 'Filtrar por estado' })).not.toBeInTheDocument()
  })

  it('«Elegir esta» marca el G923 sin comprarlo: cuenta lo suyo, y «Deshacer» vuelve atrás', async () => {
    setDesktop(true)
    const user = userEvent.setup()
    vi.mocked(itemsApi.updateItem).mockResolvedValue()
    const { cached } = renderAt(`/lists/compras/${ID.volantes}`)

    await user.click(await screen.findByRole('button', { name: 'Opciones de «Logitech G923»' }))
    await user.click(await screen.findByRole('menuitem', { name: /Elegir esta/ }))

    await waitFor(() => {
      expect(itemsApi.updateItem).toHaveBeenCalledWith(ID.volantes, { chosenId: ID.g923 })
    })
    expect(itemsApi.updateItemStatus).not.toHaveBeenCalled()
    expect(await screen.findByText('2 opciones · elegida Logitech G923')).toBeInTheDocument()
    expect(rowOf('Logitech G923')).toHaveTextContent('Elegida')
    expect(rowOf('Logitech G29')).toHaveTextContent('Más barata')
    // Cuenta la elegida, aunque no sea la más barata.
    expect(screen.getByText('Cuenta en Compras').parentElement).toHaveTextContent('249,99 €')
    expect(cached().find((entry) => entry.id === ID.g923)).toMatchObject({ status: 'pending' })

    await user.click(screen.getByRole('button', { name: 'Deshacer' }))
    await waitFor(() => {
      expect(itemsApi.updateItem).toHaveBeenLastCalledWith(ID.volantes, { chosenId: null })
    })
    expect(await screen.findByText('2 opciones · desde 199 €')).toBeInTheDocument()
  })

  it('en la elegida, «Quitar elección»', async () => {
    setDesktop(true)
    const user = userEvent.setup()
    vi.mocked(itemsApi.updateItem).mockResolvedValue()
    renderAt(`/lists/compras/${ID.volantes}`, [
      { ...volantes, chosenId: ID.g923 },
      g29,
      g923,
      leche,
    ])

    await user.click(await screen.findByRole('button', { name: 'Opciones de «Logitech G923»' }))
    await user.click(await screen.findByRole('menuitem', { name: /Quitar elección/ }))

    await waitFor(() => {
      expect(itemsApi.updateItem).toHaveBeenCalledWith(ID.volantes, { chosenId: null })
    })
    expect(await screen.findByText('Elección quitada')).toBeInTheDocument()
  })

  it('comprar una opción va como siempre: no toca las demás ni la sublista', async () => {
    const user = userEvent.setup()
    vi.mocked(itemsApi.updateItemStatus).mockResolvedValue()
    const { cached } = renderAt(`/lists/compras/${ID.volantes}`)

    await user.click(await screen.findByRole('checkbox', { name: 'Logitech G923' }))

    await waitFor(() => {
      expect(itemsApi.updateItemStatus).toHaveBeenCalledWith(ID.g923, 'bought')
    })
    expect(itemsApi.updateItemStatus).toHaveBeenCalledTimes(1)
    expect(cached().find((entry) => entry.id === ID.volantes)).toMatchObject({ status: 'pending' })
    expect(cached().find((entry) => entry.id === ID.g29)).toMatchObject({ status: 'pending' })
  })

  it('dos hoteles: «Elegir esta» marca uno, sin precio y sin tocar su estado', async () => {
    setDesktop(true)
    const user = userEvent.setup()
    vi.mocked(itemsApi.updateItem).mockResolvedValue()
    renderAt(`/lists/compras/${ID.hoteles}`)

    expect(await screen.findByText('2 opciones')).toBeInTheDocument()
    expect(screen.queryByText('Cuenta en Compras')).not.toBeInTheDocument()
    await user.click(await screen.findByRole('button', { name: 'Opciones de «Casa do Bairro»' }))
    await user.click(await screen.findByRole('menuitem', { name: /Elegir esta/ }))

    expect(await screen.findByText('2 opciones · elegida Casa do Bairro')).toBeInTheDocument()
    expect(rowOf('Casa do Bairro')).toHaveTextContent('Elegida')
    expect(itemsApi.updateItemStatus).not.toHaveBeenCalled()
  })

  it('«Elegir una» en el menú de una sublista, y «Dejar de elegir una» (A1)', async () => {
    setDesktop(true)
    const user = userEvent.setup()
    vi.mocked(itemsApi.updateItem).mockResolvedValue()
    const normal = { ...volantes, chooseOne: false }
    renderAt('/lists/compras', [normal, g29, g923, leche])

    expect(await waitFor(() => rowOf('Volantes'))).toHaveTextContent('2 pendientes')
    await user.click(screen.getByRole('button', { name: 'Opciones de «Volantes»' }))
    await user.click(await screen.findByRole('menuitem', { name: /^Elegir una/ }))

    await waitFor(() => {
      expect(itemsApi.updateItem).toHaveBeenCalledWith(ID.volantes, { chooseOne: true })
    })
    expect(rowOf('Volantes')).toHaveTextContent(`2 opciones · desde 199 €`)

    await user.click(screen.getByRole('button', { name: 'Opciones de «Volantes»' }))
    await user.click(await screen.findByRole('menuitem', { name: /Dejar de elegir una/ }))
    await waitFor(() => {
      expect(itemsApi.updateItem).toHaveBeenCalledWith(ID.volantes, { chooseOne: false })
    })
  })
})
