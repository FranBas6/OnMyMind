import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import * as itemsApi from '@/features/items/api'
import type { Item } from '@/features/items'
import * as listsApi from '@/features/lists/api'
import type { List } from '@/features/lists'
import * as remindersApi from '@/features/reminders/api'
import type { Reminder } from '@/features/reminders'
import * as push from '@/features/reminders/push'
import { queryKeys } from '@/lib/queryKeys'
import { fakeSession, renderRoute } from '@/test/render-route'

vi.mock('@/features/items/api')
vi.mock('@/features/lists/api')
vi.mock('@/features/reminders/api')
vi.mock('@/features/reminders/push', async (importOriginal) => ({
  ...(await importOriginal<typeof push>()),
  readPushState: vi.fn(),
  enablePush: vi.fn(),
}))

const session = fakeSession()
// Lunes 5 de octubre de 2026, a mediodía (solo se finge la fecha: los temporizadores van).
const NOW = new Date(2026, 9, 5, 12, 0)
const at = (month: number, day: number, hours = 0, minutes = 0) =>
  new Date(2026, month - 1, day, hours, minutes)

const base: List = {
  id: 'casa',
  name: 'Casa',
  color: 'coral',
  icon: null,
  kind: 'tasks',
  position: 1000,
  counters: { pending: 0, done: 0, pendingPriceCents: 0 },
  archivedAt: null,
  isOwner: true,
}

let next = 0
let saved: Reminder[] = []
function item(title: string, overrides: Partial<Item> = {}): Item {
  next += 1
  return {
    id: `00000000-0000-4000-8000-${String(next).padStart(12, '0')}`,
    listId: 'casa',
    kind: 'task',
    parentId: null,
    title,
    notes: null,
    status: 'pending',
    priority: null,
    dueAt: null,
    allDay: true,
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
    priceLinkId: null,
    priceStore: null,
    priceTracking: null,
    createdBy: null,
    completedBy: null,
    ...overrides,
  }
}

const dentista = item('Dentista', {
  kind: 'event',
  status: 'upcoming',
  dueAt: at(10, 8, 10),
  allDay: false,
})
const banco = item('Llamada con el banco', {
  kind: 'event',
  status: 'upcoming',
  dueAt: at(10, 5, 14, 30),
  allDay: false,
})
const alquiler = item('Pagar el alquiler', { dueAt: at(10, 7) })
const seguro = item('Llamar al seguro')
const all = [dentista, banco, alquiler, seguro]

function renderList(open?: string) {
  vi.mocked(listsApi.fetchLists).mockResolvedValue([base])
  vi.mocked(listsApi.fetchArchivedLists).mockResolvedValue([])
  vi.mocked(itemsApi.fetchItems).mockReturnValue(new Promise(() => undefined))
  // Lo guardado se queda: al terminar, la caché vuelve a pedir los avisos.
  vi.mocked(remindersApi.saveReminder).mockImplementation((reminder) => {
    saved = [...saved.filter((entry) => entry.itemId !== reminder.itemId), reminder]
    return Promise.resolve()
  })
  vi.mocked(remindersApi.deleteReminder).mockResolvedValue()
  vi.mocked(remindersApi.fetchReminders).mockImplementation(() => Promise.resolve(saved))
  return renderRoute(open ? `/lists/casa?item=${open}` : '/lists/casa', {
    session,
    seed: (queryClient) => {
      queryClient.setQueryData(queryKeys.lists.all, [base])
      queryClient.setQueryData(queryKeys.lists.archived, [])
      queryClient.setQueryData(queryKeys.items.byList('casa'), all)
    },
  })
}

const detail = () => screen.findByRole('dialog', { name: /Detalle de/ })
/** Las opciones de la hoja anidada salen como ocultas mientras se anima (vaul). */
const options = () => screen.findByRole('radiogroup', { name: 'Aviso', hidden: true })
const option = (group: HTMLElement, label: string) =>
  within(group).getByText((_, element) =>
    element?.getAttribute('role') === 'radio' ? element.textContent.startsWith(label) : false,
  )

describe('avisos en la ficha (2.6, diseño 18)', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(NOW)
    saved = []
    vi.mocked(push.readPushState).mockResolvedValue('on')
    window.localStorage.clear()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('un evento con hora: en «Cuándo», con cuándo sonaría cada opción; elegir guarda', async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 })
    renderList(dentista.id)
    const sheet = await detail()

    const cuando = within(sheet).getByRole('region', { name: 'Cuándo' })
    await user.click(within(cuando).getByRole('button', { name: /Aviso\s*Sin aviso/ }))
    const group = await options()
    expect(option(group, 'A la hora')).toHaveTextContent('10:00')
    expect(option(group, '10 minutos antes')).toHaveTextContent('09:50')
    expect(option(group, '1 día antes')).toHaveTextContent('Mié 7 · 10:00')
    expect(screen.getByText('Dentista · jueves 8 oct a las 10:00')).toBeInTheDocument()

    await user.click(option(group, '1 hora antes'))
    await waitFor(() => {
      expect(remindersApi.saveReminder).toHaveBeenCalledWith(
        expect.objectContaining({ itemId: dentista.id, offsetMinutes: 60, remindAt: at(10, 8, 9) }),
      )
    })
    expect(
      await within(cuando).findByRole('button', {
        name: /Aviso\s*1 h antes · 09:00/,
        hidden: true,
      }),
    ).toBeInTheDocument()
  })

  it('lo que ya pasó se ve en gris y no se puede elegir', async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 })
    renderList(banco.id)
    const sheet = await detail()
    await user.click(within(sheet).getByRole('button', { name: /Aviso/ }))
    const group = await options()
    const pasado = option(group, '1 día antes')
    expect(pasado).toHaveTextContent('Ya pasó')
    expect(pasado).toBeDisabled()
    expect(option(group, '30 minutos antes')).toHaveTextContent('14:00')
  })

  it('una tarea con fecha: el aviso va con la fecha límite, a las 9:00', async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 })
    renderList(alquiler.id)
    const sheet = await detail()
    await user.click(within(sheet).getByRole('button', { name: /Aviso\s*Sin aviso/ }))
    const group = await options()
    expect(
      within(group)
        .getAllByRole('radio', { hidden: true })
        .map((radio) => radio.textContent),
    ).toEqual(['Sin aviso', 'Ese día a las 9:00Mié 7 oct', 'El día antes a las 9:00Mar 6 oct'])
    await user.click(option(group, 'El día antes'))
    await waitFor(() => {
      expect(remindersApi.saveReminder).toHaveBeenCalledWith(
        expect.objectContaining({ offsetMinutes: 900, remindAt: at(10, 6, 9) }),
      )
    })
  })

  it('sin fecha, solo «Personalizado…»: día y hora a mano', async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 })
    renderList(seguro.id)
    const sheet = await detail()
    await user.click(within(sheet).getByRole('button', { name: /Aviso\s*Sin aviso/ }))
    const group = await options()
    expect(within(group).getAllByRole('radio', { hidden: true })).toHaveLength(1)
    expect(
      screen.getByText(/Sin fecha solo puedes elegir el día y la hora a mano/),
    ).toBeInTheDocument()

    await user.click(screen.getByText('Personalizado…'))
    // Por defecto, mañana a las 9:00; se cambia a las 17:00.
    fireEvent.change(await screen.findByLabelText('Hora del aviso'), { target: { value: '17:00' } })
    await user.click(screen.getByRole('button', { name: 'Listo', hidden: true }))
    await waitFor(() => {
      expect(remindersApi.saveReminder).toHaveBeenCalledWith(
        expect.objectContaining({
          itemId: seguro.id,
          offsetMinutes: null,
          remindAt: at(10, 6, 17),
        }),
      )
    })
  })

  it('un aviso puesto: la fila de la lista lleva la campana; sin fecha, con su momento', async () => {
    renderList()
    saved = [
      { id: 'r1', itemId: alquiler.id, remindAt: at(10, 7, 9), offsetMinutes: -540, sentAt: null },
      { id: 'r2', itemId: seguro.id, remindAt: at(10, 12, 17), offsetMinutes: null, sentAt: null },
    ]
    const row = (title: string) => screen.getByText(title).closest('li')
    // Con día y aviso ese mismo día, la hora del aviso (diseño 21, A10).
    await waitFor(() => {
      expect(row('Pagar el alquiler')).toHaveTextContent('Aviso a las 9:00')
    })
    expect(row('Llamar al seguro')).toHaveTextContent('Lun 12 oct · 17:00')
    expect(row('Dentista')).not.toHaveTextContent(/Con aviso|Aviso a las/)
  })

  it('el primer aviso en un dispositivo sin avisos pregunta; «Ahora no» deja el «Activar» abajo', async () => {
    vi.mocked(push.readPushState).mockResolvedValue('off')
    const user = userEvent.setup({ pointerEventsCheck: 0 })
    renderList(dentista.id)
    const sheet = await detail()
    await user.click(within(sheet).getByRole('button', { name: /Aviso\s*Sin aviso/ }))
    await user.click(option(await options(), '1 hora antes'))

    expect(await screen.findAllByText('Activa los avisos en este navegador')).not.toHaveLength(0)
    expect(
      screen.getByText(/Para que «Dentista» te avise 1 h antes, este navegador tiene que poder/),
    ).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Ahora no', hidden: true }))
    expect(
      await within(sheet).findByText(/No sonará en este navegador hasta que actives los avisos/),
    ).toBeInTheDocument()
    expect(within(sheet).getByRole('button', { name: 'Activar' })).toBeInTheDocument()
  })
})
