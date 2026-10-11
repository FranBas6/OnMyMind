import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import * as itemsApi from '@/features/items/api'
import type { Item } from '@/features/items'
import * as listsApi from '@/features/lists/api'
import * as searchApi from '@/features/search/api'
import * as todayApi from '@/features/today/api'
import type { List } from '@/features/lists'
import { queryKeys } from '@/lib/queryKeys'
import { fakeSession, renderRoute } from '@/test/render-route'

vi.mock('@/features/items/api')
vi.mock('@/features/lists/api')
vi.mock('@/features/today/api')
vi.mock('@/features/search/api')

const session = fakeSession()
const DAY = 24 * 60 * 60 * 1000

const ID = {
  lisboa: '00000000-0000-4000-8000-00000000000a',
  roma: '00000000-0000-4000-8000-00000000000b',
  maleta: '00000000-0000-4000-8000-00000000000c',
  vuelo: '00000000-0000-4000-8000-000000000001',
  tranvia: '00000000-0000-4000-8000-000000000002',
  hotel: '00000000-0000-4000-8000-000000000003',
  coliseo: '00000000-0000-4000-8000-000000000004',
  pasaporte: '00000000-0000-4000-8000-000000000005',
}

function list(id: string, name: string, overrides: Partial<List> = {}): List {
  return {
    id,
    name,
    color: 'blue',
    icon: null,
    kind: 'tasks',
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
    listId: 'viajes',
    kind: 'task',
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
// «Viajes» cuenta 3: el pasaporte y lo pendiente de Lisboa; lo de Roma, pausada, se calla.
const viajes = list('viajes', 'Viajes', { counters: { pending: 3, done: 1, pendingPriceCents: 0 } })
const casa = list('casa', 'Casa', { color: 'coral', position: 3000 })

// «Viajes» del diseño 12 (S1): Lisboa en curso con tres cosas, Roma pausada, Maleta vacía.
const lisboa = item(ID.lisboa, 'Lisboa', { kind: 'sublist', status: 'in_progress' })
const vuelo = item(ID.vuelo, 'Vuelo IB3110 a Lisboa', {
  parentId: ID.lisboa,
  kind: 'event',
  status: 'upcoming',
  dueAt: new Date(Date.now() + 12 * DAY),
  position: 1100,
})
const tranvia = item(ID.tranvia, 'Tranvía 28 al atardecer', { parentId: ID.lisboa, position: 1200 })
const hotel = item(ID.hotel, 'Reservar el hotel', {
  parentId: ID.lisboa,
  status: 'done',
  completedAt: new Date(Date.now() - DAY),
  position: 1300,
})
const roma = item(ID.roma, 'Roma', { kind: 'sublist', status: 'paused', position: 2000 })
const coliseo = item(ID.coliseo, 'Coliseo', { parentId: ID.roma, position: 2100 })
const maleta = item(ID.maleta, 'Maleta', { kind: 'sublist', position: 3000 })
const pasaporte = item(ID.pasaporte, 'Renovar el pasaporte', { position: 4000 })

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

// Una tarea de hoy dentro de Lisboa (en curso) y otra dentro de Roma (pausada).
const hoy = new Date()
hoy.setHours(0, 0, 0, 0)
const tranviaHoy = { ...tranvia, dueAt: hoy, allDay: true }
const coliseoHoy = { ...coliseo, dueAt: hoy, allDay: true }
const items = [lisboa, vuelo, tranviaHoy, hotel, roma, coliseoHoy, maleta, pasaporte]

function renderAt(path: string) {
  vi.mocked(listsApi.fetchLists).mockResolvedValue([inbox, viajes, casa])
  vi.mocked(listsApi.fetchArchivedLists).mockResolvedValue([])
  vi.mocked(listsApi.fetchRecentCaptures).mockResolvedValue([])
  vi.mocked(itemsApi.fetchItems).mockReturnValue(new Promise(() => undefined))
  vi.mocked(itemsApi.fetchMovedFromInbox).mockResolvedValue([])
  vi.mocked(itemsApi.fetchSublists).mockResolvedValue([lisboa, roma, maleta])
  vi.mocked(todayApi.fetchToday).mockResolvedValue([
    { ...tranviaHoy, parent: { status: 'in_progress', title: 'Lisboa' } },
    { ...coliseoHoy, parent: { status: 'paused', title: 'Roma' } },
  ])
  vi.mocked(searchApi.fetchAllItems).mockResolvedValue(items)
  return renderRoute(path, {
    session,
    seed: (queryClient) => {
      queryClient.setQueryData(queryKeys.lists.all, [inbox, viajes, casa])
      queryClient.setQueryData(queryKeys.lists.archived, [])
      queryClient.setQueryData(queryKeys.items.byList('viajes'), items)
      queryClient.setQueryData(queryKeys.items.byList('casa'), [])
    },
  })
}

const rows = () => within(screen.getByRole('list', { name: 'Ítems' })).getAllByRole('listitem')

describe('sublistas por toda la app (diseño 12)', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })
  afterEach(() => {
    setDesktop(false)
  })

  it('Hoy enseña la ruta y dice qué calla una sublista pausada', async () => {
    renderAt('/today')

    const row = (await screen.findByText('Tranvía 28 al atardecer')).closest('li')
    expect(row).toHaveTextContent('Viajes › Lisboa · Vence hoy')
    expect(screen.queryByText('Coliseo')).not.toBeInTheDocument()
    expect(screen.getByText('Lo de «Roma» no sale: la sublista está pausada.')).toBeInTheDocument()
  })

  it('Buscar encuentra la sublista y lo de dentro con su ruta; tocarla entra en ella', async () => {
    const user = userEvent.setup()
    const { router } = renderAt('/search?q=lisboa')

    const sublist = await screen.findByText('Sublista · 2 pendientes · En curso')
    expect(screen.getByText(/Viajes › Lisboa · /)).toBeInTheDocument()
    await user.click(
      within(sublist.closest('li') ?? document.body).getByRole('button', { name: 'Lisboa' }),
    )

    await waitFor(() => {
      expect(router.state.location.pathname).toBe(`/lists/viajes/${ID.lisboa}`)
    })
  })

  it('la captura abierta dentro de Lisboa la trae elegida y guarda dentro', async () => {
    setDesktop(true)
    const user = userEvent.setup()
    vi.mocked(itemsApi.createItem).mockResolvedValue()
    renderAt(`/lists/viajes/${ID.lisboa}`)

    await user.click(await screen.findByRole('button', { name: /Qué tienes en mente/ }))
    const dialog = await screen.findByRole('dialog', { name: 'Captura rápida' })
    expect(within(dialog).getByText('Captura rápida · desde Lisboa')).toBeInTheDocument()
    expect(within(dialog).getByRole('radio', { name: 'Viajes › Lisboa' })).toHaveAttribute(
      'aria-checked',
      'true',
    )
    await user.type(
      within(dialog).getByRole('textbox', { name: '¿Qué tienes en mente?' }),
      'Comprar el adaptador{Meta>}{Enter}{/Meta}',
    )

    await waitFor(() => {
      expect(itemsApi.createItem).toHaveBeenCalledWith(
        expect.objectContaining({
          listId: 'viajes',
          parentId: ID.lisboa,
          title: 'Comprar el adaptador',
          kind: 'task',
        }),
      )
    })
    expect(await screen.findByText('Guardado en Lisboa')).toBeInTheDocument()
  })

  it('en móvil, «···» abre «Guardar en» con buscador y las sublistas bajo su lista', async () => {
    const user = userEvent.setup()
    vi.mocked(itemsApi.createItem).mockResolvedValue()
    renderAt('/')

    await user.click(await screen.findByRole('button', { name: 'Captura rápida' }))
    const dialog = await screen.findByRole('dialog', { name: 'Captura rápida' })
    await user.type(
      within(dialog).getByRole('textbox', { name: '¿Qué tienes en mente?' }),
      'Cargador del móvil',
    )
    await user.click(within(dialog).getByRole('button', { name: 'Otra lista' }))

    expect(within(dialog).getByText('Guardar en')).toBeInTheDocument()
    const all = within(dialog).getByRole('list', { name: 'Todas las listas' })
    expect(
      within(all)
        .getAllByRole('button')
        .map((option) => option.textContent),
    ).toEqual([
      'En menteSin tipo hasta que lo ordenes',
      'VViajes',
      'Viajes › Lisboa',
      'Viajes › RomaPausada',
      'Viajes › Maleta',
      'CCasa',
    ])
    await user.type(
      within(dialog).getByRole('textbox', { name: 'Buscar lista o sublista' }),
      'male',
    )
    await user.click(within(all).getByRole('button', { name: /Maleta/ }))

    expect(within(dialog).getByRole('radio', { name: 'Viajes › Maleta' })).toHaveAttribute(
      'aria-checked',
      'true',
    )
    await user.click(within(dialog).getByRole('button', { name: 'Guardar' }))
    await waitFor(() => {
      expect(itemsApi.createItem).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Cargador del móvil', parentId: ID.maleta }),
      )
    })
  })

  it('«Sacar de Lisboa» lo deja suelto en Viajes', async () => {
    setDesktop(true)
    const user = userEvent.setup()
    vi.mocked(itemsApi.moveItem).mockReturnValue(new Promise(() => undefined))
    renderAt(`/lists/viajes/${ID.lisboa}`)

    await user.click(
      await screen.findByRole('button', { name: 'Opciones de «Tranvía 28 al atardecer»' }),
    )
    await user.click(await screen.findByRole('menuitem', { name: /Mover a…/ }))
    const popover = await screen.findByRole('dialog', { name: 'Mover a…' })
    expect(within(popover).getByRole('button', { name: /Viajes ›\s?Lisboa/ })).toBeDisabled()
    await user.click(within(popover).getByRole('button', { name: /Sacar de Lisboa/ }))

    expect(itemsApi.moveItem).toHaveBeenCalledWith(
      ID.tranvia,
      expect.objectContaining({ listId: 'viajes', parentId: null }),
    )
    await waitFor(() => {
      expect(screen.queryByText('Tranvía 28 al atardecer')).not.toBeInTheDocument()
    })
  })

  it('mover algo suelto a una sublista lo mete dentro', async () => {
    setDesktop(true)
    const user = userEvent.setup()
    vi.mocked(itemsApi.moveItem).mockReturnValue(new Promise(() => undefined))
    renderAt('/lists/viajes')

    await user.click(
      await screen.findByRole('button', { name: 'Opciones de «Renovar el pasaporte»' }),
    )
    await user.click(await screen.findByRole('menuitem', { name: /Mover a…/ }))
    const popover = await screen.findByRole('dialog', { name: 'Mover a…' })
    // Lo pausado sigue siendo destino, atenuado; «En mente» también.
    expect(within(popover).getByRole('button', { name: /Viajes ›\s?Roma/ })).toHaveTextContent(
      'Pausada',
    )
    await user.click(within(popover).getByRole('button', { name: /Viajes ›\s?Maleta/ }))

    expect(itemsApi.moveItem).toHaveBeenCalledWith(
      ID.pasaporte,
      expect.objectContaining({ listId: 'viajes', parentId: ID.maleta }),
    )
    await waitFor(() => {
      expect(rows()).toHaveLength(3)
    })
    expect(rows().find((row) => row.textContent.includes('Maleta'))).toHaveTextContent(
      '1 pendiente',
    )
  })

  it('una sublista no se mueve a «En mente» ni dentro de otra', async () => {
    setDesktop(true)
    const user = userEvent.setup()
    renderAt('/lists/viajes')

    await user.click(await screen.findByRole('button', { name: 'Opciones de «Maleta»' }))
    await user.click(await screen.findByRole('menuitem', { name: /Mover a…/ }))
    const popover = await screen.findByRole('dialog', { name: 'Mover a…' })
    expect(
      within(popover)
        .getAllByRole('button')
        .map((option) => option.textContent),
    ).toEqual([expect.stringContaining('Viajes'), expect.stringContaining('Casa')])
  })
})
