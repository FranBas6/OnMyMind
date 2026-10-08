import { onlineManager } from '@tanstack/react-query'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import * as photos from '@/features/items/photos'
import * as api from '@/features/lists/api'
import type { List } from '@/features/lists'
import * as sharingApi from '@/features/sharing/api'
import { queryKeys } from '@/lib/queryKeys'
import { fakeSession, renderRoute } from '@/test/render-route'

vi.mock('@/features/lists/api')
vi.mock('@/features/items/photos', async (importOriginal) => ({
  ...(await importOriginal<typeof photos>()),
  copyItemPhoto: vi.fn(),
}))
vi.mock('@/features/sharing/api', async (importOriginal) => ({
  ...(await importOriginal<typeof sharingApi>()),
  fetchSharedPeople: () => Promise.resolve(new Map()),
  fetchDeparture: () => Promise.resolve(null),
  subscribeToLiveChanges: () => () => undefined,
  fetchListPeople: vi.fn(),
}))

const session = fakeSession()

function list(id: string, name: string, overrides: Partial<List> = {}): List {
  return {
    id,
    name,
    color: 'teal',
    icon: null,
    kind: 'tasks',
    position: 2000,
    counters: { pending: 20, done: 4, pendingPriceCents: 0 },
    archivedAt: null,
    isOwner: true,
    ...overrides,
  }
}

const COPY = '00000000-0000-4000-8000-0000000000c0'
const inbox = list('i', 'En mente', { kind: 'inbox', color: 'indigo', position: 1000 })
const maleta = list('maleta', 'Maleta de viaje')
const compras = list('compras', 'Compras', {
  kind: 'shopping',
  color: 'blue',
  position: 3000,
  isOwner: false,
  counters: { pending: 5, done: 0, pendingPriceCents: 0 },
})
const mudanza = list('mudanza', 'Mudanza', { archivedAt: new Date(2026, 8, 12) })

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

function renderHome({ desktop = false } = {}) {
  setDesktop(desktop)
  vi.mocked(api.fetchLists).mockResolvedValue([inbox, maleta, compras])
  vi.mocked(api.fetchArchivedLists).mockResolvedValue([mudanza])
  vi.mocked(api.fetchRecentCaptures).mockResolvedValue([])
  vi.mocked(api.deleteList).mockResolvedValue()
  return renderRoute('/', {
    session,
    seed: (queryClient) => {
      queryClient.setQueryData(queryKeys.lists.all, [inbox, maleta, compras])
      queryClient.setQueryData(queryKeys.lists.archived, [mudanza])
      queryClient.setQueryData(queryKeys.items.latest('i', 3), [])
      queryClient.setQueryData(queryKeys.items.byList(COPY), [])
    },
  })
}

const sheet = (name: string) => screen.findByRole('dialog', { name: `Duplicar «${name}»` })

describe('duplicar una lista (4.4, diseño 23, C)', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    onlineManager.setOnline(true)
  })
  afterEach(() => {
    setDesktop(false)
    onlineManager.setOnline(true)
  })

  it('desde el menú: el nombre propuesto, qué se copia, se abre la copia y «Deshacer» la borra (C1–C3)', async () => {
    const user = userEvent.setup()
    vi.mocked(api.duplicateList).mockResolvedValue({ listId: COPY, items: 24, photos: [] })
    const { router } = renderHome()

    await user.click(await screen.findByRole('button', { name: 'Opciones de «Maleta de viaje»' }))
    await user.click(await screen.findByRole('button', { name: 'Duplicar' }))

    const dialog = await sheet('Maleta de viaje')
    expect(within(dialog).getByRole('textbox')).toHaveValue('Maleta de viaje (2)')
    expect(dialog).toHaveTextContent(
      'Se copia24 cosas, todas pendientes, con sus notas, tipos, sublistas, fotos, enlaces, tiendas, precios y repeticiones.',
    )
    expect(dialog).toHaveTextContent('No se copiaFechas, avisos y personas con quien se comparte.')

    await user.click(within(dialog).getByRole('button', { name: 'Duplicar' }))
    expect(api.duplicateList).toHaveBeenCalledWith('maleta', 'Maleta de viaje (2)')
    await waitFor(() => {
      expect(router.state.location.pathname).toBe(`/lists/${COPY}`)
    })
    expect(
      (await screen.findAllByText('Copia creada · 24 cosas pendientes')).length,
    ).toBeGreaterThan(0)

    const undo = screen.getAllByRole('button', { name: 'Deshacer' }).at(-1)
    if (!undo) throw new Error('sin «Deshacer»')
    await user.click(undo)
    await waitFor(() => {
      expect(api.deleteList).toHaveBeenCalledWith(COPY)
    })
  })

  it('el nombre se puede cambiar', async () => {
    const user = userEvent.setup()
    vi.mocked(api.duplicateList).mockResolvedValue({ listId: COPY, items: 24, photos: [] })
    renderHome()
    await user.click(await screen.findByRole('button', { name: 'Opciones de «Maleta de viaje»' }))
    await user.click(await screen.findByRole('button', { name: 'Duplicar' }))
    const dialog = await sheet('Maleta de viaje')
    const field = within(dialog).getByRole('textbox')
    await user.clear(field)
    expect(within(dialog).getByRole('button', { name: 'Duplicar' })).toBeDisabled()
    await user.type(field, 'Maleta de Lisboa')
    await user.click(within(dialog).getByRole('button', { name: 'Duplicar' }))
    expect(api.duplicateList).toHaveBeenCalledWith('maleta', 'Maleta de Lisboa')
  })

  it('las fotos subidas se copian después, cada una a su copia', async () => {
    const user = userEvent.setup()
    vi.mocked(photos.copyItemPhoto).mockResolvedValue()
    vi.mocked(api.duplicateList).mockResolvedValue({
      listId: COPY,
      items: 24,
      photos: [{ itemId: 'nuevo-neceser', path: 'ana/neceser/foto.webp' }],
    })
    renderHome()
    await user.click(await screen.findByRole('button', { name: 'Opciones de «Maleta de viaje»' }))
    await user.click(await screen.findByRole('button', { name: 'Duplicar' }))
    await user.click(
      within(await sheet('Maleta de viaje')).getByRole('button', { name: 'Duplicar' }),
    )
    await waitFor(() => {
      expect(photos.copyItemPhoto).toHaveBeenCalledWith('nuevo-neceser', 'ana/neceser/foto.webp')
    })
  })

  it('una compartida contigo: «Compras de Fran», y la de Fran no cambia (C4, C5)', async () => {
    const user = userEvent.setup()
    vi.mocked(sharingApi.fetchListPeople).mockResolvedValue([
      { userId: 'fran', displayName: 'Fran', avatarUrl: null, isOwner: true, joinedAt: null },
    ])
    vi.mocked(api.duplicateList).mockResolvedValue({ listId: COPY, items: 5, photos: [] })
    renderHome()

    await user.click(await screen.findByRole('button', { name: 'Opciones de «Compras»' }))
    await user.click(await screen.findByRole('button', { name: 'Duplicar' }))
    const dialog = await sheet('Compras de Fran')
    await waitFor(() => {
      expect(within(dialog).getByRole('textbox')).toHaveValue('Compras de Fran')
    })
    expect(dialog).toHaveTextContent('Fechas, avisos y personas: la copia es solo tuya.')
    expect(dialog).toHaveTextContent('La lista de Fran no cambia y tú sigues en ella.')
    await user.click(within(dialog).getByRole('button', { name: 'Duplicar' }))
    expect(api.duplicateList).toHaveBeenCalledWith('compras', 'Compras de Fran')
  })

  it('una archivada, desde su hoja: la copia sale en tus listas (C6, C7)', async () => {
    const user = userEvent.setup()
    renderHome()
    await user.click(await screen.findByRole('button', { name: '1 lista archivada' }))
    await user.click(
      within(screen.getByRole('region', { name: 'Listas archivadas' })).getByRole('button', {
        name: /Mudanza/,
      }),
    )
    const archived = await screen.findByRole('dialog', { name: '«Mudanza» archivada' })
    await user.click(within(archived).getByRole('button', { name: 'Duplicar' }))

    const dialog = await sheet('Mudanza')
    expect(within(dialog).getByRole('textbox')).toHaveValue('Mudanza (2)')
    expect(dialog).toHaveTextContent('La copia sale en tus listas. «Mudanza» sigue archivada.')
  })

  it('sin conexión no se puede, y lo dice', async () => {
    const user = userEvent.setup()
    renderHome()
    onlineManager.setOnline(false)
    await user.click(await screen.findByRole('button', { name: 'Opciones de «Maleta de viaje»' }))
    await user.click(await screen.findByRole('button', { name: 'Duplicar' }))
    const dialog = await sheet('Maleta de viaje')
    expect(dialog).toHaveTextContent('Para duplicar hace falta conexión.')
    expect(within(dialog).getByRole('button', { name: 'Duplicar' })).toBeDisabled()
  })

  it('en escritorio, también con el botón derecho en el sidebar (E4)', async () => {
    const user = userEvent.setup()
    renderHome({ desktop: true })
    const sidebar = await screen.findByRole('complementary')
    fireEvent.contextMenu(within(sidebar).getByRole('link', { name: /Maleta de viaje/ }))
    await user.click(await screen.findByRole('menuitem', { name: 'Duplicar…' }))
    const dialog = await sheet('Maleta de viaje')
    expect(within(dialog).getByRole('button', { name: 'Cancelar' })).toBeInTheDocument()
  })
})
