import { onlineManager } from '@tanstack/react-query'
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
    counters: { pending: 2, done: 1, pendingPriceCents: 0 },
    archivedAt: null,
    ...overrides,
  }
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
    ...overrides,
  }
}

const inbox = list('i', 'En mente', { kind: 'inbox', color: 'indigo', position: 1000 })
const casa = list('casa', 'Casa')

const grifo = item('grifo', 'Arreglar el grifo de la cocina', {
  priority: 'high',
  dueAt: new Date(),
})
const dni = item('dni', 'Renovar el DNI', { position: 2000 })
const basura = item('basura', 'Sacar la basura', {
  status: 'done',
  position: 3000,
  completedAt: new Date(Date.now() - HOUR),
})

/** Abre el detalle con la caché sembrada; `server` es lo que devolvería Supabase al volver a pedir. */
function renderDetail(listId: string, items: Item[], server: Item[] = items) {
  vi.mocked(listsApi.fetchLists).mockResolvedValue([inbox, casa])
  vi.mocked(listsApi.fetchArchivedLists).mockResolvedValue([])
  vi.mocked(itemsApi.fetchItems).mockResolvedValue(server)
  return renderRoute(`/lists/${listId}`, {
    session,
    seed: (queryClient) => {
      queryClient.setQueryData(queryKeys.lists.all, [inbox, casa])
      queryClient.setQueryData(queryKeys.items.byList(listId), items)
    },
  })
}

/** Una respuesta del servidor que el test resuelve cuando quiere. */
function deferred() {
  let resolve!: () => void
  const promise = new Promise<void>((res) => {
    resolve = res
  })
  return { promise, resolve }
}

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

const activeRows = () =>
  within(screen.getByRole('list', { name: 'Ítems' })).getAllByRole('listitem')
const outOfMind = () => screen.getByRole('region', { name: 'Fuera de la cabeza' })

describe('detalle de una lista de tareas', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })
  afterEach(() => {
    onlineManager.setOnline(true)
  })

  it('enseña cabecera, filas con sus chips y «Fuera de la cabeza»', async () => {
    renderDetail('casa', [grifo, dni, basura])

    expect(await screen.findByRole('heading', { level: 1, name: 'Casa' })).toBeInTheDocument()
    expect(screen.getByText('2 pendientes · 1 hecha')).toBeInTheDocument()
    // «‹ Listas» arriba (la barra inferior tiene otro enlace «Listas»).
    expect(screen.getAllByRole('link', { name: 'Listas' })[0]).toHaveAttribute('href', '/')
    expect(screen.getByRole('button', { name: 'Opciones de «Casa»' })).toBeInTheDocument()

    const [first, second] = activeRows()
    expect(first).toHaveTextContent('Arreglar el grifo de la cocina')
    expect(first).toHaveTextContent('Prioridad Alta')
    expect(first).toHaveTextContent('Fecha límite: Hoy')
    expect(second).toHaveTextContent('Renovar el DNI')
    expect(within(outOfMind()).getByText('Sacar la basura')).toBeInTheDocument()
  })

  it('añadir: el ítem sale al instante, el campo se vacía y conserva el foco', async () => {
    const user = userEvent.setup()
    const server = deferred()
    vi.mocked(itemsApi.createItem).mockReturnValue(server.promise)
    renderDetail('casa', [grifo, dni, basura])

    const field = await screen.findByRole('textbox', { name: 'Añadir a Casa…' })
    await user.type(field, 'Comprar bombillas{Enter}')

    expect(activeRows().at(-1)).toHaveTextContent('Comprar bombillas')
    expect(field).toHaveValue('')
    expect(field).toHaveFocus()
    expect(screen.getByText('3 pendientes · 1 hecha')).toBeInTheDocument()
    await waitFor(() => {
      expect(itemsApi.createItem).toHaveBeenCalledWith(
        expect.objectContaining({
          listId: 'casa',
          title: 'Comprar bombillas',
          status: 'pending',
          position: 4000,
        }),
      )
    })

    // Encadenar otra sin salir del campo.
    await user.type(field, 'Pagar la comunidad{Enter}')
    expect(activeRows().at(-1)).toHaveTextContent('Pagar la comunidad')
    server.resolve()
  })

  it('el checkbox la marca hecha y, al cabo de un instante, baja a «Fuera de la cabeza»', async () => {
    const user = userEvent.setup()
    vi.mocked(itemsApi.updateItemStatus).mockResolvedValue()
    const doneDni = { ...dni, status: 'done' as const, completedAt: new Date() }
    renderDetail('casa', [grifo, dni, basura], [grifo, doneDni, basura])

    const checkbox = await screen.findByRole('checkbox', { name: 'Renovar el DNI' })
    await user.click(checkbox)

    // Se ve el check en su sitio antes de bajar.
    expect(checkbox).toHaveAttribute('aria-checked', 'true')
    expect(activeRows()).toHaveLength(2)
    expect(screen.getByText('1 pendiente · 2 hechas')).toBeInTheDocument()

    await waitFor(() => {
      expect(within(outOfMind()).getByText('Renovar el DNI')).toBeInTheDocument()
    })
    expect(activeRows()).toHaveLength(1)
    expect(itemsApi.updateItemStatus).toHaveBeenCalledWith('dni', 'done')
  })

  it('tocarla en «Fuera de la cabeza» la devuelve a pendiente', async () => {
    const user = userEvent.setup()
    vi.mocked(itemsApi.updateItemStatus).mockResolvedValue()
    const pendingBasura = { ...basura, status: 'pending' as const, completedAt: null }
    renderDetail('casa', [grifo, dni, basura], [grifo, dni, pendingBasura])

    const section = await screen.findByRole('region', { name: 'Fuera de la cabeza' })
    await user.click(within(section).getByRole('checkbox', { name: 'Sacar la basura' }))

    await waitFor(() => {
      expect(activeRows()).toHaveLength(3)
    })
    expect(screen.queryByRole('region', { name: 'Fuera de la cabeza' })).not.toBeInTheDocument()
    expect(itemsApi.updateItemStatus).toHaveBeenCalledWith('basura', 'pending')
  })

  it('«Pendientes» oculta «Fuera de la cabeza»; «Hechas» enseña solo lo terminado', async () => {
    const user = userEvent.setup()
    renderDetail('casa', [grifo, dni, basura])

    await user.click(await screen.findByRole('radio', { name: 'Pendientes' }))
    expect(activeRows()).toHaveLength(2)
    expect(screen.queryByRole('region', { name: 'Fuera de la cabeza' })).not.toBeInTheDocument()

    await user.click(screen.getByRole('radio', { name: 'Hechas' }))
    expect(screen.queryByRole('list', { name: 'Ítems' })).not.toBeInTheDocument()
    expect(within(outOfMind()).getByText('Sacar la basura')).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: 'Hechas' })).toHaveAttribute('aria-checked', 'true')
  })

  it('una lista recién creada enseña el vacío del diseño', async () => {
    renderDetail('casa', [])

    expect(await screen.findByText('Aún no hay nada aquí.')).toBeInTheDocument()
    expect(screen.getByText('Tareas · recién creada')).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'Primera tarea…' })).toHaveFocus()
    expect(screen.queryByRole('radiogroup')).not.toBeInTheDocument()
  })

  it('con todo hecho, la nota y lo hecho debajo', async () => {
    renderDetail('casa', [basura])

    expect(await screen.findByText('Todo fuera de la cabeza.')).toBeInTheDocument()
    expect(within(outOfMind()).getByText('Sacar la basura')).toBeInTheDocument()
  })

  it('sin red, añadir lo enseña al instante y se envía al volver la conexión', async () => {
    const user = userEvent.setup()
    vi.mocked(itemsApi.createItem).mockResolvedValue()
    renderDetail('casa', [grifo])
    const field = await screen.findByRole('textbox', { name: 'Añadir a Casa…' })

    onlineManager.setOnline(false)
    await user.type(field, 'Llamar al seguro{Enter}')

    expect(activeRows().at(-1)).toHaveTextContent('Llamar al seguro')
    expect(itemsApi.createItem).not.toHaveBeenCalled()

    onlineManager.setOnline(true)
    await waitFor(() => {
      expect(itemsApi.createItem).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Llamar al seguro' }),
      )
    })
  })
})

describe('detalle de «En mente»', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })
  afterEach(() => {
    setDesktop(false)
  })

  it('en escritorio también hay «‹ Listas» y el orden se cambia con un botón', async () => {
    const user = userEvent.setup()
    setDesktop(true)
    renderDetail('i', [dni, pilas])

    const back = await screen.findByRole('link', { name: 'Listas' })
    expect(back).toHaveAttribute('href', '/')
    expect(activeRows()[0]).toHaveTextContent('Comprar pilas AA')

    await user.click(screen.getByRole('button', { name: /Ordenar: más reciente/ }))
    expect(activeRows()[0]).toHaveTextContent('Renovar el DNI')
    expect(screen.getByRole('button', { name: /Ordenar: más antigua/ })).toBeInTheDocument()
  })

  const pilas = item('pilas', 'Comprar pilas AA', { listId: 'i', kind: 'note' })
  const dni = item('dni-i', 'Renovar el DNI', {
    listId: 'i',
    kind: 'note',
    createdAt: new Date(Date.now() - 20 * 24 * HOUR),
  })

  it('«En mente»: sin tipo a la izquierda, y «Añadir» captura lo escrito', async () => {
    const user = userEvent.setup()
    vi.mocked(itemsApi.createItem).mockResolvedValue()
    renderDetail('i', [dni])

    const field = await screen.findByRole('textbox', { name: '¿Qué tienes en mente?' })
    expect(screen.queryByRole('button', { name: /^Tipo: / })).not.toBeInTheDocument()
    const add = screen.getByRole('button', { name: 'Añadir' })
    expect(add).toBeDisabled()
    await user.type(field, 'Llamar al fontanero')
    expect(add).toBeEnabled()
    await user.click(add)

    await waitFor(() => {
      expect(itemsApi.createItem).toHaveBeenCalledWith(
        expect.objectContaining({ listId: 'i', title: 'Llamar al fontanero', kind: 'note' }),
      )
    })
    expect(field).toHaveValue('')
  })

  it('cabecera índigo sin menú, antigüedad de cada captura y filtros por antigüedad', async () => {
    const user = userEvent.setup()
    renderDetail('i', [dni, pilas])

    expect(await screen.findByRole('heading', { level: 1, name: 'En mente' })).toBeInTheDocument()
    expect(screen.getByText('Fijada')).toBeInTheDocument()
    expect(screen.getByText('2 cosas sin ordenar')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Opciones/ })).not.toBeInTheDocument()

    // La más reciente arriba, con su antigüedad.
    const [first, second] = activeRows()
    expect(first).toHaveTextContent('Comprar pilas AA')
    expect(first).toHaveTextContent('hace 2 h')
    expect(second).toHaveTextContent('Renovar el DNI')

    await user.click(screen.getByRole('radio', { name: 'Antiguas' }))
    expect(activeRows()).toHaveLength(1)
    expect(activeRows()[0]).toHaveTextContent('Renovar el DNI')

    expect(screen.getByRole('textbox', { name: '¿Qué tienes en mente?' })).toBeInTheDocument()
  })

  it('vacía: «Nada en mente.»', async () => {
    renderDetail('i', [])

    expect(await screen.findByText('Nada en mente.')).toBeInTheDocument()
    expect(screen.getByText('Nada sin ordenar')).toBeInTheDocument()
  })
})
