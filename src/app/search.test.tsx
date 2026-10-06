import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { Item } from '@/features/items'
import * as itemsApi from '@/features/items/api'
import * as listsApi from '@/features/lists/api'
import type { List } from '@/features/lists'
import * as searchApi from '@/features/search/api'
import { queryKeys } from '@/lib/queryKeys'
import { fakeSession, renderRoute } from '@/test/render-route'

vi.mock('@/features/items/api')
vi.mock('@/features/lists/api')
vi.mock('@/features/search/api')

const session = fakeSession()

function list(id: string, name: string, overrides: Partial<List> = {}): List {
  return {
    id,
    name,
    color: 'coral',
    icon: null,
    kind: 'tasks',
    position: 2000,
    counters: { pending: 1, done: 0, pendingPriceCents: 0 },
    archivedAt: null,
    isOwner: true,
    ...overrides,
  }
}

const U = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`

function item(n: number, title: string, overrides: Partial<Item> = {}): Item {
  return {
    id: U(n),
    listId: 'casa',
    kind: 'task',
    parentId: null,
    title,
    notes: null,
    status: 'pending',
    priority: null,
    dueAt: null,
    allDay: false,
    recurrence: null,
    position: 1000 * n,
    completedAt: null,
    createdAt: new Date(2026, 8, 20 - n),
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
    priceLinkId: null,
    priceStore: null,
    createdBy: null,
    completedBy: null,
    ...overrides,
  }
}

const inbox = list('i', 'En mente', { kind: 'inbox', color: 'indigo', position: 1000 })
const casa = list('casa', 'Casa')
const mudanza = list('mudanza', 'Mudanza', { color: 'amber', archivedAt: new Date(2026, 5, 1) })

const coche = item(1, 'Llamar al seguro del coche', { status: 'in_progress' })
const caldera = item(2, 'Revisar la caldera', {
  notes: 'Antes del invierno, preguntar si el seguro de hogar cubre la revisión anual.',
})
const direccion = item(3, 'Cambiar la dirección del seguro', {
  listId: 'mudanza',
  status: 'done',
  completedAt: new Date(2026, 5, 3),
})
const cafe = item(4, 'Comprar café')
const all = [coche, caldera, direccion, cafe]

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

function renderSearch(path = '/search') {
  vi.mocked(listsApi.fetchLists).mockResolvedValue([inbox, casa])
  vi.mocked(listsApi.fetchArchivedLists).mockResolvedValue([mudanza])
  vi.mocked(searchApi.fetchAllItems).mockResolvedValue(all)
  return renderRoute(path, {
    session,
    seed: (queryClient) => {
      queryClient.setQueryData(queryKeys.lists.all, [inbox, casa])
      queryClient.setQueryData(queryKeys.lists.archived, [mudanza])
      queryClient.setQueryData(queryKeys.items.all, all)
    },
  })
}

const field = () => screen.findByRole('searchbox', { name: 'Buscar en todas tus listas' })
const section = (name: string) => screen.getByRole('region', { name: new RegExp(name) })

describe('Buscar', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })
  afterEach(() => {
    setDesktop(false)
  })

  it('antes de escribir, el campo con el foco y qué busca; sin +', async () => {
    renderSearch()

    expect(await field()).toHaveFocus()
    expect(screen.getByText(/Busca en el título y las notas/)).toBeInTheDocument()
    expect(screen.queryByRole('radiogroup', { name: 'Filtrar resultados' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Captura rápida' })).not.toBeInTheDocument()
  })

  it('?q=seguro precarga: por listas, resaltado, fragmento de la nota y la archivada', async () => {
    renderSearch('/search?q=seguro')

    expect(await field()).toHaveValue('seguro')
    expect(screen.getByText('3 resultados en 2 listas')).toBeInTheDocument()

    const [first, second] = within(section('Casa')).getAllByRole('listitem')
    expect(first).toHaveTextContent('Llamar al seguro del coche')
    expect(first).toHaveTextContent('En curso')
    expect(first?.querySelector('mark')).toHaveTextContent('seguro')
    expect(second).toHaveTextContent('…preguntar si el seguro de hogar')

    const archived = section('Mudanza')
    expect(within(archived).getByText('Archivada')).toBeInTheDocument()
    expect(within(archived).getByRole('listitem')).toHaveTextContent('Hecha · 3 jun')
  })

  it('escribir busca al momento, sin acentos, y lo deja en la URL', async () => {
    const user = userEvent.setup()
    const { router } = renderSearch()

    await user.type(await field(), 'cafe')

    expect(within(section('Casa')).getByRole('listitem')).toHaveTextContent('Comprar café')
    await waitFor(() => {
      expect(router.state.location.search).toEqual({ q: 'cafe' })
    })
  })

  it('sin resultados, y con un filtro que deja fuera lo que sí hay', async () => {
    const user = userEvent.setup()
    renderSearch('/search?q=xyz')

    expect(await screen.findByText('No hay nada con «xyz».')).toBeInTheDocument()

    const input = await field()
    await user.clear(input)
    await user.type(input, 'dirección')
    await user.click(screen.getByRole('radio', { name: 'Pendientes' }))
    expect(screen.getByText('Nada pendiente. Hay 1 en Hechas.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Ver todo' }))
    expect(screen.getByRole('radio', { name: 'Todo' })).toHaveAttribute('aria-checked', 'true')
    expect(within(section('Mudanza')).getByRole('listitem')).toBeInTheDocument()
  })

  it('tocar un resultado abre su detalle sin salir de Buscar', async () => {
    const user = userEvent.setup()
    const { router } = renderSearch('/search?q=caldera')

    await user.click(await screen.findByRole('button', { name: 'Revisar la caldera' }))

    expect(
      await screen.findByRole('dialog', { name: 'Detalle de «Revisar la caldera»' }),
    ).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/search')
    expect(router.state.location.search).toEqual({ q: 'caldera', item: caldera.id })
  })

  it('completar desde un resultado cambia su estado', async () => {
    const user = userEvent.setup()
    vi.mocked(itemsApi.updateItemStatus).mockReturnValue(new Promise(() => undefined))
    renderSearch('/search?q=caldera')

    const checkbox = await screen.findByRole('checkbox', { name: 'Revisar la caldera' })
    await user.click(checkbox)

    expect(checkbox).toHaveAttribute('aria-checked', 'true')
    expect(itemsApi.updateItemStatus).toHaveBeenCalledWith(caldera.id, 'done')
  })

  it('también encuentra listas: arriba, y tocarla la abre', async () => {
    const user = userEvent.setup()
    const { router } = renderSearch('/search?q=casa')

    const lists = await screen.findByRole('region', { name: 'Listas' })
    const link = within(lists).getByRole('link', { name: /Casa/ })
    expect(link).toHaveTextContent('Tareas · 1 pendiente')
    // Solo coincide la lista: no hay «No hay nada con…».
    expect(screen.queryByText(/No hay nada con/)).not.toBeInTheDocument()

    // Con un filtro de estado, las listas no salen (no tienen estado).
    await user.click(screen.getByRole('radio', { name: 'Pendientes' }))
    expect(screen.queryByRole('region', { name: 'Listas' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('radio', { name: 'Todo' }))

    await user.click(within(screen.getByRole('region', { name: 'Listas' })).getByRole('link'))
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/lists/casa')
    })
  })

  it('una lista archivada abre su hoja para desarchivarla', async () => {
    const user = userEvent.setup()
    renderSearch('/search?q=mudanza')

    const lists = await screen.findByRole('region', { name: 'Listas' })
    await user.click(within(lists).getByRole('button', { name: /Mudanza/ }))

    const sheet = await screen.findByRole('dialog', { name: '«Mudanza» archivada' })
    expect(within(sheet).getByRole('button', { name: 'Desarchivar' })).toBeInTheDocument()
  })

  it('en escritorio, las flechas empiezan por las listas e Intro abre la marcada', async () => {
    const user = userEvent.setup()
    setDesktop(true)
    const { router } = renderSearch('/search?q=casa')

    ;(await field()).focus()
    await user.keyboard('{ArrowDown}{Enter}')
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/lists/casa')
    })
  })

  it('en escritorio: el sidebar enseña la búsqueda, Intro abre el primero y las flechas pasan', async () => {
    const user = userEvent.setup()
    setDesktop(true)
    const { router } = renderSearch('/search?q=seguro')

    const input = await field()
    expect(screen.getByRole('textbox', { name: 'Buscar' })).toHaveValue('seguro')
    expect(screen.getByText(/también en notas, hechos y archivadas/)).toBeInTheDocument()

    input.focus()
    await user.keyboard('{Enter}')
    await waitFor(() => {
      expect(router.state.location.search).toMatchObject({ item: coche.id })
    })
    expect(
      await screen.findByRole('region', { name: 'Detalle de «Llamar al seguro del coche»' }),
    ).toBeInTheDocument()

    await user.keyboard('{ArrowDown}')
    await waitFor(() => {
      expect(router.state.location.search).toMatchObject({ item: caldera.id })
    })
  })
})
