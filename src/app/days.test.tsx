import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { Item } from '@/features/items'
import * as listsApi from '@/features/lists/api'
import type { List } from '@/features/lists'
import * as todayApi from '@/features/today/api'
import { queryKeys } from '@/lib/queryKeys'
import { fakeSession, renderRoute } from '@/test/render-route'

vi.mock('@/features/items/api')
vi.mock('@/features/lists/api')
vi.mock('@/features/today/api')

const session = fakeSession()
// Martes 22 de septiembre de 2026, a mediodía (solo se finge la fecha: los temporizadores van).
const NOW = new Date(2026, 8, 22, 12, 30)
const at = (month: number, day: number, hours = 0, minutes = 0) =>
  new Date(2026, month - 1, day, hours, minutes)

const base: List = {
  id: 'i',
  name: 'En mente',
  color: 'indigo',
  icon: null,
  kind: 'inbox',
  view: 'list',
  position: 1000,
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
}
const agenda: List = {
  ...base,
  id: 'agenda',
  name: 'Agenda',
  color: 'amber',
  kind: 'events',
  view: 'agenda',
}
const trabajo: List = { ...base, id: 'trabajo', name: 'Trabajo', color: 'pink', kind: 'tasks' }
const regalos: List = { ...base, id: 'regalos', name: 'Regalos', color: 'green', kind: 'tasks' }
const lists = [base, agenda, trabajo, regalos]

let next = 0
function item(title: string, overrides: Partial<Item> = {}): Item {
  next += 1
  return {
    id: `00000000-0000-4000-8000-${String(next).padStart(12, '0')}`,
    listId: 'agenda',
    kind: 'event',
    parentId: null,
    chooseOne: false,
    chosenId: null,
    sealed: null,
    title,
    notes: null,
    status: 'upcoming',
    priority: null,
    dueAt: null,
    allDay: false,
    recurrence: null,
    position: next * 1000,
    completedAt: null,
    createdAt: at(9, 3),
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

const dentista = item('Dentista', { dueAt: at(9, 24, 10) })
const yoga = item('Yoga', { dueAt: at(9, 3, 19), recurrence: 'weekly' })
const cumple = item('Cumpleaños de Marta', {
  dueAt: at(10, 23),
  allDay: true,
  recurrence: 'yearly',
})
const demo = item('Preparar la demo', {
  listId: 'trabajo',
  kind: 'task',
  status: 'pending',
  dueAt: at(9, 24),
  allDay: true,
  priority: 'high',
})
const concierto = item('Concierto', { dueAt: at(9, 18, 21, 30) })
const regalo = item('Comprar el regalo de Leo', {
  listId: 'regalos',
  kind: 'task',
  status: 'done',
  completedAt: at(9, 18, 10),
})
const idea = item('Ideas para la fiesta', {
  listId: 'regalos',
  kind: 'note',
  dueAt: null,
  createdAt: at(9, 18, 9, 5),
})
const all = [dentista, yoga, cumple, demo, concierto, regalo, idea]

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

function renderToday(path = '/today') {
  vi.mocked(listsApi.fetchLists).mockResolvedValue(lists)
  vi.mocked(listsApi.fetchArchivedLists).mockResolvedValue([])
  vi.mocked(todayApi.fetchToday).mockResolvedValue([])
  // La consulta de verdad filtra por fechas; aquí trae todo y `groupDay` elige lo del día.
  vi.mocked(todayApi.fetchDays).mockResolvedValue(all)
  return renderRoute(path, {
    session,
    seed: (queryClient) => {
      queryClient.setQueryData(queryKeys.lists.all, lists)
      queryClient.setQueryData(queryKeys.lists.archived, [])
    },
  })
}

const title = () => screen.getByRole('heading', { level: 1 })
const agendaTitles = () =>
  within(screen.getByRole('list', { name: 'Agenda' }))
    .getAllByRole('button')
    .map((button) => button.textContent)
    .filter((text) => text && !text.includes('Opciones'))

describe('cualquier día en Hoy (2.5, diseño 17)', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    setDesktop(false)
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(NOW)
  })
  afterEach(() => {
    vi.useRealTimers()
    setDesktop(false)
  })

  it('desde la tira, el jueves que viene: sus eventos, también los que se repiten, y lo que vence', async () => {
    const user = userEvent.setup()
    const { router } = renderToday()

    expect(await screen.findByText('Nada en mente para hoy.')).toBeInTheDocument()
    const thursday = await screen.findByRole('button', {
      name: 'Jueves 24 de septiembre, con cosas',
    })
    expect(screen.getByRole('button', { name: /^Martes 22 de septiembre/ })).toHaveAttribute(
      'aria-current',
      'date',
    )
    await user.click(thursday)

    expect(title()).toHaveTextContent('Jueves 24')
    expect(screen.getByText('Hoy es martes 22 · dentro de 2 días')).toBeInTheDocument()
    expect(router.state.location.search).toEqual({ day: '2026-09-24' })
    expect(agendaTitles()).toEqual(['Dentista', 'Yoga'])
    const section = screen.getByRole('list', { name: 'Trabajo' })
    expect(within(section).getByText('Preparar la demo')).toBeInTheDocument()
    expect(within(section).getByText('Vence ese día · Prioridad alta')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Volver a hoy' }))
    expect(title()).toHaveTextContent('Hoy')
    expect(router.state.location.search).toEqual({})
  })

  it('el mes entero para saltar lejos: el cumpleaños del mes que viene', async () => {
    const user = userEvent.setup()
    renderToday()

    await user.click(await screen.findByRole('button', { name: /Septiembre: ver el mes entero/ }))
    expect(screen.getByRole('heading', { name: 'Septiembre 2026' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Mes siguiente' }))
    await user.click(
      await screen.findByRole('button', { name: 'Viernes 23 de octubre, con cosas' }),
    )

    expect(title()).toHaveTextContent('Viernes 23 oct')
    expect(screen.getByText('Hoy es martes 22 sep')).toBeInTheDocument()
    expect(agendaTitles()).toEqual(['Cumpleaños de Marta'])
    // El mes sigue abierto hasta plegarlo.
    await user.click(screen.getByRole('button', { name: 'Plegar el mes' }))
    expect(screen.getByRole('list', { name: /^Semana del 19 de octubre/ })).toBeInTheDocument()
  })

  it('un día pasado: sus eventos, «Hecho ese día» y «Apuntado ese día», con la hora', async () => {
    renderToday('/today?day=2026-09-18')

    expect(await screen.findByRole('list', { name: 'Hecho ese día' })).toHaveTextContent(
      'Comprar el regalo de Leo',
    )
    expect(title()).toHaveTextContent('Viernes 18')
    expect(screen.getByText('Hoy es martes 22 · hace 4 días')).toBeInTheDocument()
    expect(agendaTitles()).toEqual(['Concierto'])
    expect(screen.getByRole('list', { name: 'Hecho ese día' })).toHaveTextContent('Regalos · 10:00')
    // La nota apuntada ese día, sin tachar, con su lista y la hora (Fran, 2026-10-22).
    const noted = screen.getByRole('list', { name: 'Apuntado ese día' })
    expect(noted).toHaveTextContent('Ideas para la fiesta')
    expect(noted).toHaveTextContent('Regalos · 9:05')
  })

  it('un día que viene sin nada', async () => {
    renderToday('/today?day=2026-09-26')
    expect(await screen.findByText('Nada para el sábado 26.')).toBeInTheDocument()
    expect(screen.getByText('Lo que tenga ese día como fecha saldrá aquí.')).toBeInTheDocument()
  })

  it('en escritorio, el mes al lado, ‹ › y las teclas ← → y T', async () => {
    setDesktop(true)
    const user = userEvent.setup()
    renderToday()

    const aside = await screen.findByRole('complementary', { name: 'Calendario' })
    expect(within(aside).getByText(/← → cambian de día; T vuelve a hoy/)).toBeInTheDocument()
    await user.keyboard('{ArrowRight}{ArrowRight}')
    await waitFor(() => {
      expect(title()).toHaveTextContent('Jueves 24')
    })
    expect(agendaTitles()).toEqual(['Dentista', 'Yoga'])
    await user.click(screen.getByRole('button', { name: 'Día anterior' }))
    expect(title()).toHaveTextContent('Miércoles 23')
    await user.keyboard('t')
    await waitFor(() => {
      expect(title()).toHaveTextContent('Hoy')
    })
    await user.click(within(aside).getByRole('button', { name: /^Viernes 18 de septiembre/ }))
    expect(await screen.findByRole('list', { name: 'Hecho ese día' })).toBeInTheDocument()
    expect(within(aside).getByRole('button', { name: 'Volver a hoy' })).toBeInTheDocument()
  })
})
