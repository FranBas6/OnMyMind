import { screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { List, RecentCapture } from '@/features/lists'
import { queryKeys } from '@/lib/queryKeys'
import { fakeSession, renderRoute } from '@/test/render-route'

const session = fakeSession()

function list(id: string, name: string, kind: List['kind'], pending: number, cents = 0): List {
  return {
    id,
    name,
    color: 'indigo',
    icon: null,
    kind,
    position: 1000,
    counters: { pending, done: 0, pendingPriceCents: cents },
  }
}

function renderHome(lists: List[], captures: RecentCapture[] = []) {
  return renderRoute('/', {
    session,
    seed: (queryClient) => {
      queryClient.setQueryData(queryKeys.lists.all, lists)
      queryClient.setQueryData(queryKeys.items.latest('i', 3), captures)
      queryClient.setQueryData(['profile', session.user.id, 'display_name'], 'fran')
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

describe('Inicio', () => {
  afterEach(() => {
    setDesktop(false)
  })

  it('«En mente» fijada arriba y el resto en la rejilla, con tipo, contador y total', async () => {
    renderHome([
      list('i', 'En mente', 'inbox', 1),
      list('a', 'Casa', 'tasks', 4),
      list('b', 'Compras', 'shopping', 2, 37800),
    ])

    const inbox = await screen.findByRole('link', { name: /En mente/ })
    expect(inbox).toHaveTextContent('1 cosa sin ordenar')
    expect(inbox).toHaveAttribute('href', '/lists/i')

    const grid = screen.getByRole('list', { name: 'Mis listas' })
    const casa = within(grid).getByRole('link', { name: /Casa/ })
    expect(casa).toHaveTextContent('Tareas')
    expect(casa).toHaveTextContent('4 pendientes')
    const compras = within(grid).getByRole('link', { name: /Compras/ })
    expect(compras).toHaveTextContent('2 pendientes')
    expect(compras).toHaveTextContent('378 €')
    expect(within(grid).queryByText('En mente')).not.toBeInTheDocument()
  })

  it('si solo existe «En mente», estado vacío', async () => {
    renderHome([list('i', 'En mente', 'inbox', 0)])

    expect(await screen.findByText('Aún no hay listas.')).toBeInTheDocument()
    expect(screen.queryByRole('list', { name: 'Mis listas' })).not.toBeInTheDocument()
  })

  it('en escritorio, «En mente» enseña las últimas capturas y la cabecera trae «Nueva lista»', async () => {
    setDesktop(true)
    renderHome(
      [list('i', 'En mente', 'inbox', 2), list('a', 'Casa', 'tasks', 4)],
      [
        { id: 'c1', title: 'Comprar pilas AA', createdAt: new Date() },
        { id: 'c2', title: 'Llamar a Marta', createdAt: new Date(Date.now() - 26 * 3_600_000) },
      ],
    )

    // En escritorio el sidebar también tiene un enlace «En mente»: se busca en el contenido.
    const main = await screen.findByRole('main')
    const inbox = await within(main).findByRole('link', { name: /En mente/ })
    expect(inbox).toHaveTextContent('Comprar pilas AA')
    expect(inbox).toHaveTextContent('ahora')
    expect(inbox).toHaveTextContent('Llamar a Marta')
    expect(within(main).getByRole('button', { name: 'Nueva lista' })).toBeDisabled()
  })
})
