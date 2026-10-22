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
const HOUR = 60 * 60 * 1000

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
      pending: 2,
      done: 1,
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
/** Abre una pantalla con las listas y sus ítems ya en caché; el servidor no contesta. */
function renderAt(path: string, lists: List[], items: Record<string, Item[]>) {
  vi.mocked(listsApi.fetchLists).mockResolvedValue(lists)
  vi.mocked(listsApi.fetchArchivedLists).mockResolvedValue([])
  vi.mocked(itemsApi.fetchItems).mockReturnValue(new Promise(() => undefined))
  vi.mocked(itemsApi.fetchMovedFromInbox).mockResolvedValue([])
  vi.mocked(profileApi.fetchProfile).mockResolvedValue(testProfile(session.user.id))
  return renderRoute(path, {
    session,
    seed: (queryClient) => {
      queryClient.setQueryData(queryKeys.lists.all, lists)
      for (const [listId, entries] of Object.entries(items)) {
        queryClient.setQueryData(queryKeys.items.byList(listId), entries)
      }
    },
  })
}

describe('la nota sin estado y las listas sin tipo (5.3, ADR-012)', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('en «En mente» una nota no tiene casilla ni «Hecha», y cuenta como sin ordenar', async () => {
    const enMente = list('i', 'En mente', {
      kind: 'inbox',
      color: 'indigo',
      counters: {
        pending: 0,
        done: 0,
        pendingPriceCents: 0,
        notes: 1,
        kinds: { note: 1, task: 0, shopping: 0, event: 0 },
      },
    })
    const wifi = item('n1', 'La clave del wifi', { listId: 'i', kind: 'note' })
    const user = userEvent.setup()
    renderAt('/lists/i', [enMente], { i: [wifi] })

    expect(await screen.findByText('La clave del wifi')).toBeInTheDocument()
    expect(screen.getByText('1 cosa sin ordenar')).toBeInTheDocument()
    expect(screen.queryByRole('checkbox', { name: 'La clave del wifi' })).not.toBeInTheDocument()

    await user.pointer({ keys: '[MouseRight]', target: screen.getByText('La clave del wifi') })
    const menu = screen.queryByRole('dialog', { name: /Opciones de «La clave del wifi»/ })
    if (menu) expect(within(menu).queryByRole('button', { name: /Hecha/ })).toBeNull()
  })

  it('una lista se ve por días por su vista, no por su tipo', async () => {
    const viaje = list('roma', 'Viaje a Roma', { kind: 'list', view: 'agenda' })
    renderAt('/lists/roma', [inbox, viaje], { roma: [] })

    expect(await screen.findByText('Lista recién creada')).toBeInTheDocument()
    // Una agenda vacía propone evento; una lista vacía, nota (5.4).
    expect(screen.getByRole('button', { name: 'Tipo: Evento. Cambiar' })).toBeInTheDocument()
  })

  it('una lista sin tipo propone el tipo que más tiene', async () => {
    const regalos = list('regalos', 'Regalos', { kind: 'list' })
    renderAt('/lists/regalos', [inbox, regalos], {
      regalos: [
        item('r1', 'Auriculares', { listId: 'regalos', kind: 'shopping' }),
        item('r2', 'Libro de cocina', { listId: 'regalos', kind: 'shopping', position: 2000 }),
        item('r3', 'Envolver', { listId: 'regalos', position: 3000 }),
      ],
    })

    expect(await screen.findByRole('button', { name: 'Tipo: Compra. Cambiar' })).toBeVisible()
  })

  it('una nota sacada de «En mente» sigue siendo nota, y en su ficha pasa a tarea', async () => {
    const casa = list('casa', 'Casa', { kind: 'list' })
    const leche = item('00000000-0000-4000-8000-0000000000a2', 'Leche', {
      listId: 'casa',
      kind: 'note',
    })
    vi.mocked(itemsApi.updateItem).mockResolvedValue()
    const user = userEvent.setup()
    renderAt(`/lists/casa?item=${leche.id}`, [inbox, casa], { casa: [leche] })

    const sheet = await screen.findByRole('dialog', { name: /Detalle de «Leche»/ })
    await user.click(within(sheet).getByRole('button', { name: /^Tipo/ }))
    // La hoja «Tipo» (diseño 25, B6): se elige y «Listo» cambia.
    const kinds = await screen.findByRole('radiogroup', { name: 'Tipo' })
    await user.click(within(kinds).getByRole('radio', { name: /Tarea/ }))
    expect(
      screen.getByText(/«Leche» será el título\. No se pierde nada: gana casilla/),
    ).toBeInTheDocument()
    await user.click(
      within(screen.getByRole('dialog', { name: 'Tipo' })).getByRole('button', { name: 'Listo' }),
    )

    await waitFor(() => {
      expect(itemsApi.updateItem).toHaveBeenCalledWith(leche.id, {
        kind: 'task',
        status: 'pending',
      })
    })
    expect(await screen.findByText('Ahora es una tarea')).toBeInTheDocument()
  })

  it('la ficha de una nota es un solo texto: la primera línea es el título (diseño 25, B2)', async () => {
    const casa = list('casa', 'Casa', { kind: 'list' })
    const vuelo = item('00000000-0000-4000-8000-0000000000a3', 'Vuelo a Lisboa', {
      listId: 'casa',
      kind: 'note',
      notes: 'K7Q2MX',
    })
    vi.mocked(itemsApi.updateItem).mockResolvedValue()
    const user = userEvent.setup()
    renderAt(`/lists/casa?item=${vuelo.id}`, [inbox, casa], { casa: [vuelo] })

    const sheet = await screen.findByRole('dialog', { name: /Detalle de «Vuelo a Lisboa»/ })
    const first = within(sheet).getByRole('textbox', { name: 'Texto de la nota' })
    const rest = within(sheet).getByRole('textbox', { name: 'El resto de la nota' })
    expect(first).toHaveValue('Vuelo a Lisboa')
    expect(rest).toHaveValue('K7Q2MX')
    expect(within(sheet).queryByText('Estado')).not.toBeInTheDocument()

    await user.click(rest)
    // Intro en una viñeta sigue con otra.
    await user.keyboard('{End}{Enter}- T4, puerta B{Enter}Maleta')
    expect(rest).toHaveValue('K7Q2MX\n• T4, puerta B\n• Maleta')
    await user.click(first)
    await user.keyboard('{End}{Enter}')
    expect(first).toHaveValue('Vuelo a Lisboa')
    expect(rest).toHaveValue('\nK7Q2MX\n• T4, puerta B\n• Maleta')
    await user.keyboard('{Backspace}')
    expect(rest).toHaveValue('K7Q2MX\n• T4, puerta B\n• Maleta')
    await user.click(within(sheet).getByRole('button', { name: 'Listo' }))

    await waitFor(() => {
      expect(itemsApi.updateItem).toHaveBeenCalledWith(vuelo.id, {
        title: 'Vuelo a Lisboa',
        notes: 'K7Q2MX\n• T4, puerta B\n• Maleta',
      })
    })
  })

  it('una nota que se cierra sin texto se borra sola, con «Deshacer» (diseño 25, B2e)', async () => {
    const casa = list('casa', 'Casa', { kind: 'list' })
    const borrador = item('00000000-0000-4000-8000-0000000000a4', 'Borrador', {
      listId: 'casa',
      kind: 'note',
    })
    vi.mocked(itemsApi.deleteItem).mockResolvedValue()
    const user = userEvent.setup()
    renderAt(`/lists/casa?item=${borrador.id}`, [inbox, casa], { casa: [borrador] })

    const sheet = await screen.findByRole('dialog', { name: /Detalle de «Borrador»/ })
    // Con la primera línea y sin resto, el resto dice dónde escribir (Fran, 2026-10-22); vacía
    // del todo, solo «Escribe…» arriba.
    const first = within(sheet).getByRole('textbox', { name: 'Texto de la nota' })
    const rest = within(sheet).getByRole('textbox', { name: 'El resto de la nota' })
    expect(rest).toHaveAttribute('placeholder', 'Escribe aquí…')
    await user.clear(first)
    expect(first).toHaveAttribute('placeholder', 'Escribe…')
    expect(rest).not.toHaveAttribute('placeholder')
    await user.click(within(sheet).getByRole('button', { name: 'Listo' }))

    await waitFor(() => {
      expect(itemsApi.deleteItem).toHaveBeenCalledWith(borrador.id)
    })
    expect(await screen.findByText('Nota vacía borrada')).toBeInTheDocument()
    expect(itemsApi.updateItem).not.toHaveBeenCalled()
  })
})
