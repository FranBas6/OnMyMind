import { onlineManager } from '@tanstack/react-query'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import * as itemsApi from '@/features/items/api'
import * as listsApi from '@/features/lists/api'
import type { List } from '@/features/lists'
import { queryKeys } from '@/lib/queryKeys'
import { fakeSession, renderRoute } from '@/test/render-route'
import { pretendDevice } from '@/test/device'

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
      kinds: { note: 0, task: 0, shopping: 0, event: 0 },
    },
    archivedAt: null,
    isOwner: true,
    hidden: false,
    ...overrides,
  }
}

const inbox = list('i', 'En mente', { kind: 'inbox', color: 'indigo', position: 1000 })
const casa = list('casa', 'Casa', {
  counters: {
    pending: 4,
    done: 2,
    pendingPriceCents: 0,
    notes: 0,
    kinds: { note: 0, task: 0, shopping: 0, event: 0 },
  },
})
const trabajo = list('trabajo', 'Trabajo', {
  color: 'pink',
  position: 3000,
  counters: {
    pending: 6,
    done: 3,
    pendingPriceCents: 0,
    notes: 0,
    kinds: { note: 0, task: 0, shopping: 0, event: 0 },
  },
})
const tech = list('tech', 'Compras tech', {
  kind: 'shopping',
  view: 'list',
  color: 'blue',
  position: 4000,
  counters: {
    pending: 3,
    done: 0,
    pendingPriceCents: 0,
    notes: 0,
    kinds: { note: 0, task: 0, shopping: 0, event: 0 },
  },
})
const regalos = list('regalos', 'Regalos', {
  kind: 'shopping',
  color: 'green',
  position: 5000,
})
const all = [inbox, casa, trabajo, tech, regalos]

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

function renderAt(path: string) {
  vi.mocked(listsApi.fetchLists).mockResolvedValue(all)
  vi.mocked(listsApi.fetchArchivedLists).mockResolvedValue([])
  vi.mocked(listsApi.fetchRecentCaptures).mockResolvedValue([])
  vi.mocked(itemsApi.fetchItems).mockResolvedValue([])
  vi.mocked(itemsApi.fetchMovedFromInbox).mockResolvedValue([])
  return renderRoute(path, {
    session,
    seed: (queryClient) => {
      queryClient.setQueryData(queryKeys.lists.all, all)
      queryClient.setQueryData(queryKeys.lists.archived, [])
      queryClient.setQueryData(queryKeys.items.latest('i', 3), [])
      queryClient.setQueryData(queryKeys.items.byList('casa'), [])
    },
  })
}

const captureDialog = () => screen.findByRole('dialog', { name: 'Captura rápida' })
const destinations = (dialog: HTMLElement) =>
  within(within(dialog).getByRole('radiogroup', { name: 'Guardar en' })).getAllByRole('radio')

describe('captura rápida', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })
  afterEach(() => {
    setDesktop(false)
    onlineManager.setOnline(true)
    vi.restoreAllMocks()
  })

  it('el + abre la hoja con el campo listo y guarda en «En mente» con «Deshacer»', async () => {
    const user = userEvent.setup()
    vi.mocked(itemsApi.createItem).mockResolvedValue()
    vi.mocked(itemsApi.deleteItem).mockResolvedValue()
    renderAt('/')

    await user.click(await screen.findByRole('button', { name: 'Captura rápida' }))
    const dialog = await captureDialog()
    const field = within(dialog).getByRole('textbox', { name: '¿Qué tienes en mente?' })
    expect(field).toHaveFocus()
    expect(within(dialog).getByRole('button', { name: 'Guardar' })).toBeDisabled()
    // Su nombre (el cuadrado de cada lista va oculto a los lectores, 5.9).
    expect(destinations(dialog).map((chip) => chip.getAttribute('aria-label'))).toEqual([
      'En mente',
      'Trabajo',
      'Casa',
      'Compras tech',
    ])
    expect(within(dialog).getByRole('radio', { name: 'En mente' })).toHaveAttribute(
      'aria-checked',
      'true',
    )

    // En «En mente» se escribe una nota (diseño 25, B3): Intro hace otra línea y guarda «Guardar».
    expect(within(dialog).getByRole('button', { name: 'Tipo: Nota. Cambiar' })).toBeInTheDocument()
    expect(within(dialog).getByText('Intro, otra línea')).toBeInTheDocument()
    // Debajo, dónde va el resto (Fran, 2026-10-22), hasta que se escribe en él.
    const rest = within(dialog).getByRole('textbox', { name: 'El resto de la nota' })
    expect(rest).toHaveAttribute('placeholder', 'Escribe aquí…')
    await user.type(field, 'Código del portal de Marta{Enter}4821 · el timbre no va')
    expect(screen.getByRole('dialog', { name: 'Captura rápida' })).toBeInTheDocument()
    expect(rest).toHaveValue('4821 · el timbre no va')
    expect(rest).not.toHaveAttribute('placeholder')
    await user.click(within(dialog).getByRole('button', { name: 'Guardar' }))

    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'Captura rápida' })).not.toBeInTheDocument()
    })
    expect(itemsApi.createItem).toHaveBeenCalledWith(
      expect.objectContaining({
        listId: 'i',
        kind: 'note',
        title: 'Código del portal de Marta',
        notes: '4821 · el timbre no va',
        status: 'pending',
      }),
    )
    expect(await screen.findByText('Guardado en En mente')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Deshacer' }))
    await waitFor(() => {
      expect(itemsApi.deleteItem).toHaveBeenCalled()
    })
  })

  it('la pastilla cambia el tipo: una tarea guarda con Intro (diseño 25, B3c)', async () => {
    const user = userEvent.setup()
    vi.mocked(itemsApi.createItem).mockResolvedValue()
    renderAt('/')

    await user.click(await screen.findByRole('button', { name: 'Captura rápida' }))
    const dialog = await captureDialog()
    await user.click(within(dialog).getByRole('button', { name: 'Tipo: Nota. Cambiar' }))
    // En el móvil, «Tipo» sale en la misma hoja, con lo que propone la lista.
    expect(
      within(dialog).getByText(
        'En «En mente» todo empieza como nota. Lo que elijas vale solo para lo que escribas ahora.',
      ),
    ).toBeInTheDocument()
    await user.click(within(dialog).getByRole('radio', { name: /Tarea/ }))

    expect(within(dialog).getByText('Intro guarda')).toBeInTheDocument()
    await user.type(
      within(dialog).getByRole('textbox', { name: '¿Qué tienes en mente?' }),
      'Llamar al fontanero{Enter}',
    )
    await waitFor(() => {
      expect(itemsApi.createItem).toHaveBeenCalledWith(
        expect.objectContaining({ listId: 'i', kind: 'task', title: 'Llamar al fontanero' }),
      )
    })
  })

  it('se puede elegir otro chip o, con «···», cualquier lista', async () => {
    const user = userEvent.setup()
    vi.mocked(itemsApi.createItem).mockResolvedValue()
    renderAt('/')

    await user.click(await screen.findByRole('button', { name: 'Captura rápida' }))
    const dialog = await captureDialog()
    await user.click(within(dialog).getByRole('button', { name: 'Otra lista' }))
    await user.click(within(dialog).getByRole('button', { name: /Regalos/ }))

    // La elegida pasa a ser el primer chip.
    expect(destinations(dialog)[0]).toHaveTextContent('Regalos')
    expect(destinations(dialog)[0]).toHaveAttribute('aria-checked', 'true')
    await user.type(
      within(dialog).getByRole('textbox', { name: '¿Qué tienes en mente?' }),
      'Pañuelo para mamá',
    )
    await user.click(within(dialog).getByRole('button', { name: 'Guardar' }))

    expect(itemsApi.createItem).toHaveBeenCalledWith(
      expect.objectContaining({ listId: 'regalos', status: 'pending' }),
    )
  })

  it('en el detalle de una lista no hay +: está el campo de añadir', async () => {
    renderAt('/lists/casa')
    await screen.findByRole('heading', { level: 1, name: 'Casa' })
    expect(screen.queryByRole('button', { name: 'Captura rápida' })).not.toBeInTheDocument()
  })

  it('en escritorio, el atajo dentro de una lista la trae elegida', async () => {
    pretendDevice('mac')
    setDesktop(true)
    renderAt('/lists/casa')
    await screen.findByRole('heading', { level: 1, name: 'Casa' })

    fireEvent.keyDown(window, { code: 'Space', key: ' ', metaKey: true, shiftKey: true })

    const dialog = await captureDialog()
    expect(within(dialog).getByText(/desde Casa/)).toBeInTheDocument()
    expect(destinations(dialog)[0]).toHaveTextContent('Casa')
    expect(destinations(dialog)[0]).toHaveAttribute('aria-checked', 'true')
    expect(destinations(dialog)[1]).toHaveTextContent('En mente')
    // Casa está vacía: propone nota, que hace otra línea con ↩ (diseño 25, D4).
    expect(within(dialog).getByText('↩ otra línea · ⌘↩ guardar')).toBeInTheDocument()
  })

  it('en escritorio la abre el botón del sidebar, y ⌘↩ guarda', async () => {
    const user = userEvent.setup()
    setDesktop(true)
    vi.mocked(itemsApi.createItem).mockResolvedValue()
    renderAt('/')

    await user.click(await screen.findByRole('button', { name: /¿Qué tienes en mente\?/ }))
    const field = within(await captureDialog()).getByRole('textbox', {
      name: '¿Qué tienes en mente?',
    })
    await user.type(field, 'Renovar el DNI{Meta>}{Enter}{/Meta}')

    await waitFor(() => {
      expect(itemsApi.createItem).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Renovar el DNI', listId: 'i' }),
      )
    })
  })

  it('/add?text= abre la captura con el texto y deja la URL en Inicio', async () => {
    const { router } = renderAt('/add?text=renovar%20DNI')

    const dialog = await captureDialog()
    expect(within(dialog).getByRole('textbox', { name: '¿Qué tienes en mente?' })).toHaveValue(
      'renovar DNI',
    )
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/')
    })
  })

  it('sin red lo dice, y guarda igual', async () => {
    const user = userEvent.setup()
    onlineManager.setOnline(false)
    renderAt('/')

    await user.click(await screen.findByRole('button', { name: 'Captura rápida' }))
    const dialog = await captureDialog()
    expect(within(dialog).getByText('Sin conexión · se guarda igual')).toBeInTheDocument()
    await user.type(
      within(dialog).getByRole('textbox', { name: '¿Qué tienes en mente?' }),
      'Pilas AA',
    )
    await user.click(within(dialog).getByRole('button', { name: 'Guardar' }))

    // (Los avisos de sonner viven en un almacén global: puede quedar el de otro test.)
    expect((await screen.findAllByText('Guardado en En mente')).length).toBeGreaterThan(0)
    expect(itemsApi.createItem).not.toHaveBeenCalled()
  })
})
