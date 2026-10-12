import { onlineManager } from '@tanstack/react-query'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { addDays, startOfDay } from 'date-fns'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import * as itemsApi from '@/features/items/api'
import type { NewItem } from '@/features/items/api'
import * as listsApi from '@/features/lists/api'
import type { List } from '@/features/lists'
import { queryKeys } from '@/lib/queryKeys'
import { fakeSession, renderRoute } from '@/test/render-route'

vi.mock('@/features/items/api')
vi.mock('@/features/lists/api')

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
    ...overrides,
  }
}

const inbox = list('i', 'En mente', { kind: 'inbox', color: 'indigo', position: 1000 })
const casa = list('casa', 'Casa')
const compras = list('compras', 'Compras', {
  kind: 'shopping',
  color: 'blue',
  position: 3000,
  // Las listas no tienen tipo (5.3): es «de compras» porque lo que más tiene son compras.
  counters: {
    pending: 4,
    done: 0,
    pendingPriceCents: 0,
    notes: 0,
    kinds: { note: 0, task: 0, shopping: 4, event: 0 },
  },
})
const all = [inbox, casa, compras]

const WHATSAPP = `- Leche
- Huevos x12
- Pan de molde
- Tomates
- Aceite de oliva
- Papel de cocina
- [x] Detergente`

function renderAt(path: string) {
  vi.mocked(listsApi.fetchLists).mockResolvedValue(all)
  vi.mocked(listsApi.fetchArchivedLists).mockResolvedValue([])
  vi.mocked(listsApi.fetchRecentCaptures).mockResolvedValue([])
  vi.mocked(itemsApi.fetchItems).mockResolvedValue([])
  vi.mocked(itemsApi.fetchMovedFromInbox).mockResolvedValue([])
  vi.mocked(itemsApi.createItem).mockResolvedValue()
  vi.mocked(itemsApi.deleteItem).mockResolvedValue()
  return renderRoute(path, {
    session,
    seed: (queryClient) => {
      queryClient.setQueryData(queryKeys.lists.all, all)
      queryClient.setQueryData(queryKeys.lists.archived, [])
      queryClient.setQueryData(queryKeys.items.latest('i', 3), [])
      queryClient.setQueryData(queryKeys.items.byList('casa'), [])
      queryClient.setQueryData(queryKeys.items.byList('compras'), [])
    },
  })
}

const captureDialog = () => screen.findByRole('dialog', { name: 'Captura rápida' })
const pastedBox = (within_: HTMLElement) =>
  within(within_).getByRole('region', { name: 'Lo pegado, una cosa por línea' })
const created = () => vi.mocked(itemsApi.createItem).mock.calls.map(([item]: [NewItem]) => item)

async function openCapture(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole('button', { name: 'Captura rápida' }))
  const dialog = await captureDialog()
  await user.click(within(dialog).getByRole('textbox', { name: '¿Qué tienes en mente?' }))
  return dialog
}

/** Cambia el tipo de la barra de añadir a tarea (diseño 25, B5c). */
async function chooseTask(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: /^Tipo: .*\. Cambiar$/ }))
  await user.click(await screen.findByRole('radio', { name: /Tarea/ }))
}

describe('pegar varias líneas (4.3, diseño 23, B)', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    onlineManager.setOnline(true)
  })
  afterEach(() => {
    onlineManager.setOnline(true)
  })

  it('en la captura: una cosa por línea, quitar y recuperar, «[x]» hecha y «Deshacer» todas (B1–B3)', async () => {
    const user = userEvent.setup()
    renderAt('/')
    const dialog = await openCapture(user)
    await user.click(within(dialog).getByRole('radio', { name: 'Compras' }))
    await user.click(within(dialog).getByRole('textbox'))
    await user.paste(WHATSAPP)

    const box = pastedBox(dialog)
    expect(within(box).getByText('7 cosas, una por línea')).toBeInTheDocument()
    expect(within(dialog).queryByRole('textbox')).not.toBeInTheDocument()
    expect(within(box).getByText(/se añade hecha/)).toBeInTheDocument()
    expect(
      within(box)
        .getAllByRole('listitem')
        .map((row) => row.textContent),
    ).toEqual([
      'Leche',
      'Huevos x12',
      'Pan de molde',
      'Tomates',
      'Aceite de oliva',
      'Papel de cocina',
      'Detergente · se añade hecha',
    ])

    // Quitada, se puede recuperar hasta guardar (B2).
    await user.click(within(box).getByRole('button', { name: 'Quitar «Huevos x12»' }))
    expect(within(box).getByText('6 cosas, una por línea')).toBeInTheDocument()
    await user.click(within(box).getByRole('button', { name: 'Recuperar «Huevos x12»' }))
    await user.click(within(box).getByRole('button', { name: 'Quitar «Tomates»' }))

    await user.click(within(dialog).getByRole('button', { name: 'Añadir 6' }))
    await waitFor(() => {
      expect(created()).toHaveLength(6)
    })
    expect(created().map((item) => [item.title, item.kind, item.status, item.listId])).toEqual([
      ['Leche', 'shopping', 'pending', 'compras'],
      ['Huevos x12', 'shopping', 'pending', 'compras'],
      ['Pan de molde', 'shopping', 'pending', 'compras'],
      ['Aceite de oliva', 'shopping', 'pending', 'compras'],
      ['Papel de cocina', 'shopping', 'pending', 'compras'],
      ['Detergente', 'shopping', 'bought', 'compras'],
    ])
    expect(screen.queryByRole('dialog', { name: 'Captura rápida' })).not.toBeInTheDocument()

    // Un solo aviso, y «Deshacer» las borra todas (B3).
    expect((await screen.findAllByText('6 cosas en Compras')).length).toBeGreaterThan(0)
    const undo = screen.getAllByRole('button', { name: 'Deshacer' }).at(-1)
    if (!undo) throw new Error('sin «Deshacer»')
    await user.click(undo)
    await waitFor(() => {
      expect(itemsApi.deleteItem).toHaveBeenCalledTimes(6)
    })
  })

  it('en una nota se pega todo en una, y «Una cosa por línea» la parte (diseño 25, B4)', async () => {
    const user = userEvent.setup()
    vi.mocked(itemsApi.createItem).mockResolvedValue()
    renderAt('/')
    const dialog = await openCapture(user)
    await user.paste('Bizcocho de yogur\n- 1 yogur\n- 3 huevos')

    const note = within(dialog).getByRole('region', { name: 'Lo pegado, en una sola cosa' })
    expect(within(note).getByText('Una nota con 3 líneas')).toBeInTheDocument()
    await user.click(within(note).getByRole('button', { name: 'Una cosa por línea' }))
    expect(within(pastedBox(dialog)).getByText('3 notas, una por línea')).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'Añadir 3' })).toBeInTheDocument()
    await user.click(within(pastedBox(dialog)).getByRole('button', { name: 'Como una sola' }))

    await user.click(within(dialog).getByRole('button', { name: 'Guardar' }))
    await waitFor(() => {
      expect(created()).toHaveLength(1)
    })
    expect(created()[0]).toMatchObject({
      kind: 'note',
      title: 'Bizcocho de yogur',
      notes: '• 1 yogur\n• 3 huevos',
      listId: 'i',
    })
  })

  it('«Como una sola» vuelve al campo con el texto tal cual', async () => {
    const user = userEvent.setup()
    renderAt('/')
    const dialog = await openCapture(user)
    // Lo que no es una nota se ofrece una por línea, como en 23.
    await user.click(within(dialog).getByRole('button', { name: 'Tipo: Nota. Cambiar' }))
    await user.click(within(dialog).getByRole('radio', { name: /Tarea/ }))
    await user.click(within(dialog).getByRole('textbox', { name: '¿Qué tienes en mente?' }))
    await user.paste('Leche\nPan\nHuevos')

    await user.click(within(pastedBox(dialog)).getByRole('button', { name: 'Como una sola' }))
    expect(within(dialog).getByRole('textbox')).toHaveValue('Leche\nPan\nHuevos')
    expect(within(dialog).getByRole('button', { name: 'Guardar' })).toBeEnabled()
  })

  it('una sola línea con salto al final, o con algo ya escrito, se pega como siempre (B7)', async () => {
    const user = userEvent.setup()
    renderAt('/')
    const dialog = await openCapture(user)
    await user.paste('Comprar pilas AA\n')
    expect(within(dialog).queryByRole('region', { name: /Lo pegado/ })).not.toBeInTheDocument()
    // En una nota, el salto pasa al resto (diseño 25, B3).
    expect(within(dialog).getByRole('textbox', { name: '¿Qué tienes en mente?' })).toHaveValue(
      'Comprar pilas AA',
    )

    await user.paste('\nLeche\nPan\nHuevos')
    expect(within(dialog).queryByRole('region', { name: /Lo pegado/ })).not.toBeInTheDocument()
  })

  it('en la barra de añadir de una lista de tareas: cada línea con su fecha, en orden (B5, B6)', async () => {
    const user = userEvent.setup()
    renderAt('/lists/casa')
    await screen.findByRole('heading', { level: 1, name: 'Casa' })
    const field = screen.getByRole('textbox', { name: 'Añadir a Casa…' })
    // Casa está vacía y propone nota (5.4): se pasa a tarea con el botón de la izquierda.
    await chooseTask(user)
    await user.click(field)
    await user.paste('Llamar al fontanero mañana 10h\nBajar el reciclaje\nPagar la comunidad\n')

    const box = pastedBox(document.body)
    expect(within(box).getByText('3 cosas, una por línea')).toBeInTheDocument()
    expect(field).toHaveAttribute('placeholder', '3 líneas pegadas')
    expect(within(box).getByText('Llamar al fontanero')).toBeInTheDocument()
    expect(
      within(box).getByRole('button', { name: 'Mañana · 10:00. Quitar la fecha' }),
    ).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Añadir 3' }))
    await waitFor(() => {
      expect(created()).toHaveLength(3)
    })
    const [first, second, third] = created()
    expect(first).toMatchObject({
      title: 'Llamar al fontanero',
      kind: 'task',
      due: { at: startOfDay(addDays(new Date(), 1)), allDay: true },
    })
    expect([second?.title, third?.title]).toEqual(['Bajar el reciclaje', 'Pagar la comunidad'])
    // Al final de la lista y en su orden.
    expect((first?.position ?? 0) < (second?.position ?? 0)).toBe(true)
    expect((second?.position ?? 0) < (third?.position ?? 0)).toBe(true)
    expect((await screen.findAllByText('3 cosas en Casa')).length).toBeGreaterThan(0)
    expect(field).toHaveAttribute('placeholder', expect.not.stringMatching(/pegadas/))
  })

  it('la fecha de una línea se deshace con su pastilla', async () => {
    const user = userEvent.setup()
    renderAt('/lists/casa')
    await screen.findByRole('heading', { level: 1, name: 'Casa' })
    await chooseTask(user)
    await user.click(screen.getByRole('textbox', { name: 'Añadir a Casa…' }))
    await user.paste('Llamar al fontanero mañana 10h\nBajar el reciclaje\nPagar la comunidad')

    await user.click(screen.getByRole('button', { name: 'Mañana · 10:00. Quitar la fecha' }))
    expect(
      within(pastedBox(document.body)).getByText('Llamar al fontanero mañana 10h'),
    ).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Añadir 3' }))
    await waitFor(() => {
      expect(created()).toHaveLength(3)
    })
    expect(created()[0]).toMatchObject({ title: 'Llamar al fontanero mañana 10h' })
    expect(created()[0]?.due).toBeUndefined()
  })

  it('sin conexión se guardan todas y salen al volver, en orden', async () => {
    const user = userEvent.setup()
    onlineManager.setOnline(false)
    renderAt('/')
    const dialog = await openCapture(user)
    await user.paste('Pilas\nBombillas\nCinta americana')
    // En una nota se pega entero: se parte con «Una cosa por línea» (diseño 25, B4b).
    await user.click(within(dialog).getByRole('button', { name: 'Una cosa por línea' }))
    await user.click(within(dialog).getByRole('button', { name: 'Añadir 3' }))
    expect((await screen.findAllByText('3 cosas en En mente')).length).toBeGreaterThan(0)
    expect(itemsApi.createItem).not.toHaveBeenCalled()

    onlineManager.setOnline(true)
    await waitFor(() => {
      expect(created().map((item) => item.title)).toEqual(['Pilas', 'Bombillas', 'Cinta americana'])
    })
    expect(created().every((item) => item.kind === 'note')).toBe(true)
  })
})
