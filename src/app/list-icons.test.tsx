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
    kind: 'list',
    view: 'list',
    position: 2000,
    counters: {
      pending: 4,
      done: 0,
      pendingPriceCents: 0,
      notes: 0,
      kinds: { note: 0, task: 4, shopping: 0, event: 0 },
    },
    archivedAt: null,
    isOwner: true,
    hidden: false,
    ...overrides,
  }
}

const inbox = list('i', 'En mente', { kind: 'inbox', color: 'indigo', position: 1000 })
const casa = list('casa', 'Casa', { icon: 'lucide:house' })
const viajes = list('viajes', 'Viajes', { color: 'teal', icon: 'emoji:✈️', position: 3000 })
const libros = list('libros', 'Libros', { color: 'indigo', position: 4000 })
const mudanza = list('mudanza', 'Mudanza', {
  icon: 'emoji:🧳',
  position: 5000,
  archivedAt: new Date(2026, 8, 12),
})

function renderHome({ desktop = false } = {}) {
  setDesktop(desktop)
  const lists = [inbox, casa, viajes, libros]
  vi.mocked(api.fetchLists).mockResolvedValue(lists)
  vi.mocked(api.fetchArchivedLists).mockResolvedValue([mudanza])
  vi.mocked(api.fetchRecentCaptures).mockResolvedValue([])
  vi.mocked(api.fetchHiddenListIds).mockResolvedValue([])
  return renderRoute('/', {
    session,
    seed: (queryClient) => {
      queryClient.setQueryData(queryKeys.lists.all, lists)
      queryClient.setQueryData(queryKeys.lists.archived, [mudanza])
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

/** La tarjeta de una lista en Inicio. */
const card = (name: string) =>
  within(screen.getByRole('list', { name: 'Mis listas' })).getByRole('link', {
    name: new RegExp(`^${name}`),
  })

describe('iconos y emojis en las listas (5.9, diseño 28)', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })
  afterEach(() => {
    setDesktop(false)
  })

  it('en Inicio, el icono en blanco, el emoji y la inicial; la archivada, apagada', async () => {
    const user = userEvent.setup()
    renderHome()

    await screen.findByRole('list', { name: 'Mis listas' })
    expect(card('Casa').querySelector('svg.lucide-house')).not.toBeNull()
    expect(card('Viajes')).toHaveTextContent('✈️')
    expect(card('Libros')).toHaveTextContent(/^LLibros/)

    await user.click(screen.getByRole('button', { name: '1 lista archivada' }))
    const emoji = await screen.findByText('🧳')
    expect(emoji).toHaveClass('grayscale')
  })

  it('crear con un icono: se elige en la hoja, se ve al momento y se guarda con «Crear»', async () => {
    const user = userEvent.setup()
    renderHome()
    const created = list('cocina', 'Cocina', { icon: 'lucide:utensils', position: 6000 })
    vi.mocked(api.createList).mockResolvedValue(created)

    const [newList] = await screen.findAllByRole('button', { name: 'Nueva lista' })
    if (!newList) throw new Error('Falta «Nueva lista»')
    await user.click(newList)
    const form = await screen.findByRole('dialog', { name: 'Nueva lista' })
    await user.type(within(form).getByLabelText('Nombre de la lista'), 'Cocina')
    expect(
      within(form).getByText('Toca el cuadrado para elegir un icono o un emoji.'),
    ).toBeInTheDocument()

    await user.click(
      within(form).getByRole('button', { name: 'Icono de «Cocina»: elegir un icono o un emoji' }),
    )
    const sheet = await screen.findByRole('dialog', { name: 'Icono de «Cocina»' })
    expect(within(sheet).getByText('Se guarda al crear la lista')).toBeInTheDocument()
    expect(within(sheet).getByRole('radio', { name: /Inicial/ })).toBeChecked()
    await user.click(within(sheet).getByRole('radio', { name: 'Cubiertos' }))
    expect(within(sheet).getByRole('radio', { name: 'Cubiertos' })).toBeChecked()
    await user.click(within(sheet).getByRole('button', { name: 'Listo' }))

    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'Icono de «Cocina»' })).not.toBeInTheDocument()
    })
    // El cuadrado del formulario ya lo enseña, y la pista se va.
    expect(form.querySelector('svg.lucide-utensils')).not.toBeNull()
    expect(within(form).queryByText(/Toca el cuadrado/)).not.toBeInTheDocument()

    await user.click(within(form).getByRole('button', { name: 'Crear' }))
    await waitFor(() => {
      expect(api.createList).toHaveBeenCalledWith(
        { name: 'Cocina', color: 'indigo', icon: 'lucide:utensils' },
        6000,
      )
    })
  })

  it('editar: abre en «Emoji» con el suyo marcado, y «Inicial» vuelve a la letra', async () => {
    const user = userEvent.setup()
    renderHome({ desktop: true })
    vi.mocked(api.updateList).mockResolvedValue()

    await user.click(await screen.findByRole('button', { name: 'Opciones de «Viajes»' }))
    await user.click(await screen.findByRole('menuitem', { name: 'Editar' }))
    const form = await screen.findByRole('dialog', { name: 'Editar lista' })

    await user.click(
      within(form).getByRole('button', { name: 'Icono de «Viajes»: elegir un icono o un emoji' }),
    )
    const popover = await screen.findByRole('dialog', { name: 'Icono de «Viajes»' })
    expect(within(popover).getByRole('tab', { name: 'Emoji' })).toHaveAttribute(
      'aria-selected',
      'true',
    )
    expect(within(popover).getByRole('radio', { name: '✈️' })).toBeChecked()

    // Las flechas se mueven por la rejilla, e Intro elige y cierra.
    within(popover).getByRole('radio', { name: '✈️' }).focus()
    await user.keyboard('{ArrowRight}')
    expect(within(popover).getByRole('radio', { name: '🧳' })).toHaveFocus()
    await user.keyboard('{ArrowUp}{ArrowUp}{ArrowUp}')
    expect(within(popover).getByRole('radio', { name: /Inicial/ })).toHaveFocus()
    await user.keyboard('{Enter}')
    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'Icono de «Viajes»' })).not.toBeInTheDocument()
    })

    await user.click(within(form).getByRole('button', { name: 'Guardar' }))
    await waitFor(() => {
      expect(api.updateList).toHaveBeenCalledWith('viajes', {
        name: 'Viajes',
        color: 'teal',
        icon: null,
      })
    })
  })
})
