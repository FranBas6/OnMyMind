import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { addDays, addMonths, format, startOfDay } from 'date-fns'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { Item } from '@/features/items'
import * as itemsApi from '@/features/items/api'
import * as listsApi from '@/features/lists/api'
import type { List } from '@/features/lists'
import * as todayApi from '@/features/today/api'
import { queryKeys } from '@/lib/queryKeys'
import { fakeSession, renderRoute } from '@/test/render-route'
import { lineText } from '@/test/text'

vi.mock('@/features/items/api')
vi.mock('@/features/lists/api')
vi.mock('@/features/today/api')

const session = fakeSession()
const today = startOfDay(new Date())

function list(id: string, name: string, overrides: Partial<List> = {}): List {
  return {
    id,
    name,
    color: 'amber',
    icon: null,
    kind: 'shopping',
    view: 'list',
    position: 2000,
    counters: {
      pending: 1,
      done: 0,
      pendingPriceCents: 0,
      payments: 0,
      trials: 0,
      yearlyCents: null,
      onceCents: 0,
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
    listId: 'gastos',
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
    trial: false,
    autoPay: true,
    position: 1000,
    completedAt: null,
    createdAt: addDays(today, -10),
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
const gastos = list('gastos', 'Gastos', {
  counters: {
    pending: 3,
    done: 0,
    pendingPriceCents: 6299,
    payments: 3,
    trials: 1,
    yearlyCents: 18000,
    onceCents: 0,
    notes: 0,
    kinds: { note: 0, task: 0, shopping: 3, event: 0 },
  },
})
const lists = [inbox, gastos]
const netflix = item('5a0c3e0e-1f7e-4d59-9a39-1c3b9f7a0c01', 'Netflix', {
  kind: 'shopping',
  dueAt: addDays(today, 18),
  recurrence: 'FREQ=MONTHLY',
  priceCents: 1299,
  priceSource: 'manual',
})
const spotify = item('5a0c3e0e-1f7e-4d59-9a39-1c3b9f7a0c02', 'Spotify', {
  kind: 'shopping',
  // Se paga a mano (6.5): sale en Hoy.
  autoPay: false,
  dueAt: today,
  recurrence: 'FREQ=MONTHLY',
  priceCents: 1001,
  priceSource: 'manual',
})
const disney = item('5a0c3e0e-1f7e-4d59-9a39-1c3b9f7a0c03', 'Disney+', {
  kind: 'shopping',
  dueAt: addDays(today, 5),
  recurrence: 'FREQ=MONTHLY',
  trial: true,
  priceCents: 899,
  priceSource: 'manual',
})
const cascos = item('5a0c3e0e-1f7e-4d59-9a39-1c3b9f7a0c04', 'Auriculares', {
  kind: 'shopping',
  dueAt: null,
  allDay: false,
  priceCents: 27900,
  priceSource: 'manual',
})

function renderAt(path: string, items: Item[]) {
  vi.mocked(listsApi.fetchLists).mockResolvedValue(lists)
  vi.mocked(listsApi.fetchArchivedLists).mockResolvedValue([])
  vi.mocked(itemsApi.fetchItems).mockResolvedValue(items)
  vi.mocked(itemsApi.fetchMovedFromInbox).mockResolvedValue([])
  vi.mocked(itemsApi.fetchCompletions).mockResolvedValue([])
  vi.mocked(itemsApi.fetchListPayments).mockResolvedValue([
    {
      id: 'p1',
      itemId: netflix.id,
      paidAt: addMonths(today, -1),
      paidBy: null,
      priceCents: 1299,
      currency: 'EUR',
      auto: false,
    },
  ])
  vi.mocked(itemsApi.updateItem).mockResolvedValue()
  vi.mocked(itemsApi.updateItemStatus).mockResolvedValue()
  vi.mocked(itemsApi.undoRepeat).mockResolvedValue()
  return renderRoute(path, {
    session,
    seed: (queryClient) => {
      queryClient.setQueryData(queryKeys.lists.all, lists)
      queryClient.setQueryData(queryKeys.lists.archived, [])
      queryClient.setQueryData(queryKeys.items.byList('gastos'), items)
    },
  })
}

describe('pagos que se repiten (6.4, diseño 30)', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('la lista: «Al mes» en vez de «Total», cuántos pagos y la fila de cada uno (L1)', async () => {
    renderAt('/lists/gastos', [netflix, spotify, disney])

    // 12,99 + 10,01 al mes; la prueba aún no cuenta.
    expect(await screen.findByText('Al mes')).toBeInTheDocument()
    expect(screen.getByText('23 €')).toBeInTheDocument()
    expect(screen.getByText('276 € al año')).toBeInTheDocument()
    expect(screen.getByText('3 pagos · 1 en prueba')).toBeInTheDocument()
    expect(
      screen.getByText('Prueba · cobra desde el ' + format(disney.dueAt ?? today, 'd'), {
        exact: false,
      }),
    ).toBeInTheDocument()
    // Netflix se cobra solo (6.5); Spotify se paga a mano, y vence hoy.
    expect(screen.getByText(/^Se cobra el /)).toBeInTheDocument()
    expect(screen.getByText('Cada mes · el ' + format(today, 'd'))).toBeInTheDocument()
  })

  it('la ficha: la caja «Pago», el historial y, sin «Estado», «Darse de baja» (F1)', async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 })
    renderAt(`/lists/gastos?item=${netflix.id}`, [netflix])
    const sheet = await screen.findByRole('dialog', { name: /Detalle de «Netflix/ })

    expect(within(sheet).getByText('cada mes')).toBeInTheDocument()
    expect(within(sheet).getByRole('button', { name: /Fecha de pago/ })).toBeInTheDocument()
    expect(within(sheet).getByRole('button', { name: /Repetir.*Cada mes/ })).toBeInTheDocument()
    expect(within(sheet).getByRole('switch', { name: 'Es una prueba' })).toBeInTheDocument()
    expect(
      await within(sheet).findByText(lineText(`Pagado · ${format(addMonths(today, -1), 'd MMM')}`)),
    ).toBeInTheDocument()
    expect(within(sheet).queryByText('Estado')).not.toBeInTheDocument()

    await user.click(within(sheet).getByRole('button', { name: 'Darse de baja' }))
    expect(itemsApi.updateItemStatus).toHaveBeenCalledWith(netflix.id, 'discarded')
    expect(await screen.findByText('Netflix, de baja')).toBeInTheDocument()
  })

  it('una compra sin fecha: solo «Fecha de pago · Añadir» (F2), y «Comprado»', async () => {
    renderAt(`/lists/gastos?item=${cascos.id}`, [cascos])
    const sheet = await screen.findByRole('dialog', { name: /Detalle de «Auriculares/ })
    expect(within(sheet).getByRole('button', { name: /Fecha de pago.*Añadir/ })).toBeInTheDocument()
    expect(within(sheet).queryByRole('button', { name: /Repetir/ })).not.toBeInTheDocument()
    expect(within(sheet).getByRole('radio', { name: 'Comprado' })).toBeInTheDocument()
  })

  it('pagar salta al siguiente cobro, con su aviso y «Deshacer» (F4)', async () => {
    const user = userEvent.setup()
    renderAt('/lists/gastos', [spotify])

    await user.click(await screen.findByRole('checkbox', { name: 'Spotify' }))
    expect(itemsApi.updateItemStatus).toHaveBeenCalledWith(spotify.id, 'bought')
    const toast = await screen.findByText(
      `Pagado · vuelve el ${format(addMonths(today, 1), "d 'de' MMMM")}`,
    )
    // El aviso de la prueba anterior puede seguir en pantalla: el «Deshacer» de este.
    const undo = within(toast.closest('li') ?? document.body).getByRole('button', {
      name: 'Deshacer',
    })
    await user.click(undo)
    await waitFor(() => {
      expect(itemsApi.undoRepeat).toHaveBeenCalledWith(spotify.id)
    })
  })

  it('Hoy: el cobro de hoy, con su precio (H1)', async () => {
    vi.mocked(todayApi.fetchToday).mockResolvedValue([{ ...spotify, parent: null }])
    renderAt('/today', [])
    expect(await screen.findByText('Vence hoy')).toBeInTheDocument()
    expect(screen.getByText('10,01 €')).toBeInTheDocument()
  })
})
