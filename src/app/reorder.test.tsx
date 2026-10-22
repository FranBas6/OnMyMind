import { act, fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import * as itemsApi from '@/features/items/api'
import type { Item } from '@/features/items'
import * as listsApi from '@/features/lists/api'
import type { List } from '@/features/lists'
import * as profileApi from '@/features/profile/api'
import { parseSettings } from '@/features/profile'
import { queryKeys } from '@/lib/queryKeys'
import { fakeSession, renderRoute, testProfile } from '@/test/render-route'

vi.mock('@/features/items/api')
vi.mock('@/features/lists/api')
vi.mock('@/features/profile/api')

const session = fakeSession()
const HOUR = 60 * 60 * 1000

function list(id: string, name: string, overrides: Partial<List> = {}): List {
  return {
    id,
    name,
    color: 'coral',
    icon: null,
    kind: 'tasks',
    view: 'list',
    position: 2000,
    counters: {
      pending: 3,
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
    createdAt: new Date(Date.now() - 2 * HOUR),
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
    files: [],
    priceLinkId: null,
    priceStore: null,
    priceTracking: null,
    createdBy: null,
    completedBy: null,
    ...overrides,
  }
}

const inbox = list('i', 'En mente', { kind: 'inbox', color: 'indigo', position: 1000 })
const casa = list('casa', 'Casa')
const agenda = list('agenda', 'Agenda', { kind: 'events', view: 'agenda', position: 3000 })

const grifo = item('grifo', 'Arreglar el grifo', { position: 1000 })
const lampara = item('lampara', 'Lámpara para el salón', { position: 2000 })
const seguro = item('seguro', 'Llamar al seguro', { position: 3000 })
const hecha = item('hecha', 'Sacar la basura', {
  status: 'done',
  position: 2500,
  completedAt: new Date(Date.now() - HOUR),
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

let savedSettings = parseSettings({})

function renderDetail(listId: string, items: Item[]) {
  vi.mocked(listsApi.fetchLists).mockResolvedValue([inbox, casa, agenda])
  vi.mocked(listsApi.fetchArchivedLists).mockResolvedValue([])
  // Lo que se guarda, se queda: al volver a pedir, el servidor ya lo tiene.
  let server = items
  vi.mocked(itemsApi.fetchItems).mockImplementation(() => Promise.resolve(server))
  vi.mocked(itemsApi.updateItemPositions).mockImplementation((changes) => {
    const byId = new Map(changes.map((change) => [change.id, change.position]))
    server = server.map((entry) => ({ ...entry, position: byId.get(entry.id) ?? entry.position }))
    return Promise.resolve()
  })
  vi.mocked(profileApi.fetchProfile).mockImplementation(() =>
    Promise.resolve({ ...testProfile(session.user.id), settings: savedSettings }),
  )
  vi.mocked(profileApi.updateSettings).mockImplementation((_id, patch) => {
    savedSettings = { ...savedSettings, ...(patch.inboxSort && { inboxSort: patch.inboxSort }) }
    return Promise.resolve()
  })
  return renderRoute(`/lists/${listId}`, {
    session,
    seed: (queryClient) => {
      queryClient.setQueryData(queryKeys.lists.all, [inbox, casa, agenda])
      queryClient.setQueryData(queryKeys.items.byList(listId), items)
    },
  })
}

describe('ordenar a mano (2.9, diseño 14)', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    savedSettings = parseSettings({})
  })
  afterEach(() => {
    setDesktop(false)
    vi.useRealTimers()
  })

  it('escritorio: el ··· tiene «Subir ⌥↑» y «Bajar ⌥↓»; bajar guarda una sola posición', async () => {
    const user = userEvent.setup()
    setDesktop(true)
    renderDetail('casa', [grifo, lampara, seguro])

    await user.click(await screen.findByRole('button', { name: 'Opciones de «Arreglar el grifo»' }))
    expect(await screen.findByRole('menuitem', { name: /Subir/ })).toHaveAttribute('data-disabled')
    expect(screen.getByRole('menuitem', { name: /Subir/ })).toHaveTextContent('⌥↑')
    await user.click(screen.getByRole('menuitem', { name: /Bajar/ }))

    // Entre la lámpara (2000) y el seguro (3000): una sola fila, en 2500.
    await waitFor(() => {
      expect(itemsApi.updateItemPositions).toHaveBeenCalledWith([{ id: 'grifo', position: 2500 }])
    })
    const rows = within(screen.getByRole('list', { name: 'Ítems' })).getAllByRole('listitem')
    expect(rows.map((row) => row.textContent)).toEqual([
      expect.stringContaining('Lámpara para el salón'),
      expect.stringContaining('Arreglar el grifo'),
      expect.stringContaining('Llamar al seguro'),
    ])
  })

  it('escritorio: ⌥↓ con el foco en una fila la baja sin levantarla; y tiene su asa', async () => {
    setDesktop(true)
    renderDetail('casa', [grifo, lampara, seguro])

    expect(
      await screen.findByRole('button', { name: 'Ordenar «Llamar al seguro»' }),
    ).toHaveAttribute('aria-roledescription', 'ordenable')
    const title = screen.getByRole('button', { name: 'Lámpara para el salón' })
    title.focus()
    fireEvent.keyDown(title, { key: 'ArrowDown', altKey: true })
    await waitFor(() => {
      expect(itemsApi.updateItemPositions).toHaveBeenCalledWith([{ id: 'lampara', position: 4000 }])
    })
  })

  it('con «Pendientes» se ordena entre lo que se ve; lo hecho conserva su sitio (R9)', async () => {
    const user = userEvent.setup()
    setDesktop(true)
    renderDetail('casa', [grifo, lampara, hecha, seguro])

    await user.click(await screen.findByRole('radio', { name: 'Pendientes' }))
    await user.click(screen.getByRole('button', { name: 'Opciones de «Arreglar el grifo»' }))
    await user.click(await screen.findByRole('menuitem', { name: /Bajar/ }))
    // Baja tras la lámpara (2000) y queda antes de lo hecho (2500), que no se ve y sigue en su sitio.
    await waitFor(() => {
      expect(itemsApi.updateItemPositions).toHaveBeenCalledWith([{ id: 'grifo', position: 2250 }])
    })
  })

  it('móvil: mantener pulsado y soltar sin mover abre el menú, con «Subir» y «Bajar» (R4)', async () => {
    renderDetail('casa', [grifo, lampara, seguro])
    const row = await vi.waitFor(() => {
      const found = screen.getByText('Lámpara para el salón').closest('[data-swipe-row] > div')
      if (!found) throw new Error('sin fila')
      return found
    })

    fireEvent.touchStart(row, { touches: [{ clientX: 100, clientY: 300 }] })
    // Los 0,4 s de la pulsación larga, de verdad.
    await act(() => new Promise((resolve) => setTimeout(resolve, 450)))
    fireEvent.touchEnd(row, { changedTouches: [{ clientX: 100, clientY: 300 }] })
    // dnd-kit se traga los clics 50 ms tras soltar (el que manda el navegador al levantar el dedo).
    await act(() => new Promise((resolve) => setTimeout(resolve, 80)))

    const sheet = () => screen.findByRole('dialog', { name: 'Opciones de «Lámpara para el salón»' })
    const step = async (name: 'Subir' | 'Bajar') =>
      within(await sheet()).getByRole('button', { name })
    expect(await step('Subir')).toBeEnabled()
    fireEvent.click(await step('Subir'))
    await waitFor(() => {
      expect(itemsApi.updateItemPositions).toHaveBeenCalledWith([{ id: 'lampara', position: 0 }])
    })
    // La hoja sigue abierta para pulsar varias veces; arriba del todo ya no sube.
    await waitFor(async () => {
      expect(await step('Subir')).toBeDisabled()
    })
    expect(await step('Bajar')).toBeEnabled()
  })

  it('una lista de eventos no se ordena: sin asa ni «Subir» (R12)', async () => {
    const user = userEvent.setup()
    setDesktop(true)
    const cena = item('cena', 'Cena con Marta', {
      listId: 'agenda',
      kind: 'event',
      status: 'upcoming',
      dueAt: new Date(Date.now() + 24 * HOUR),
    })
    renderDetail('agenda', [cena])

    await user.click(await screen.findByRole('button', { name: 'Opciones de «Cena con Marta»' }))
    expect(await screen.findByRole('menuitem', { name: /Mover a/ })).toBeInTheDocument()
    expect(screen.queryByRole('menuitem', { name: /Subir/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Ordenar «/ })).not.toBeInTheDocument()
  })

  it('«En mente»: bajar con «Más reciente» pasa a «A mi manera» con el orden que se veía (E3, E4)', async () => {
    const user = userEvent.setup()
    setDesktop(true)
    const pilas = item('pilas', 'Comprar pilas AA', {
      listId: 'i',
      kind: 'note',
      position: 3000,
      createdAt: new Date(Date.now() - HOUR),
    })
    const marta = item('marta', 'Llamar a Marta', {
      listId: 'i',
      kind: 'note',
      position: 2000,
      createdAt: new Date(Date.now() - 2 * HOUR),
    })
    const dni = item('dni', 'Renovar el DNI', {
      listId: 'i',
      kind: 'note',
      position: 1000,
      createdAt: new Date(Date.now() - 20 * 24 * HOUR),
    })
    renderDetail('i', [dni, marta, pilas])

    // Más reciente primero: pilas, Marta, DNI. Se baja pilas una con ⌥↓ (D3).
    const pilasRow = await screen.findByRole('button', { name: 'Comprar pilas AA' })
    pilasRow.focus()
    fireEvent.keyDown(pilasRow, { key: 'ArrowDown', altKey: true })

    await waitFor(() => {
      expect(profileApi.updateSettings).toHaveBeenCalledWith(session.user.id, {
        inboxSort: 'manual',
      })
    })
    // Se fija el orden que se veía, con la bajada: Marta, pilas, DNI.
    expect(itemsApi.updateItemPositions).toHaveBeenCalledWith([
      { id: 'marta', position: 1000 },
      { id: 'pilas', position: 2000 },
      { id: 'dni', position: 3000 },
    ])
    expect(await screen.findByText('Orden: a mi manera')).toBeInTheDocument()
    expect(await screen.findByRole('button', { name: 'Ordenar: A mi manera' })).toBeInTheDocument()

    // «Deshacer» vuelve al orden de antes.
    await user.click(screen.getByRole('button', { name: 'Deshacer' }))
    await waitFor(() => {
      expect(profileApi.updateSettings).toHaveBeenLastCalledWith(session.user.id, {
        inboxSort: 'newest',
      })
    })
  })
})
