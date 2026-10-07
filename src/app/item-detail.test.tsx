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
const HOUR = 60 * 60 * 1000

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

// Los ids van en `?item=`, que solo admite uuid.
const ID = {
  grifo: '00000000-0000-4000-8000-000000000001',
  pilas: '00000000-0000-4000-8000-000000000002',
  camiseta: '00000000-0000-4000-8000-000000000003',
}

function item(id: string, title: string, overrides: Partial<Item> = {}): Item {
  return {
    id,
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
const compras = list('compras', 'Compras', { kind: 'shopping', color: 'blue', position: 3000 })

const grifo = item(ID.grifo, 'Arreglar el grifo de la cocina', {
  notes: 'Gotea por la junta de abajo.',
  priority: 'high',
})
const pilas = item(ID.pilas, 'Comprar pilas AA', { listId: 'i', kind: 'note' })
const camiseta = item(ID.camiseta, 'Camiseta', { listId: 'compras', kind: 'shopping' })

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

/** Abre una ruta con la caché sembrada; los `server` son lo que devolvería Supabase al volver a pedir. */
function renderAt(
  path: string,
  seed: Record<string, Item[]>,
  server: Record<string, Item[]> = seed,
) {
  vi.mocked(listsApi.fetchLists).mockResolvedValue([inbox, casa, compras])
  vi.mocked(listsApi.fetchArchivedLists).mockResolvedValue([])
  vi.mocked(itemsApi.fetchItems).mockImplementation((listId) =>
    Promise.resolve(server[listId] ?? []),
  )
  vi.mocked(itemsApi.fetchMovedFromInbox).mockResolvedValue([])
  return renderRoute(path, {
    session,
    seed: (queryClient) => {
      queryClient.setQueryData(queryKeys.lists.all, [inbox, casa, compras])
      queryClient.setQueryData(queryKeys.lists.archived, [])
      queryClient.setQueryData(queryKeys.items.movedFrom('i'), [])
      for (const [listId, items] of Object.entries(seed)) {
        queryClient.setQueryData(queryKeys.items.byList(listId), items)
      }
    },
  })
}

describe('detalle de una tarea', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })
  afterEach(() => {
    setDesktop(false)
  })

  it('tocar la fila abre el detalle y lo pone en la URL', async () => {
    const user = userEvent.setup()
    const { router } = renderAt('/lists/casa', { casa: [grifo] })

    await user.click(await screen.findByRole('button', { name: 'Arreglar el grifo de la cocina' }))

    const sheet = await screen.findByRole('dialog', { name: /Detalle de «Arreglar el grifo/ })
    expect(within(sheet).getByRole('textbox', { name: 'Título' })).toHaveValue(
      'Arreglar el grifo de la cocina',
    )
    expect(within(sheet).getByRole('textbox', { name: 'Notas' })).toHaveValue(
      'Gotea por la junta de abajo.',
    )
    expect(within(sheet).getByRole('radio', { name: 'Alta' })).toHaveAttribute(
      'aria-checked',
      'true',
    )
    expect(within(sheet).getByText('Sin fecha')).toBeInTheDocument()
    expect(within(sheet).queryByText('Recordatorio')).not.toBeInTheDocument()
    expect(router.state.location.search).toEqual({ item: ID.grifo })
  })

  it('cada campo se guarda solo: prioridad al tocarla, título al salir del campo', async () => {
    const user = userEvent.setup()
    // Un servidor de mentira que aplica cada cambio, para que volver a pedir no lo pise.
    const server = { casa: [grifo] }
    vi.mocked(itemsApi.updateItem).mockImplementation((_id, patch) => {
      server.casa = [{ ...server.casa[0], ...patch } as Item]
      return Promise.resolve()
    })
    renderAt(`/lists/casa?item=${ID.grifo}`, { casa: [grifo] }, server)
    const sheet = await screen.findByRole('dialog', { name: /Detalle de/ })

    await user.click(within(sheet).getByRole('radio', { name: 'Media' }))
    expect(itemsApi.updateItem).toHaveBeenLastCalledWith(ID.grifo, { priority: 'medium' })

    const title = within(sheet).getByRole('textbox', { name: 'Título' })
    await user.clear(title)
    await user.type(title, 'Cambiar el grifo')
    await user.tab()
    await waitFor(() => {
      expect(itemsApi.updateItem).toHaveBeenLastCalledWith(ID.grifo, { title: 'Cambiar el grifo' })
    })
    expect(title).toHaveValue('Cambiar el grifo')
  })

  it('la fecha límite se elige en el calendario y sale en la fila', async () => {
    const user = userEvent.setup()
    vi.mocked(itemsApi.updateItem).mockResolvedValue()
    const today = new Date(new Date().setHours(0, 0, 0, 0))
    renderAt(
      `/lists/casa?item=${ID.grifo}`,
      { casa: [grifo] },
      { casa: [{ ...grifo, dueAt: today, allDay: true }] },
    )
    const sheet = await screen.findByRole('dialog', { name: /Detalle de/ })

    await user.click(within(sheet).getByRole('button', { name: /Fecha límite/ }))
    await user.click(await screen.findByRole('button', { name: 'Hoy' }))

    await waitFor(() => {
      expect(vi.mocked(itemsApi.updateItem).mock.lastCall?.[1].dueAt?.getHours()).toBe(0)
    })
    expect(await within(sheet).findByText(/^Hoy, /)).toBeInTheDocument()
  })

  it('en escritorio es un panel lateral que se cierra con Escape', async () => {
    const user = userEvent.setup()
    setDesktop(true)
    const { router } = renderAt(`/lists/casa?item=${ID.grifo}`, { casa: [grifo] })

    expect(await screen.findByRole('region', { name: /Detalle de/ })).toBeInTheDocument()
    await user.keyboard('{Escape}')
    await waitFor(() => {
      expect(screen.queryByRole('region', { name: /Detalle de/ })).not.toBeInTheDocument()
    })
    expect(router.state.location.search).toEqual({})
  })

  it('un ?item= que no es de esta lista no abre nada y se quita', async () => {
    const { router } = renderAt(`/lists/casa?item=${ID.pilas}`, { casa: [grifo] })

    await screen.findByRole('heading', { level: 1, name: 'Casa' })
    await waitFor(() => {
      expect(router.state.location.search).toEqual({})
    })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('borrar lo quita al instante y «Deshacer» lo recupera tal cual', async () => {
    const user = userEvent.setup()
    vi.mocked(itemsApi.deleteItem).mockResolvedValue()
    vi.mocked(itemsApi.insertItems).mockResolvedValue()
    renderAt(`/lists/casa?item=${ID.grifo}`, { casa: [grifo] }, { casa: [] })
    const sheet = await screen.findByRole('dialog', { name: /Detalle de/ })

    await user.click(within(sheet).getByRole('button', { name: 'Borrar' }))

    expect(await screen.findByText('Aún no hay nada aquí.')).toBeInTheDocument()
    expect(itemsApi.deleteItem).toHaveBeenCalledWith(ID.grifo)
    await user.click(await screen.findByRole('button', { name: 'Deshacer' }))
    await waitFor(() => {
      expect(itemsApi.insertItems).toHaveBeenCalledWith([expect.objectContaining({ id: ID.grifo })])
    })
  })

  it('el menú ··· de escritorio pone la tarea en curso', async () => {
    const user = userEvent.setup()
    setDesktop(true)
    vi.mocked(itemsApi.updateItemStatus).mockResolvedValue()
    renderAt('/lists/casa', { casa: [grifo] }, { casa: [{ ...grifo, status: 'in_progress' }] })

    await user.click(
      await screen.findByRole('button', { name: 'Opciones de «Arreglar el grifo de la cocina»' }),
    )
    await user.click(await screen.findByRole('menuitem', { name: /Marcar en curso/ }))

    await waitFor(() => {
      expect(
        screen.getByRole('checkbox', { name: 'Arreglar el grifo de la cocina' }),
      ).toHaveAttribute('aria-checked', 'mixed')
    })
    expect(itemsApi.updateItemStatus).toHaveBeenCalledWith(ID.grifo, 'in_progress')
  })

  it('la ficha de una compra: estados del tipo, sin prioridad ni fecha, con «Añadir precio»', async () => {
    renderAt(`/lists/compras?item=${ID.camiseta}`, { compras: [camiseta] })
    const sheet = await screen.findByRole('dialog', { name: /Detalle de «Camiseta»/ })

    expect(
      within(sheet)
        .getAllByRole('radio')
        .map((radio) => radio.textContent),
    ).toEqual(['Pendiente', 'Comprado', 'Descartado'])
    expect(within(sheet).queryByText('Prioridad')).not.toBeInTheDocument()
    expect(within(sheet).queryByText('Fecha límite')).not.toBeInTheDocument()
    expect(within(sheet).getByRole('button', { name: 'Añadir precio' })).toBeInTheDocument()
  })
})

describe('mover desde «En mente»', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('«Mover a…» de la fila lo lleva a Casa y queda como movida', async () => {
    const user = userEvent.setup()
    vi.mocked(itemsApi.moveItem).mockReturnValue(new Promise(() => undefined))
    renderAt('/lists/i', { i: [pilas], casa: [grifo] })

    await user.click(await screen.findByRole('button', { name: 'Mover «Comprar pilas AA» a…' }))
    const sheet = await screen.findByRole('dialog', { name: /Mover «Comprar pilas AA» a…/ })
    // En «En mente» no sale ella misma como destino.
    expect(within(sheet).queryByRole('button', { name: /^En mente/ })).not.toBeInTheDocument()
    await user.click(within(sheet).getByRole('button', { name: /^Casa/ }))
    expect(within(sheet).getByText('Se guarda como tarea en Casa.')).toBeInTheDocument()
    await user.click(within(sheet).getByRole('button', { name: 'Mover a Casa' }))

    expect(itemsApi.moveItem).toHaveBeenCalledWith(
      ID.pilas,
      expect.objectContaining({ listId: 'casa', status: 'pending', priority: null }),
    )
    await waitFor(() => {
      expect(screen.getByText('Nada en mente.')).toBeInTheDocument()
    })
    await user.click(screen.getByRole('button', { name: /Fuera de la cabeza/ }))
    expect(screen.getByText(/movida a Casa/)).toBeInTheDocument()
  })

  it('mover una tarea con campos avisa de lo que se pierde', async () => {
    const user = userEvent.setup()
    renderAt(`/lists/casa?item=${ID.grifo}`, { casa: [grifo], i: [] })
    const detail = await screen.findByRole('dialog', { name: /Detalle de/ })

    await user.click(within(detail).getByRole('button', { name: 'Mover a otra lista' }))
    const sheet = await screen.findByRole('dialog', { name: /Mover «Arreglar el grifo/ })
    expect(within(sheet).getByRole('button', { name: /Casa/ })).toBeDisabled()
    await user.click(within(sheet).getByRole('button', { name: /^En mente/ }))

    expect(within(sheet).getByText('Se quita la prioridad.')).toBeInTheDocument()
  })
})
