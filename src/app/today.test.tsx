import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { addDays, startOfDay, subDays } from 'date-fns'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { Item } from '@/features/items'
import * as itemsApi from '@/features/items/api'
import * as listsApi from '@/features/lists/api'
import type { List } from '@/features/lists'
import * as todayApi from '@/features/today/api'
import { dayKey } from '@/features/today/today'
import { queryKeys } from '@/lib/queryKeys'
import { fakeSession, renderRoute } from '@/test/render-route'

vi.mock('@/features/items/api')
vi.mock('@/features/lists/api')
vi.mock('@/features/today/api')

const session = fakeSession()
const today = startOfDay(new Date())

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
      pending: 2,
      done: 0,
      pendingPriceCents: 0,
      notes: 0,
      // Una lista con tareas propone tarea (5.4: vacía propondría nota).
      kinds: { note: 0, task: 3, shopping: 0, event: 0 },
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
    dueAt: today,
    allDay: true,
    recurrence: null,
    position: 1000,
    completedAt: null,
    createdAt: subDays(today, 3),
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
const trabajo = list('trabajo', 'Trabajo', { color: 'pink', position: 2000 })
const casa = list('casa', 'Casa', { position: 3000 })
const lists = [inbox, trabajo, casa]

const informe = item('5a0c3e0e-1f7e-4d59-9a39-1c3b9f7a0001', 'Enviar informe trimestral', {
  listId: 'trabajo',
  dueAt: subDays(today, 1),
})
const propuesta = item('5a0c3e0e-1f7e-4d59-9a39-1c3b9f7a0002', 'Revisar propuesta de Lucía', {
  listId: 'trabajo',
})
const grifo = item('5a0c3e0e-1f7e-4d59-9a39-1c3b9f7a0003', 'Arreglar el grifo de la cocina', {
  priority: 'high',
})
const mañana = item('5a0c3e0e-1f7e-4d59-9a39-1c3b9f7a0004', 'Llamar al seguro', {
  dueAt: addDays(today, 1),
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

/**
 * Hoy con la caché sembrada. `server` hace de Supabase: los cambios de estado se le aplican y
 * `fetchToday` devuelve lo que tenga, para que el refresco tras la mutación sea realista.
 */
function renderToday(items: Item[], path = '/today') {
  let server = items
  vi.mocked(listsApi.fetchLists).mockResolvedValue(lists)
  vi.mocked(listsApi.fetchArchivedLists).mockResolvedValue([])
  vi.mocked(todayApi.fetchToday).mockImplementation(() => Promise.resolve(server))
  vi.mocked(itemsApi.updateItemStatus).mockImplementation((id, status) => {
    server = server.map((entry) =>
      entry.id === id
        ? { ...entry, status, completedAt: status === 'done' ? new Date() : null }
        : entry,
    )
    return Promise.resolve()
  })
  return renderRoute(path, {
    session,
    seed: (queryClient) => {
      queryClient.setQueryData(queryKeys.lists.all, lists)
      queryClient.setQueryData(queryKeys.lists.archived, [])
      queryClient.setQueryData(queryKeys.items.today(dayKey(new Date())), items)
    },
  })
}

const section = (name: string) => screen.getByRole('region', { name })

describe('Hoy', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })
  afterEach(() => {
    setDesktop(false)
  })

  it('agrupa por lista lo que vence hoy y lo atrasado; lo de mañana no sale', async () => {
    renderToday([grifo, propuesta, informe, mañana])

    expect(await screen.findByRole('heading', { level: 1, name: 'Hoy' })).toBeInTheDocument()
    const headings = screen.getAllByRole('heading', { level: 2 })
    expect(headings.map((heading) => heading.textContent)).toEqual(['Trabajo', 'Casa'])

    const [first, second] = within(section('Trabajo')).getAllByRole('listitem')
    expect(first).toHaveTextContent('Enviar informe trimestral')
    expect(first).toHaveTextContent('Atrasada · ayer')
    expect(second).toHaveTextContent('Revisar propuesta de Lucía')
    expect(second).toHaveTextContent('Vence hoy')
    expect(within(section('Casa')).getByRole('listitem')).toHaveTextContent(
      'Vence hoy · Prioridad alta',
    )
    expect(screen.queryByText('Llamar al seguro')).not.toBeInTheDocument()
  })

  it('completar desde Hoy: se ve el check, sale y queda en «1 hecha hoy»', async () => {
    const user = userEvent.setup()
    renderToday([grifo, propuesta])

    const checkbox = await screen.findByRole('checkbox', { name: 'Arreglar el grifo de la cocina' })
    await user.click(checkbox)
    expect(checkbox).toHaveAttribute('aria-checked', 'true')
    expect(itemsApi.updateItemStatus).toHaveBeenCalledWith(grifo.id, 'done')

    await waitFor(() => {
      expect(screen.queryByRole('region', { name: 'Casa' })).not.toBeInTheDocument()
    })
    const done = screen.getByRole('region', { name: 'Hechas hoy' })
    await user.click(within(done).getByRole('button', { name: '1 hecha hoy' }))
    expect(within(done).getByText('Arreglar el grifo de la cocina')).toBeInTheDocument()

    // Desmarcarla la devuelve a su sección.
    await user.click(within(done).getByRole('checkbox', { name: 'Arreglar el grifo de la cocina' }))
    expect(await screen.findByRole('region', { name: 'Casa' })).toBeInTheDocument()
    expect(itemsApi.updateItemStatus).toHaveBeenLastCalledWith(grifo.id, 'pending')
  })

  it('sin nada para hoy, el vacío del diseño', async () => {
    renderToday([mañana])

    expect(await screen.findByText('Nada en mente para hoy.')).toBeInTheDocument()
    expect(screen.getByText('Disfrútalo.')).toBeInTheDocument()
    // El + de captura sigue ahí.
    expect(screen.getByRole('button', { name: 'Captura rápida' })).toBeInTheDocument()
  })

  it('tocar una fila abre su detalle sin salir de Hoy', async () => {
    const user = userEvent.setup()
    const { router } = renderToday([grifo, propuesta])

    await user.click(await screen.findByRole('button', { name: 'Revisar propuesta de Lucía' }))

    const sheet = await screen.findByRole('dialog', {
      name: 'Detalle de «Revisar propuesta de Lucía»',
    })
    expect(within(sheet).getByText(/Trabajo ·/)).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/today')
    expect(router.state.location.search).toEqual({ item: propuesta.id })
  })

  it('en escritorio, el sidebar cuenta lo que queda para hoy', async () => {
    setDesktop(true)
    renderToday([grifo, propuesta, informe, mañana])

    const accesses = await screen.findByRole('navigation', { name: 'Accesos' })
    await waitFor(() => {
      expect(within(accesses).getByRole('link', { name: /Hoy/ })).toHaveTextContent('Hoy3')
    })
  })
})
