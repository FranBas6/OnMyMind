import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import * as itemsApi from '@/features/items/api'
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

let next = 0
function evento(title: string, overrides: Partial<Item> = {}): Item {
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

const sinFecha = evento('Cena de antiguos alumnos')
const dentista = evento('Dentista', { dueAt: at(9, 22, 10) })
const cumple = evento('Cumpleaños de Marta', {
  dueAt: at(9, 23),
  allDay: true,
  recurrence: 'yearly',
})
const cena = evento('Cena con los de la uni', { dueAt: at(8, 25, 21), recurrence: 'monthly' })
const boda = evento('Boda de Lucía y Pablo', { dueAt: at(11, 15), allDay: true })
const concierto = evento('Concierto', { dueAt: at(9, 12, 21, 30) })
const todos = [sinFecha, dentista, cumple, cena, boda, concierto]

function renderList(items: Item[], open?: string) {
  const lists = [base, agenda, trabajo]
  vi.mocked(listsApi.fetchLists).mockResolvedValue(lists)
  vi.mocked(listsApi.fetchArchivedLists).mockResolvedValue([])
  vi.mocked(itemsApi.fetchItems).mockReturnValue(new Promise(() => undefined))
  vi.mocked(itemsApi.updateItem).mockResolvedValue()
  vi.mocked(itemsApi.updateItemStatus).mockResolvedValue()
  return renderRoute(open ? `/lists/agenda?item=${open}` : '/lists/agenda', {
    session,
    seed: (queryClient) => {
      queryClient.setQueryData(queryKeys.lists.all, lists)
      queryClient.setQueryData(queryKeys.lists.archived, [])
      queryClient.setQueryData(queryKeys.items.byList('agenda'), items)
    },
  })
}

const detail = () => screen.findByRole('dialog', { name: /Detalle de/ })
const group = (name: string) => screen.getByRole('region', { name })
const titlesIn = (element: HTMLElement) =>
  within(element)
    .getAllByRole('button')
    .map((button) => button.textContent)
    .filter((text) => text && !text.includes('Opciones'))

describe('eventos (2.4, diseño 17)', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(NOW)
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('la lista va por días, con «Sin fecha» arriba, lo lejano por meses y lo pasado abajo', async () => {
    renderList(todos)

    // Lo que queda por llegar, también lo que aún no tiene día (como el contador de su tarjeta).
    expect(await screen.findByText('5 próximos')).toBeInTheDocument()
    const labels = screen
      .getAllByRole('heading', { level: 2 })
      .map((heading) => heading.textContent)
    expect(labels.slice(0, 5)).toEqual([
      'Sin fecha · 1 pendiente',
      'Hoy · Martes 22',
      'Mañana · Miércoles 23',
      'Viernes 25',
      'Noviembre',
    ])
    // «Sin fecha» empieza plegado (diseño 25, B10b).
    expect(within(group('Sin fecha')).queryByText('Poner día')).not.toBeInTheDocument()
    fireEvent.click(within(group('Sin fecha')).getByRole('button', { name: /Sin fecha/ }))
    expect(within(group('Sin fecha')).getByText('Poner día')).toBeInTheDocument()
    expect(within(group('Mañana · Miércoles 23')).getByText('Cada año')).toBeInTheDocument()
    expect(within(group('Viernes 25')).getByText('21:00')).toBeInTheDocument()
    // En un grupo de mes, la columna dice el día y la hora baja a la meta.
    expect(within(group('Noviembre')).getByText('Todo el día')).toBeInTheDocument()
    // Lo de hoy cuya hora pasó sigue en «Hoy»; lo de hace diez días, en «Fuera de la cabeza».
    expect(within(group('Hoy · Martes 22')).getByText('Dentista')).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Fuera de la cabeza' })).toHaveTextContent('· 1')
  })

  it('los filtros: lo que ya pasó, lo más reciente arriba, y lo cancelado, con su vacío', async () => {
    const user = userEvent.setup()
    renderList(todos)

    await user.click(await screen.findByRole('radio', { name: 'Pasados' }))
    expect(titlesIn(group('Hoy · Martes 22'))).toEqual(['Dentista'])
    expect(titlesIn(group('Septiembre'))).toEqual(['Concierto'])

    await user.click(screen.getByRole('radio', { name: 'Cancelados' }))
    expect(screen.getByText('Nada cancelado.')).toBeInTheDocument()
  })

  it('sin día, «Añadir día» abre «Cuándo»: un día nuevo es de todo el día', async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 })
    renderList(todos, sinFecha.id)
    const sheet = await detail()

    expect(
      within(sheet).getByText('Sin día sale arriba en su lista, en «Sin fecha», y no llega a Hoy.'),
    ).toBeInTheDocument()
    await user.click(within(sheet).getByRole('button', { name: /Añadir día/ }))
    await user.click(await screen.findByRole('button', { name: 'Mañana' }))

    await waitFor(() => {
      expect(itemsApi.updateItem).toHaveBeenCalledWith(sinFecha.id, {
        dueAt: at(9, 23),
        allDay: true,
      })
    })
  })

  it('la hora, «Todo el día» y la repetición', async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 })
    renderList(todos, cena.id)
    const sheet = await detail()

    expect(within(sheet).getByText('Viernes 25 sep')).toBeInTheDocument()
    expect(within(sheet).getByText('Siguiente: domingo 25 oct')).toBeInTheDocument()

    fireEvent.change(within(sheet).getByLabelText('Hora'), { target: { value: '21:30' } })
    await waitFor(() => {
      expect(itemsApi.updateItem).toHaveBeenLastCalledWith(cena.id, {
        dueAt: at(8, 25, 21, 30),
        allDay: false,
      })
    })

    await user.click(within(sheet).getByRole('switch', { name: 'Todo el día' }))
    await waitFor(() => {
      expect(itemsApi.updateItem).toHaveBeenLastCalledWith(cena.id, {
        dueAt: at(8, 25),
        allDay: true,
      })
    })

    await user.click(within(sheet).getByRole('button', { name: /Repetir/ }))
    // La hoja anidada de vaul aún se está abriendo: sus opciones salen como ocultas.
    const repeat = await screen.findByRole('radiogroup', { name: 'Repetir', hidden: true })
    // Las de siempre, con lo que significan ese día (diseño 21, B3): «Semanal» y «los viernes».
    const weekly = within(repeat).getByText((_, element) =>
      element?.getAttribute('role') === 'radio'
        ? element.textContent.startsWith('Semanallos ')
        : false,
    )
    await user.click(weekly)
    // Y guardan su día escrito (3.6): «BYDAY=FR».
    await waitFor(() => {
      expect(itemsApi.updateItem).toHaveBeenLastCalledWith(cena.id, {
        recurrence: expect.stringMatching(/^FREQ=WEEKLY;BYDAY=[A-Z]{2}$/) as string,
      })
    })
  })

  it('quitar la fecha avisa y se deshace', async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 })
    renderList(todos, dentista.id)
    const sheet = await detail()

    await user.click(within(sheet).getByRole('button', { name: /Día/ }))
    await user.click(await screen.findByRole('button', { name: 'Quitar fecha' }))
    await waitFor(() => {
      expect(itemsApi.updateItem).toHaveBeenCalledWith(dentista.id, {
        dueAt: null,
        allDay: false,
        recurrence: null,
      })
    })
    expect(await screen.findByText('Fecha quitada')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Deshacer' }))
    await waitFor(() => {
      expect(itemsApi.updateItem).toHaveBeenLastCalledWith(dentista.id, {
        dueAt: at(9, 22, 10),
        allDay: false,
        recurrence: null,
      })
    })
  })

  it('lo pasado lo dice y no deja volver a Próximo; cancelar avisa y se deshace', async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 })
    renderList(todos, concierto.id)
    const sheet = await detail()

    expect(within(sheet).getByText('Fue el sábado 12 a las 21:30.')).toBeInTheDocument()
    const estado = within(sheet).getByRole('radiogroup', { name: 'Estado' })
    expect(within(estado).getByRole('radio', { name: 'Pasado' })).toHaveAttribute(
      'aria-checked',
      'true',
    )
    expect(within(estado).getByRole('radio', { name: 'Próximo' })).toBeDisabled()

    await user.click(within(estado).getByRole('radio', { name: 'Cancelado' }))
    await waitFor(() => {
      expect(itemsApi.updateItem).toHaveBeenCalledWith(concierto.id, { status: 'cancelled' })
    })
    expect(await screen.findByText('Evento cancelado')).toBeInTheDocument()
  })

  it('en Hoy, «Agenda» arriba con los eventos de hoy, también los que se repiten', async () => {
    const lists = [base, agenda, trabajo]
    const standUp = evento('Stand-up', {
      listId: 'trabajo',
      dueAt: at(9, 1, 9, 30),
      recurrence: 'daily',
    })
    vi.mocked(listsApi.fetchLists).mockResolvedValue(lists)
    vi.mocked(listsApi.fetchArchivedLists).mockResolvedValue([])
    vi.mocked(todayApi.fetchToday).mockResolvedValue([dentista, standUp, cumple])
    renderRoute('/today', {
      session,
      seed: (queryClient) => {
        queryClient.setQueryData(queryKeys.lists.all, lists)
        queryClient.setQueryData(queryKeys.lists.archived, [])
      },
    })

    const section = await screen.findByRole('region', { name: 'Agenda' })
    expect(titlesIn(section)).toEqual(['Stand-up', 'Dentista'])
    expect(within(section).getByText('Trabajo')).toBeInTheDocument()
    expect(within(section).getByText('Cada día')).toBeInTheDocument()
  })
})
