import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { addDays, format, set, startOfDay } from 'date-fns'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { Item } from '@/features/items'
import * as itemsApi from '@/features/items/api'
import {
  DAY_NAMES,
  nextAfterDone,
  parseRule,
  weekdayOf,
  WEEKDAYS,
} from '@/features/items/recurrence'
import * as listsApi from '@/features/lists/api'
import type { List } from '@/features/lists'
import * as todayApi from '@/features/today/api'
import { queryKeys } from '@/lib/queryKeys'
import { fakeSession, renderRoute } from '@/test/render-route'

vi.mock('@/features/items/api')
vi.mock('@/features/lists/api')
vi.mock('@/features/today/api')

const session = fakeSession()
const today = startOfDay(new Date())
/** El día de la semana de hoy y el de pasado mañana: «martes y jueves», si hoy es martes. */
const todayDay = weekdayOf(today)
const laterDay = weekdayOf(addDays(today, 2))
const rule = `FREQ=WEEKLY;BYDAY=${WEEKDAYS.filter((d) => d === todayDay || d === laterDay).join(',')}`

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
      pending: 1,
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
const casa = list('casa', 'Casa')
const lists = [inbox, casa]
const basura = item('5a0c3e0e-1f7e-4d59-9a39-1c3b9f7a0b01', 'Sacar la basura', {
  recurrence: rule,
})
const regar = item('5a0c3e0e-1f7e-4d59-9a39-1c3b9f7a0b02', 'Regar las plantas')
const basuraRule = parseRule(rule)
if (!basuraRule) throw new Error(rule)
/** La siguiente vez al completarla hoy. */
const next = nextAfterDone(today, basuraRule) ?? today

function renderAt(path: string, items: Item[]) {
  vi.mocked(listsApi.fetchLists).mockResolvedValue(lists)
  vi.mocked(listsApi.fetchArchivedLists).mockResolvedValue([])
  vi.mocked(itemsApi.fetchItems).mockResolvedValue(items)
  vi.mocked(itemsApi.fetchMovedFromInbox).mockResolvedValue([])
  vi.mocked(itemsApi.fetchCompletions).mockResolvedValue([])
  vi.mocked(itemsApi.updateItem).mockResolvedValue()
  vi.mocked(itemsApi.updateItemStatus).mockResolvedValue()
  vi.mocked(itemsApi.undoRepeat).mockResolvedValue()
  return renderRoute(path, {
    session,
    seed: (queryClient) => {
      queryClient.setQueryData(queryKeys.lists.all, lists)
      queryClient.setQueryData(queryKeys.lists.archived, [])
      queryClient.setQueryData(queryKeys.items.byList('casa'), items)
    },
  })
}

describe('repetición personalizada (3.6, diseño 21)', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('en la ficha de una tarea: «Personalizada…», los días, y se guarda al salir (B1, B5)', async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 })
    renderAt(`/lists/casa?item=${regar.id}`, [regar])
    const sheet = await screen.findByRole('dialog', { name: /Detalle de «Regar/ })

    await user.click(within(sheet).getByRole('button', { name: /Repetir/ }))
    const options = await screen.findByRole('radiogroup', { name: 'Repetir', hidden: true })
    await user.click(within(options).getByText('Personalizada…'))

    // Empieza en semanas, con el día de la fecha marcado; se marca otro.
    expect(await screen.findByText('Qué días')).toBeInTheDocument()
    expect(screen.getAllByRole('button', { pressed: true, hidden: true })).toHaveLength(1)
    await user.click(screen.getByRole('button', { name: DAY_NAMES[laterDay], hidden: true }))
    // El «Listo» de la cabecera de la personalizada, junto a «‹».
    const header = screen.getByRole('button', {
      name: 'Volver a Repetir',
      hidden: true,
    }).parentElement
    await user.click(
      within(header ?? document.body).getByRole('button', { name: 'Listo', hidden: true }),
    )

    await waitFor(() => {
      expect(itemsApi.updateItem).toHaveBeenLastCalledWith(regar.id, { recurrence: rule })
    })
  })

  it('completar una que se repite: sigue en su sitio con la fecha nueva, y se puede deshacer (B9, B10)', async () => {
    const user = userEvent.setup()
    renderAt('/lists/casa', [basura])

    await user.click(await screen.findByRole('checkbox', { name: 'Sacar la basura' }))
    expect(itemsApi.updateItemStatus).toHaveBeenCalledWith(basura.id, 'done')
    expect(
      await screen.findByText(`Hecha · vuelve el ${format(next, 'EEEE d')}`),
    ).toBeInTheDocument()
    // No baja a «Fuera de la cabeza»: sigue arriba, pendiente.
    const rows = screen.getByRole('list', { name: 'Ítems' })
    expect(within(rows).getByRole('button', { name: 'Sacar la basura' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Deshacer' }))
    await waitFor(() => {
      expect(itemsApi.undoRepeat).toHaveBeenCalledWith(basura.id)
    })
  })

  it('Hoy: la vez hecha sale en «Hecho hoy» con cuándo vuelve y la hora (B12)', async () => {
    const user = userEvent.setup()
    const doneAt = set(today, { hours: 8, minutes: 40 })
    vi.mocked(todayApi.fetchToday).mockResolvedValue([])
    renderAt('/today', [])
    vi.mocked(itemsApi.fetchCompletions).mockResolvedValue([
      { id: 'c1', item: { ...basura, dueAt: next }, doneAt, doneBy: null, occurrence: today },
    ])

    const done = await screen.findByRole('button', { name: 'Hecho hoy · 1' })
    await user.click(done)
    expect(
      await screen.findByText(`Vuelve el ${format(next, 'EEEE d')} · 8:40`),
    ).toBeInTheDocument()
  })
})
