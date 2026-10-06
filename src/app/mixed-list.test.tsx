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
  informe: '00000000-0000-4000-8000-000000000001',
  reunion: '00000000-0000-4000-8000-000000000002',
  soporte: '00000000-0000-4000-8000-000000000003',
  cable: '00000000-0000-4000-8000-000000000004',
  demo: '00000000-0000-4000-8000-000000000005',
}

const inbox: List = {
  id: 'i',
  name: 'En mente',
  color: 'indigo',
  icon: null,
  kind: 'inbox',
  position: 1000,
  counters: { pending: 0, done: 0, pendingPriceCents: 0 },
  archivedAt: null,
  isOwner: true,
}
const trabajo: List = { ...inbox, id: 'trabajo', name: 'Trabajo', color: 'pink', kind: 'tasks' }

function item(id: string, title: string, overrides: Partial<Item> = {}): Item {
  return {
    id,
    listId: 'trabajo',
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
    priceLinkId: null,
    priceStore: null,
    ...overrides,
  }
}

// «Trabajo» del diseño 12 (T1): tareas, un evento con hora, una compra y una compra ya hecha.
const informe = item(ID.informe, 'Enviar informe trimestral', { priority: 'high' })
const reunion = item(ID.reunion, 'Reunión con el equipo de diseño', {
  kind: 'event',
  status: 'upcoming',
  dueAt: new Date(Date.now() + DAY),
  position: 2000,
})
const soporte = item(ID.soporte, 'Soporte para el portátil', {
  kind: 'shopping',
  position: 3000,
})
const cable = item(ID.cable, 'Cable HDMI', {
  kind: 'shopping',
  status: 'bought',
  completedAt: new Date(Date.now() - DAY),
  position: 4000,
})
const demo = item(ID.demo, 'Preparar la demo del jueves', {
  priority: 'medium',
  dueAt: new Date(Date.now() + 3 * DAY),
  position: 5000,
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

function renderTrabajo(items: Item[] = [informe, reunion, soporte, cable, demo], path = '') {
  const lists = [inbox, { ...trabajo, counters: { pending: 4, done: 1, pendingPriceCents: 0 } }]
  vi.mocked(listsApi.fetchLists).mockResolvedValue(lists)
  vi.mocked(listsApi.fetchArchivedLists).mockResolvedValue([])
  vi.mocked(itemsApi.fetchItems).mockReturnValue(new Promise(() => undefined))
  return renderRoute(`/lists/trabajo${path}`, {
    session,
    seed: (queryClient) => {
      queryClient.setQueryData(queryKeys.lists.all, lists)
      queryClient.setQueryData(queryKeys.lists.archived, [])
      queryClient.setQueryData(queryKeys.items.byList('trabajo'), items)
    },
  })
}

const activeRows = () =>
  within(screen.getByRole('list', { name: 'Ítems' })).getAllByRole('listitem')
const outOfMind = () => screen.getByRole('region', { name: 'Fuera de la cabeza' })

describe('lista con tipos mezclados (diseño 12)', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })
  afterEach(() => {
    setDesktop(false)
  })

  it('cada fila con el control y la meta de su tipo', async () => {
    renderTrabajo()

    expect(await screen.findByRole('heading', { level: 1, name: 'Trabajo' })).toBeInTheDocument()
    expect(screen.getByText('4 pendientes · 1 hecha')).toBeInTheDocument()
    const [first, second, third] = activeRows()
    if (!first || !second || !third) throw new Error('faltan filas')

    // La tarea, con su checkbox y su chip de prioridad.
    expect(within(first).getByRole('checkbox', { name: 'Enviar informe trimestral' })).toBeVisible()
    expect(first).toHaveTextContent('Alta')
    // El evento, sin checkbox: su calendario, y el día con la hora.
    expect(within(second).queryByRole('checkbox')).not.toBeInTheDocument()
    expect(within(second).getByRole('img', { name: 'Evento' })).toBeInTheDocument()
    expect(second).toHaveTextContent(/Mañana · \d{2}:\d{2}/)
    // La compra, con su cuadrado y la marca de tipo porque Trabajo es de tareas.
    const box = within(third).getByRole('checkbox', { name: 'Soporte para el portátil' })
    expect(box).toHaveClass('rounded-[7px]')
    expect(third).toHaveTextContent('Compra')

    // La compra hecha dice cómo terminó.
    expect(within(outOfMind()).getByText('Cable HDMI · Comprado')).toBeInTheDocument()
  })

  it('una lista de un solo tipo no enseña marcas de tipo', async () => {
    renderTrabajo([informe, demo])

    await screen.findByRole('heading', { level: 1, name: 'Trabajo' })
    for (const row of activeRows()) {
      expect(row).not.toHaveTextContent(/Compra|Evento|Tarea/)
    }
  })

  it('los filtros separan lo pendiente de lo hecho, sea del tipo que sea', async () => {
    const user = userEvent.setup()
    renderTrabajo()

    await user.click(await screen.findByRole('radio', { name: 'Pendientes' }))
    expect(activeRows()).toHaveLength(4)
    expect(screen.queryByText('Cable HDMI · Comprado')).not.toBeInTheDocument()

    await user.click(screen.getByRole('radio', { name: 'Hechas' }))
    expect(within(outOfMind()).getByText('Cable HDMI · Comprado')).toBeInTheDocument()
    expect(screen.queryByText('Enviar informe trimestral')).not.toBeInTheDocument()
  })

  it('el tipo de la izquierda se cambia; la compra nace como compra pendiente con «Añadir»', async () => {
    const user = userEvent.setup()
    vi.mocked(itemsApi.createItem).mockResolvedValue()
    renderTrabajo()

    const field = await screen.findByRole('textbox', { name: 'Añadir a Trabajo…' })
    // Sin texto, «Añadir» está en gris.
    expect(screen.getByRole('button', { name: 'Añadir' })).toBeDisabled()
    await user.click(screen.getByRole('button', { name: 'Tipo: Tarea. Cambiar' }))
    const picker = await screen.findByRole('radiogroup', { name: 'Añadir a Trabajo' })
    expect(within(picker).getByRole('radio', { name: /Tarea/ })).toHaveAttribute(
      'aria-checked',
      'true',
    )
    expect(within(picker).getByText('Por defecto')).toBeInTheDocument()
    await user.click(within(picker).getByRole('radio', { name: /Compra/ }))

    expect(await screen.findByRole('button', { name: 'Tipo: Compra. Cambiar' })).toBeVisible()
    await user.type(field, 'Monitor para casa')
    // Se añade con el botón, sin tener que saber lo de Intro.
    await user.click(screen.getByRole('button', { name: 'Añadir' }))

    await waitFor(() => {
      expect(itemsApi.createItem).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Monitor para casa',
          kind: 'shopping',
          status: 'pending',
        }),
      )
    })
    // Tras guardar vuelve al tipo por defecto, y el campo se queda vacío y con «Añadir» en gris.
    expect(screen.getByRole('button', { name: 'Tipo: Tarea. Cambiar' })).toBeVisible()
    expect(field).toHaveValue('')
    expect(screen.getByRole('button', { name: 'Añadir' })).toBeDisabled()
  })

  it('en escritorio, «@ » delante crea un evento', async () => {
    setDesktop(true)
    const user = userEvent.setup()
    vi.mocked(itemsApi.createItem).mockResolvedValue()
    renderTrabajo()

    const field = await screen.findByRole('textbox', { name: 'Añadir a Trabajo…' })
    await user.type(field, '@ Dentista')
    expect(screen.getByRole('button', { name: 'Tipo: Evento. Cambiar' })).toBeVisible()
    await user.type(field, '{Enter}')

    await waitFor(() => {
      expect(itemsApi.createItem).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Dentista', kind: 'event', status: 'upcoming' }),
      )
    })
  })

  it('convertir una tarea en compra: avisa de lo que se pierde y cambia su fila', async () => {
    const user = userEvent.setup()
    vi.mocked(itemsApi.updateItem).mockResolvedValue()
    renderTrabajo(undefined, `?item=${ID.informe}`)

    const sheet = await screen.findByRole('dialog', { name: /Detalle de «Enviar informe/ })
    await user.click(within(sheet).getByRole('button', { name: /^Tipo/ }))
    const kinds = await screen.findByRole('radiogroup', { name: 'Tipo del ítem' })
    expect(screen.getByRole('button', { name: 'Elige un tipo' })).toBeDisabled()

    await user.click(within(kinds).getByRole('radio', { name: /Compra/ }))
    expect(
      screen.getByText(
        'Al pasar a Compra se quita la prioridad. Pendiente sigue siendo Pendiente.',
      ),
    ).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Cambiar a Compra' }))

    expect(itemsApi.updateItem).toHaveBeenCalledWith(ID.informe, {
      kind: 'shopping',
      status: 'pending',
      priority: null,
    })
    // La fila ya es de compra: cuadrado, sin la prioridad y con su marca (detrás de la hoja).
    const row = () =>
      within(screen.getByRole('list', { name: 'Ítems', hidden: true })).getAllByRole('listitem', {
        hidden: true,
      })[0]
    await waitFor(() => {
      expect(
        within(row() ?? document.body).getByRole('checkbox', {
          name: 'Enviar informe trimestral',
          hidden: true,
        }),
      ).toHaveClass('rounded-[7px]')
    })
    expect(row()).not.toHaveTextContent('Alta')
    expect(row()).toHaveTextContent('Compra')
  })
})
