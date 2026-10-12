import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import * as api from '@/features/lists/api'
import type { List } from '@/features/lists'
import { queryKeys } from '@/lib/queryKeys'
import { fakeSession, renderRoute } from '@/test/render-route'

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
      pending: 4,
      done: 8,
      pendingPriceCents: 0,
      notes: 0,
      kinds: { note: 0, task: 0, shopping: 0, event: 0 },
    },
    archivedAt: null,
    isOwner: true,
    ...overrides,
  }
}

const inbox = list('i', 'En mente', { kind: 'inbox', color: 'indigo', position: 1000 })
const casa = list('casa', 'Casa')
const viejas = list('viejas', 'Viejas', { position: 3000, archivedAt: new Date(2026, 8, 12) })

function renderHome({ desktop = false } = {}) {
  setDesktop(desktop)
  vi.mocked(api.fetchLists).mockResolvedValue([inbox, casa])
  vi.mocked(api.fetchArchivedLists).mockResolvedValue([viejas])
  vi.mocked(api.fetchRecentCaptures).mockResolvedValue([])
  return renderRoute('/', {
    session,
    seed: (queryClient) => {
      queryClient.setQueryData(queryKeys.lists.all, [inbox, casa])
      queryClient.setQueryData(queryKeys.lists.archived, [viejas])
      queryClient.setQueryData(queryKeys.items.latest('i', 3), [])
    },
  })
}

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

describe('acciones sobre listas', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })
  afterEach(() => {
    setDesktop(false)
  })

  it('crear: valida el nombre y, al guardar, la lista aparece en la rejilla', async () => {
    const user = userEvent.setup()
    const created = list('trabajo', 'Trabajo', {
      color: 'teal',
      position: 4000,
      counters: {
        pending: 0,
        done: 0,
        pendingPriceCents: 0,
        notes: 0,
        kinds: { note: 0, task: 0, shopping: 0, event: 0 },
      },
    })
    renderHome({ desktop: true })
    // Como el servidor de verdad: tras crear, la lista nueva sale también al volver a pedirlas.
    vi.mocked(api.createList).mockImplementation(() => {
      vi.mocked(api.fetchLists).mockResolvedValue([inbox, casa, created])
      return Promise.resolve(created)
    })

    const main = await screen.findByRole('main')
    const [newListButton] = within(main).getAllByRole('button', { name: 'Nueva lista' })
    if (!newListButton) throw new Error('Falta el botón «Nueva lista»')
    await user.click(newListButton)
    const dialog = await screen.findByRole('dialog', { name: 'Nueva lista' })

    await user.click(within(dialog).getByRole('button', { name: 'Crear' }))
    expect(await within(dialog).findByText('Ponle un nombre.')).toBeInTheDocument()
    expect(api.createList).not.toHaveBeenCalled()

    await user.type(within(dialog).getByLabelText('Nombre de la lista'), 'Trabajo')
    await user.click(within(dialog).getByRole('radio', { name: 'Verde azulado' }))
    // «Personalizada» ya no se ofrece (ADR-011, descartada), ni ningún tipo: dentro cabe de todo
    // (diseño 25, D7).
    expect(within(dialog).queryByRole('radio', { name: /Personalizada/ })).not.toBeInTheDocument()
    expect(
      within(dialog).getByText(
        'Dentro cabe de todo: notas, tareas, compras y eventos. Al añadir, la lista te propone lo que más tenga.',
      ),
    ).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: 'Crear' }))

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })
    // Sin tipo (5.3): la lista se crea con nombre y color.
    expect(api.createList).toHaveBeenCalledWith({ name: 'Trabajo', color: 'teal' }, 4000)
    expect(
      within(screen.getByRole('list', { name: 'Mis listas' })).getByRole('link', {
        name: /Trabajo/,
      }),
    ).toBeInTheDocument()
  })

  it('editar: nombre y color, sin tipo (5.3)', async () => {
    const user = userEvent.setup()
    renderHome({ desktop: true })

    await user.click(await screen.findByRole('button', { name: 'Opciones de «Casa»' }))
    await user.click(await screen.findByRole('menuitem', { name: 'Editar' }))

    const dialog = await screen.findByRole('dialog', { name: 'Editar lista' })
    expect(within(dialog).getByLabelText('Nombre de la lista')).toHaveValue('Casa')
    expect(within(dialog).queryByRole('radiogroup', { name: 'Tipo por defecto' })).toBeNull()
  })

  it('archivar: sale de la rejilla al instante y ofrece «Deshacer»', async () => {
    const user = userEvent.setup()
    renderHome({ desktop: true })
    vi.mocked(api.archiveList).mockImplementation(() => {
      vi.mocked(api.fetchLists).mockResolvedValue([inbox])
      vi.mocked(api.fetchArchivedLists).mockResolvedValue([casa, viejas])
      return Promise.resolve()
    })

    await user.click(await screen.findByRole('button', { name: 'Opciones de «Casa»' }))
    await user.click(await screen.findByRole('menuitem', { name: 'Archivar' }))

    await waitFor(() => {
      expect(
        within(screen.getByRole('main')).queryByRole('link', { name: /^Casa/ }),
      ).not.toBeInTheDocument()
    })
    expect(await screen.findByText('«Casa» archivada')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Deshacer' })).toBeInTheDocument()
    expect(api.archiveList).toHaveBeenCalledWith('casa')
  })

  it('borrar: pide confirmación diciendo cuántos ítems se pierden', async () => {
    const user = userEvent.setup()
    vi.mocked(api.deleteList).mockResolvedValue()
    renderHome({ desktop: true })

    await user.click(await screen.findByRole('button', { name: 'Opciones de «Casa»' }))
    await user.click(await screen.findByRole('menuitem', { name: 'Borrar' }))

    const confirm = await screen.findByRole('alertdialog', { name: '¿Borrar «Casa»?' })
    expect(confirm).toHaveTextContent('Se borrará «Casa» y sus 12 ítems. No hay vuelta atrás.')
    expect(api.deleteList).not.toHaveBeenCalled()
    await user.click(within(confirm).getByRole('button', { name: 'Borrar' }))

    expect(api.deleteList).toHaveBeenCalledWith('casa')
  })

  it('archivadas: sección colapsada que se despliega con «Desarchivar»', async () => {
    const user = userEvent.setup()
    vi.mocked(api.unarchiveList).mockResolvedValue()
    renderHome()

    const toggle = await screen.findByRole('button', { name: '1 lista archivada' })
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    await user.click(toggle)

    const section = screen.getByRole('region', { name: 'Listas archivadas' })
    expect(within(section).getByText('4 pendientes · archivada el 12 sep')).toBeInTheDocument()
    await user.click(within(section).getByRole('button', { name: 'Desarchivar' }))
    expect(api.unarchiveList).toHaveBeenCalledWith('viejas')
  })

  it('«En mente» no tiene menú', async () => {
    renderHome({ desktop: true })
    await screen.findByRole('button', { name: 'Opciones de «Casa»' })
    expect(screen.queryByRole('button', { name: /Opciones de «En mente»/ })).not.toBeInTheDocument()
  })
})
