import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import * as itemsApi from '@/features/items/api'
import type { Item } from '@/features/items'
import * as listsApi from '@/features/lists/api'
import type { List } from '@/features/lists'
import * as profileApi from '@/features/profile/api'
import { queryKeys } from '@/lib/queryKeys'
import { fakeSession, renderRoute, testProfile } from '@/test/render-route'

vi.mock('@/features/items/api')
vi.mock('@/features/lists/api')
vi.mock('@/features/profile/api')

const session = fakeSession()
const DAY = 24 * 60 * 60 * 1000

function list(id: string, name: string, overrides: Partial<List> = {}): List {
  return {
    id,
    name,
    color: 'amber',
    icon: null,
    kind: 'list',
    view: 'list',
    position: 2000,
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
    ...overrides,
  }
}

function item(id: string, title: string, overrides: Partial<Item> = {}): Item {
  return {
    id,
    listId: 'agenda',
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
// «Agenda» del diseño 25 (B10): dos eventos, una tarea con fecha y una nota.
const agenda = list('agenda', 'Agenda', {
  kind: 'events',
  view: 'agenda',
  counters: {
    pending: 3,
    done: 0,
    pendingPriceCents: 0,
    notes: 1,
    kinds: { note: 1, task: 1, shopping: 0, event: 2 },
  },
})
const dentista = item('dentista', 'Dentista', {
  kind: 'event',
  status: 'upcoming',
  dueAt: new Date(Date.now() + 3 * DAY),
  position: 1000,
})
const preguntar = item('preguntar', 'Qué preguntar al dentista', {
  kind: 'note',
  notes: 'El empaste de abajo',
  position: 2000,
})
const itv = item('itv', 'Pedir cita para la ITV', {
  dueAt: new Date(Date.now() + 4 * DAY),
  position: 3000,
})
const cena = item('cena', 'Cena con Marta', {
  kind: 'event',
  status: 'upcoming',
  dueAt: new Date(Date.now() + 5 * DAY),
  position: 4000,
})

/** Abre una pantalla con las listas y sus ítems ya en caché; el servidor no contesta. */
function renderAt(path: string, lists: List[], items: Record<string, Item[]> = {}) {
  vi.mocked(listsApi.fetchLists).mockResolvedValue(lists)
  vi.mocked(listsApi.fetchArchivedLists).mockResolvedValue([])
  vi.mocked(listsApi.updateListView).mockResolvedValue()
  vi.mocked(itemsApi.fetchItems).mockReturnValue(new Promise(() => undefined))
  vi.mocked(itemsApi.fetchMovedFromInbox).mockResolvedValue([])
  vi.mocked(profileApi.fetchProfile).mockResolvedValue(testProfile(session.user.id))
  return renderRoute(path, {
    session,
    seed: (queryClient) => {
      queryClient.setQueryData(queryKeys.lists.all, lists)
      queryClient.setQueryData(queryKeys.lists.archived, [])
      for (const [listId, entries] of Object.entries(items)) {
        queryClient.setQueryData(queryKeys.items.byList(listId), entries)
      }
    },
  })
}

describe('listas sin tipo en la app (5.5, diseño 25)', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('las tarjetas de Inicio dicen lo pendiente y las notas, sin el tipo (B9)', async () => {
    const casa = list('casa', 'Casa', {
      counters: {
        pending: 3,
        done: 2,
        pendingPriceCents: 1299,
        notes: 1,
        kinds: { note: 1, task: 1, shopping: 1, event: 1 },
      },
    })
    const ideas = list('ideas', 'Ideas', {
      position: 3000,
      counters: {
        pending: 0,
        done: 0,
        pendingPriceCents: 0,
        notes: 6,
        kinds: { note: 6, task: 0, shopping: 0, event: 0 },
      },
    })
    const nueva = list('nueva', 'Nueva', { position: 4000 })
    renderAt('/', [inbox, casa, ideas, nueva])

    const grid = await screen.findByRole('list', { name: 'Mis listas' })
    const card = (name: string) => within(grid).getByRole('link', { name: new RegExp(name) })
    expect(card('Casa')).toHaveTextContent('3 pendientes · 1 nota')
    expect(card('Casa')).toHaveTextContent('12,99 €')
    expect(card('Casa')).not.toHaveTextContent('Lista')
    expect(card('Ideas')).toHaveTextContent('6 notas')
    expect(card('Nueva')).toHaveTextContent('Lista recién creada')
  })

  it('una lista sin eventos no tiene «Lista · Agenda»', async () => {
    const casa = list('casa', 'Casa')
    renderAt('/lists/casa', [inbox, casa], { casa: [item('fontanero', 'Llamar al fontanero')] })

    expect(await screen.findByText('Llamar al fontanero')).toBeInTheDocument()
    expect(screen.getByText('1 pendiente')).toBeInTheDocument()
    expect(screen.queryByRole('radiogroup', { name: 'Ver como' })).not.toBeInTheDocument()
  })

  it('«Agenda» va por días con «Sin fecha» plegado, y «Lista» la enseña en filas y se recuerda (B10)', async () => {
    const user = userEvent.setup()
    renderAt('/lists/agenda', [inbox, agenda], { agenda: [dentista, preguntar, itv, cena] })

    expect(await screen.findByText('2 próximos · 1 pendiente · 1 nota')).toBeInTheDocument()
    const views = screen.getByRole('radiogroup', { name: 'Ver como' })
    expect(within(views).getByRole('radio', { name: 'Agenda' })).toBeChecked()

    // Lo que no tiene día, arriba y plegado; la tarea con fecha, en su día.
    const undated = screen.getByRole('region', { name: 'Sin fecha' })
    expect(within(undated).getByRole('button', { name: 'Sin fecha · 1 nota' })).toHaveAttribute(
      'aria-expanded',
      'false',
    )
    expect(screen.queryByText('Qué preguntar al dentista')).not.toBeInTheDocument()
    expect(screen.getByText('Pedir cita para la ITV')).toBeInTheDocument()
    await user.click(within(undated).getByRole('button', { name: 'Sin fecha · 1 nota' }))
    expect(within(undated).getByText('Qué preguntar al dentista')).toBeInTheDocument()

    await user.click(within(views).getByRole('radio', { name: 'Lista' }))
    expect(within(views).getByRole('radio', { name: 'Lista' })).toBeChecked()
    // En filas, en el orden de la lista, y con los mismos contadores.
    expect(screen.queryByRole('region', { name: 'Sin fecha' })).not.toBeInTheDocument()
    const rows = within(screen.getByRole('list', { name: 'Ítems' })).getAllByRole('listitem')
    expect(rows[0]).toHaveTextContent('Dentista')
    expect(rows[1]).toHaveTextContent('Qué preguntar al dentista')
    expect(screen.getByText('2 próximos · 1 pendiente · 1 nota')).toBeInTheDocument()
    await waitFor(() => {
      expect(listsApi.updateListView).toHaveBeenCalledWith('agenda', 'list')
    })
  })

  it('en una lista compartida contigo, la vista cambia pero no se guarda', async () => {
    const user = userEvent.setup()
    const shared = { ...agenda, isOwner: false }
    renderAt('/lists/agenda', [inbox, shared], { agenda: [dentista, preguntar] })

    const views = await screen.findByRole('radiogroup', { name: 'Ver como' })
    await user.click(within(views).getByRole('radio', { name: 'Lista' }))
    expect(within(views).getByRole('radio', { name: 'Lista' })).toBeChecked()
    expect(screen.getByText('Qué preguntar al dentista')).toBeInTheDocument()
    expect(listsApi.updateListView).not.toHaveBeenCalled()
  })
})
