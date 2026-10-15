import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { addDays, startOfDay } from 'date-fns'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import * as itemsApi from '@/features/items/api'
import * as listsApi from '@/features/lists/api'
import type { List } from '@/features/lists'
import * as remindersApi from '@/features/reminders/api'
import { queryKeys } from '@/lib/queryKeys'
import { fakeSession, renderRoute } from '@/test/render-route'

vi.mock('@/features/items/api')
vi.mock('@/features/lists/api')
vi.mock('@/features/reminders/api')

const session = fakeSession()

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
      pending: 0,
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

const inbox = list('i', 'En mente', { kind: 'inbox', color: 'indigo', position: 1000 })
const casa = list('casa', 'Casa')
const agenda = list('agenda', 'Agenda', {
  kind: 'events',
  view: 'agenda',
  color: 'amber',
  position: 3000,
  // Las listas no tienen tipo (5.3): propone eventos porque es lo que tiene.
  counters: {
    pending: 2,
    done: 0,
    pendingPriceCents: 0,
    notes: 0,
    kinds: { note: 0, task: 0, shopping: 0, event: 2 },
  },
})
const all = [inbox, casa, agenda]

const today = () => startOfDay(new Date())
/** El próximo viernes (si hoy es viernes, el de la semana que viene). */
const nextFriday = () => addDays(today(), (5 - today().getDay() + 7) % 7 || 7)

function renderAt(path: string) {
  vi.mocked(listsApi.fetchLists).mockResolvedValue(all)
  vi.mocked(listsApi.fetchArchivedLists).mockResolvedValue([])
  vi.mocked(listsApi.fetchRecentCaptures).mockResolvedValue([])
  vi.mocked(itemsApi.fetchItems).mockResolvedValue([])
  vi.mocked(itemsApi.createItem).mockResolvedValue()
  vi.mocked(remindersApi.fetchReminders).mockResolvedValue([])
  vi.mocked(remindersApi.saveReminder).mockResolvedValue()
  return renderRoute(path, {
    session,
    seed: (queryClient) => {
      queryClient.setQueryData(queryKeys.lists.all, all)
      queryClient.setQueryData(queryKeys.lists.archived, [])
      queryClient.setQueryData(queryKeys.items.latest('i', 3), [])
      queryClient.setQueryData(queryKeys.items.byList('casa'), [])
      queryClient.setQueryData(queryKeys.items.byList('agenda'), [])
      queryClient.setQueryData(queryKeys.reminders, [])
    },
  })
}

async function openCapture(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole('button', { name: 'Captura rápida' }))
  const dialog = await screen.findByRole('dialog', { name: 'Captura rápida' })
  return {
    dialog,
    field: within(dialog).getByRole('textbox', { name: '¿Qué tienes en mente?' }),
  }
}

describe('fechas escritas (3.5, diseño 21)', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('captura en una lista de tareas: vence mañana y la hora es el aviso (A3)', async () => {
    const user = userEvent.setup()
    renderAt('/')
    const { dialog, field } = await openCapture(user)
    await user.click(within(dialog).getByRole('radio', { name: 'Casa' }))
    await user.type(field, 'Llamar al seguro mañana 10h')

    expect(
      within(dialog).getByRole('button', { name: /^Vence .*, Aviso 10:00\. Quitar la fecha$/ }),
    ).toBeInTheDocument()
    // El trozo entendido, marcado en el propio texto.
    expect(dialog.querySelector('mark')).toHaveTextContent('mañana 10h')

    await user.click(within(dialog).getByRole('button', { name: 'Guardar' }))
    await waitFor(() => {
      expect(itemsApi.createItem).toHaveBeenCalledWith(
        expect.objectContaining({
          listId: 'casa',
          title: 'Llamar al seguro',
          kind: 'task',
          due: { at: addDays(today(), 1), allDay: true },
        }),
      )
    })
    await waitFor(() => {
      expect(remindersApi.saveReminder).toHaveBeenCalledWith(
        expect.objectContaining({ offsetMinutes: -600 }),
      )
    })
  })

  it('tocar la pastilla la deshace y se guarda el texto tal cual (A5)', async () => {
    const user = userEvent.setup()
    renderAt('/')
    const { dialog, field } = await openCapture(user)
    await user.click(within(dialog).getByRole('radio', { name: 'Agenda' }))
    await user.type(field, 'Cena con Marta el viernes 21h')

    await user.click(within(dialog).getByRole('button', { name: /21:00\. Quitar la fecha$/ }))
    const undone = within(dialog).getByRole('button', { name: /^Sin fecha/ })
    expect(undone).toHaveTextContent('Sin fecha · se guarda tal cual')
    expect(dialog.querySelector('mark')).toBeNull()
    // Tocarla otra vez lo vuelve a entender.
    await user.click(undone)
    await user.click(within(dialog).getByRole('button', { name: /21:00\. Quitar la fecha$/ }))

    await user.click(within(dialog).getByRole('button', { name: 'Guardar' }))
    await waitFor(() => {
      expect(itemsApi.createItem).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Cena con Marta el viernes 21h' }),
      )
    })
    expect(vi.mocked(itemsApi.createItem).mock.calls[0]?.[0]).not.toHaveProperty('due')
  })

  it('con «En mente» no hay marca ni pastilla; al elegir Agenda, sí (A6)', async () => {
    const user = userEvent.setup()
    renderAt('/')
    const { dialog, field } = await openCapture(user)
    await user.type(field, 'Cena con Marta el viernes 21h')
    expect(within(dialog).queryByRole('button', { name: /Quitar la fecha/ })).toBeNull()
    expect(dialog.querySelector('mark')).toBeNull()

    await user.click(within(dialog).getByRole('radio', { name: 'Agenda' }))
    expect(
      within(dialog).getByRole('button', { name: /^Vie .* · 21:00\. Quitar la fecha$/ }),
    ).toBeInTheDocument()
  })

  it('en la barra de añadir de una lista de eventos: el evento con su hora (A8)', async () => {
    const user = userEvent.setup()
    renderAt('/lists/agenda')
    const field = await screen.findByRole('textbox', { name: /Añadir|evento/ })
    await user.type(field, 'Cena con Marta el viernes 21h')
    expect(screen.getByRole('button', { name: /· 21:00\. Quitar la fecha$/ })).toBeInTheDocument()

    await user.type(field, '{Enter}')
    const friday = nextFriday()
    await waitFor(() => {
      expect(itemsApi.createItem).toHaveBeenCalledWith(
        expect.objectContaining({
          listId: 'agenda',
          title: 'Cena con Marta',
          kind: 'event',
          due: {
            at: new Date(friday.getFullYear(), friday.getMonth(), friday.getDate(), 21, 0),
            allDay: false,
          },
        }),
      )
    })
    // Al guardar, el campo y la pastilla empiezan de cero.
    expect(field).toHaveValue('')
    expect(screen.queryByRole('button', { name: /Quitar la fecha/ })).toBeNull()
  })

  it('«cada martes y viernes» en la barra de una lista de tareas: se repite (3.6, A4)', async () => {
    const user = userEvent.setup()
    renderAt('/lists/casa')
    const field = await screen.findByRole('textbox', { name: /Añadir|tarea/ })
    // Casa está vacía y propone nota (5.4): se pasa a tarea con el botón de la izquierda.
    await user.click(screen.getByRole('button', { name: /^Tipo: .*\. Cambiar$/ }))
    await user.click(await screen.findByRole('radio', { name: /Tarea/ }))
    await user.type(field, 'Sacar la basura cada martes y viernes')
    expect(
      screen.getByRole('button', { name: /^Martes y viernes · desde .*\. Quitar la fecha$/ }),
    ).toBeInTheDocument()
    await user.type(field, '{Enter}')
    await waitFor(() => {
      expect(itemsApi.createItem).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Sacar la basura',
          recurrence: 'FREQ=WEEKLY;BYDAY=TU,FR',
        }),
      )
    })
  })

  it('lo que no se entiende entero no se toca (A7)', async () => {
    const user = userEvent.setup()
    renderAt('/lists/casa')
    const field = await screen.findByRole('textbox', { name: /Añadir|tarea/ })
    await user.type(field, 'Cita con Lucía el finde{Enter}')
    await waitFor(() => {
      expect(itemsApi.createItem).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Cita con Lucía el finde' }),
      )
    })
    expect(vi.mocked(itemsApi.createItem).mock.calls[0]?.[0]).not.toHaveProperty('due')
  })
})
