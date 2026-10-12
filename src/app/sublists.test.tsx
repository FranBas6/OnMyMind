import { onlineManager, type QueryClient } from '@tanstack/react-query'
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
    view: 'list',
    position: 2000,
    counters: {
      pending: 0,
      done: 0,
      pendingPriceCents: 0,
      notes: 0,
      // Una lista con tareas propone tarea (5.4: vacía propondría nota).
      kinds: { note: 0, task: 3, shopping: 0, event: 0 },
    },
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
const viajes = list('viajes', 'Viajes', {
  counters: {
    pending: 3,
    done: 1,
    pendingPriceCents: 0,
    notes: 0,
    kinds: { note: 0, task: 3, shopping: 0, event: 0 },
  },
})
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

const viajesItems = [lisboa, vuelo, tranvia, hotel, roma, coliseo, maleta, pasaporte]

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

function renderAt(path: string) {
  let client: QueryClient | undefined
  vi.mocked(listsApi.fetchLists).mockResolvedValue([inbox, viajes, casa])
  vi.mocked(listsApi.fetchArchivedLists).mockResolvedValue([])
  // El servidor no contesta: lo que se ve es la caché con los cambios optimistas.
  vi.mocked(itemsApi.fetchItems).mockReturnValue(new Promise(() => undefined))
  vi.mocked(itemsApi.fetchMovedFromInbox).mockResolvedValue([])
  const rendered = renderRoute(path, {
    session,
    seed: (queryClient) => {
      client = queryClient
      queryClient.setQueryData(queryKeys.lists.all, [inbox, viajes, casa])
      queryClient.setQueryData(queryKeys.lists.archived, [])
      queryClient.setQueryData(queryKeys.items.byList('viajes'), viajesItems)
      queryClient.setQueryData(queryKeys.items.byList('casa'), [])
    },
  })
  const counters = () =>
    client?.getQueryData<List[]>(queryKeys.lists.all)?.find((entry) => entry.id === 'viajes')
      ?.counters
  return { ...rendered, counters }
}

const rows = () => within(screen.getByRole('list', { name: 'Ítems' })).getAllByRole('listitem')
const rowOf = (name: string) =>
  rows().find((row) => within(row).queryByRole('button', { name })) ?? document.body

describe('sublistas en pantalla (diseño 12)', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })
  afterEach(() => {
    setDesktop(false)
    onlineManager.setOnline(true)
  })

  it('«Nueva sublista», del menú de la lista, deja el campo listo para una sublista', async () => {
    setDesktop(true)
    const user = userEvent.setup()
    renderAt('/lists/viajes')

    await user.click(await screen.findByRole('button', { name: 'Opciones de «Viajes»' }))
    await user.click(await screen.findByRole('menuitem', { name: 'Nueva sublista' }))

    expect(await screen.findByRole('button', { name: 'Tipo: Sublista. Cambiar' })).toBeVisible()
    await waitFor(() => {
      expect(screen.getByRole('textbox', { name: 'Añadir a Viajes…' })).toHaveFocus()
    })
  })

  it('sin conexión, lo que se crea dentro de una sublista se ve y se envía al volver', async () => {
    const user = userEvent.setup()
    vi.mocked(itemsApi.createItem).mockResolvedValue()
    renderAt(`/lists/viajes/${ID.lisboa}`)

    const field = await screen.findByRole('textbox', { name: 'Añadir a Lisboa…' })
    onlineManager.setOnline(false)
    await user.type(field, 'Pastéis de Belém{Enter}')

    expect(await screen.findByText('Pastéis de Belém')).toBeInTheDocument()
    expect(itemsApi.createItem).not.toHaveBeenCalled()
    onlineManager.setOnline(true)
    await waitFor(() => {
      expect(itemsApi.createItem).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Pastéis de Belém', parentId: ID.lisboa }),
      )
    })
  })

  it('la lista enseña sus sublistas con lo suyo, y lo de dentro no sale suelto', async () => {
    renderAt('/lists/viajes')

    expect(await screen.findByRole('heading', { level: 1, name: 'Viajes' })).toBeInTheDocument()
    // Con un evento, los contadores de la agenda (diseño 25, B10).
    expect(screen.getByText('1 próximo · 2 pendientes · 3 sublistas')).toBeInTheDocument()
    expect(rows()).toHaveLength(4)
    expect(rowOf('Lisboa')).toHaveTextContent('2 pendientes · En curso')
    expect(rowOf('Roma')).toHaveTextContent('1 pendiente · Pausada')
    expect(rowOf('Maleta')).toHaveTextContent('Vacía')
    expect(screen.queryByText('Tranvía 28 al atardecer')).not.toBeInTheDocument()
  })

  it('tocar una sublista entra en ella; dentro se añade y «‹ Viajes» vuelve', async () => {
    const user = userEvent.setup()
    vi.mocked(itemsApi.createItem).mockResolvedValue()
    const { router } = renderAt('/lists/viajes')

    await user.click(await screen.findByRole('button', { name: 'Lisboa' }))

    expect(router.state.location.pathname).toBe(`/lists/viajes/${ID.lisboa}`)
    expect(await screen.findByRole('textbox', { name: 'Nombre de la sublista' })).toHaveValue(
      'Lisboa',
    )
    expect(screen.getByText('2 pendientes · 1 hecha · En curso')).toBeInTheDocument()
    expect(rows().map((row) => row.textContent)).toEqual([
      expect.stringContaining('Vuelo IB3110 a Lisboa'),
      expect.stringContaining('Tranvía 28 al atardecer'),
    ])
    expect(screen.getByRole('region', { name: 'Fuera de la cabeza' })).toHaveTextContent(
      'Reservar el hotel',
    )

    await user.type(screen.getByRole('textbox', { name: 'Añadir a Lisboa…' }), 'Guía{Enter}')
    await waitFor(() => {
      expect(itemsApi.createItem).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Guía', parentId: ID.lisboa, kind: 'task' }),
      )
    })
    expect(await screen.findByText('3 pendientes · 1 hecha · En curso')).toBeInTheDocument()

    await user.click(screen.getByRole('link', { name: 'Viajes' }))
    expect(router.state.location.pathname).toBe('/lists/viajes')
  })

  it('crear una sublista desde el + entra en ella, vacía', async () => {
    const user = userEvent.setup()
    vi.mocked(itemsApi.createItem).mockResolvedValue()
    const { router } = renderAt('/lists/viajes')

    await user.click(await screen.findByRole('button', { name: 'Tipo: Tarea. Cambiar' }))
    const picker = await screen.findByRole('radiogroup', { name: 'Tipo' })
    await user.click(within(picker).getByRole('radio', { name: /Sublista/ }))
    await user.type(screen.getByRole('textbox', { name: 'Añadir a Viajes…' }), 'Oporto{Enter}')

    expect(await screen.findByText('Aún no hay nada en Oporto.')).toBeInTheDocument()
    expect(screen.getByText('Sublista de Viajes')).toBeInTheDocument()
    expect(router.state.location.pathname).toMatch(/^\/lists\/viajes\/[0-9a-f-]{36}$/)
    expect(itemsApi.createItem).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Oporto', kind: 'sublist', status: 'pending' }),
    )
    // Dentro de una sublista no hay otra: el selector no la ofrece.
    await user.click(screen.getByRole('button', { name: 'Tipo: Tarea. Cambiar' }))
    const inside = await screen.findByRole('radiogroup', { name: 'Tipo' })
    expect(within(inside).queryByRole('radio', { name: /Sublista/ })).not.toBeInTheDocument()
  })

  it('pausar Lisboa calla lo de dentro en el contador; reanudarla lo devuelve', async () => {
    setDesktop(true)
    const user = userEvent.setup()
    // La primera respuesta espera: al contestar se vuelven a pedir las listas y el contador
    // pasaría a ser el del servidor (el de la prueba no cambia).
    let answer: () => void = () => undefined
    vi.mocked(itemsApi.updateItemStatus)
      .mockReturnValueOnce(
        new Promise((resolve) => {
          answer = resolve
        }),
      )
      .mockResolvedValue()
    const { counters } = renderAt('/lists/viajes')

    await user.click(await screen.findByRole('button', { name: 'Opciones de «Lisboa»' }))
    await user.click(await screen.findByRole('menuitem', { name: /Pausar/ }))

    expect(itemsApi.updateItemStatus).toHaveBeenCalledWith(ID.lisboa, 'paused')
    await waitFor(() => {
      expect(counters()).toMatchObject({ pending: 1, done: 0 })
    })
    expect(screen.getByText('1 pendiente · 3 sublistas')).toBeInTheDocument()
    expect(rowOf('Lisboa')).toHaveTextContent('2 pendientes · Pausada')
    answer()

    await user.click(screen.getByRole('button', { name: 'Opciones de «Lisboa»' }))
    await user.click(await screen.findByRole('menuitem', { name: /Reanudar/ }))
    expect(itemsApi.updateItemStatus).toHaveBeenLastCalledWith(ID.lisboa, 'in_progress')
    await waitFor(() => {
      expect(counters()).toMatchObject({ pending: 3, done: 1 })
    })
  })

  it('borrar Lisboa pide confirmación con el recuento y «Deshacer» lo devuelve todo', async () => {
    setDesktop(true)
    const user = userEvent.setup()
    vi.mocked(itemsApi.deleteItem).mockResolvedValue()
    vi.mocked(itemsApi.insertItems).mockResolvedValue()
    renderAt('/lists/viajes')

    await user.click(await screen.findByRole('button', { name: 'Opciones de «Lisboa»' }))
    await user.click(await screen.findByRole('menuitem', { name: /Borrar/ }))

    const dialog = await screen.findByRole('alertdialog', { name: '¿Borrar «Lisboa»?' })
    expect(dialog).toHaveTextContent(
      'Se borran también las 3 cosas de dentro, 1 de ellas ya hecha. Tendrás cinco segundos para deshacer.',
    )
    await user.click(within(dialog).getByRole('button', { name: 'Borrar sublista y 3 cosas' }))

    expect(itemsApi.deleteItem).toHaveBeenCalledWith(ID.lisboa)
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'Lisboa' })).not.toBeInTheDocument()
    })
    await user.click(await screen.findByRole('button', { name: 'Deshacer' }))
    await waitFor(() => {
      expect(vi.mocked(itemsApi.insertItems).mock.lastCall?.[0].map((entry) => entry.id)).toEqual(
        [lisboa, vuelo, tranvia, hotel].map((entry) => entry.id),
      )
    })
    expect(await screen.findByRole('button', { name: 'Lisboa' })).toBeInTheDocument()
  })

  it('una sublista vacía se borra sin preguntar', async () => {
    setDesktop(true)
    const user = userEvent.setup()
    vi.mocked(itemsApi.deleteItem).mockResolvedValue()
    renderAt('/lists/viajes')

    await user.click(await screen.findByRole('button', { name: 'Opciones de «Maleta»' }))
    await user.click(await screen.findByRole('menuitem', { name: /Borrar/ }))

    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(itemsApi.deleteItem).toHaveBeenCalledWith(ID.maleta)
  })

  it('duplicar copia la sublista y lo de dentro, pendiente, justo debajo', async () => {
    setDesktop(true)
    const user = userEvent.setup()
    vi.mocked(itemsApi.insertItems).mockResolvedValue()
    renderAt('/lists/viajes')

    await user.click(await screen.findByRole('button', { name: 'Opciones de «Lisboa»' }))
    await user.click(await screen.findByRole('menuitem', { name: /Duplicar/ }))

    expect(await screen.findByText('Duplicada como «Lisboa (copia)»')).toBeInTheDocument()
    const inserted = vi.mocked(itemsApi.insertItems).mock.lastCall?.[0] ?? []
    expect(inserted.map((entry) => [entry.title, entry.status])).toEqual([
      ['Lisboa (copia)', 'pending'],
      ['Vuelo IB3110 a Lisboa', 'upcoming'],
      ['Tranvía 28 al atardecer', 'pending'],
      ['Reservar el hotel', 'pending'],
    ])
    expect(rows().map((row) => within(row).getAllByRole('button')[0]?.textContent)).toEqual([
      'Lisboa',
      'Lisboa (copia)',
      'Roma',
      'Maleta',
      'Renovar el pasaporte',
    ])
  })

  it('mover Lisboa a Casa se la lleva con lo de dentro; «En mente» no es destino', async () => {
    setDesktop(true)
    const user = userEvent.setup()
    vi.mocked(itemsApi.moveItem).mockReturnValue(new Promise(() => undefined))
    renderAt('/lists/viajes')

    await user.click(await screen.findByRole('button', { name: 'Opciones de «Lisboa»' }))
    await user.click(await screen.findByRole('menuitem', { name: /Mover a…/ }))
    const popover = await screen.findByRole('dialog', { name: 'Mover a…' })
    expect(within(popover).queryByRole('button', { name: /En mente/ })).not.toBeInTheDocument()
    await user.hover(within(popover).getByRole('button', { name: /Casa/ }))
    expect(within(popover).getByText('Se va con las 3 cosas de dentro.')).toBeInTheDocument()
    await user.click(within(popover).getByRole('button', { name: /Casa/ }))

    expect(itemsApi.moveItem).toHaveBeenCalledWith(
      ID.lisboa,
      expect.objectContaining({ listId: 'casa', kind: 'sublist' }),
    )
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'Lisboa' })).not.toBeInTheDocument()
    })
    expect(screen.getByText('1 pendiente · 2 sublistas')).toBeInTheDocument()
  })

  it('«Renombrar» entra en la sublista con el nombre listo para cambiarlo', async () => {
    setDesktop(true)
    const user = userEvent.setup()
    vi.mocked(itemsApi.updateItem).mockResolvedValue()
    const { router } = renderAt('/lists/viajes')

    await user.click(await screen.findByRole('button', { name: 'Opciones de «Roma»' }))
    await user.click(await screen.findByRole('menuitem', { name: /Renombrar/ }))

    expect(router.state.location.pathname).toBe(`/lists/viajes/${ID.roma}`)
    const name = await screen.findByRole('textbox', { name: 'Nombre de la sublista' })
    await waitFor(() => {
      expect(name).toHaveFocus()
    })
    await user.keyboard('Roma 2027{Enter}')
    await waitFor(() => {
      expect(itemsApi.updateItem).toHaveBeenCalledWith(ID.roma, { title: 'Roma 2027' })
    })
  })

  it('una sublista que ya no está (borrada, movida) vuelve a su lista', async () => {
    const { router } = renderAt('/lists/viajes/00000000-0000-4000-8000-0000000000ff')

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/lists/viajes')
    })
  })
})
