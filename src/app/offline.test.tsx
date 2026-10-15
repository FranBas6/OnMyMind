import { onlineManager } from '@tanstack/react-query'
import { act, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import * as itemsApi from '@/features/items/api'
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
      kinds: { note: 0, task: 0, shopping: 0, event: 0 },
    },
    archivedAt: null,
    isOwner: true,
    hidden: false,
    ...overrides,
  }
}

const inbox = list('i', 'En mente', { kind: 'inbox', color: 'indigo', position: 1000 })
const casa = list('casa', 'Casa')

/** `downloaded: false`: nada de la lista en caché, y pedirla falla por red (como sin conexión). */
function renderAt(path: string, { downloaded = true } = {}) {
  vi.mocked(listsApi.fetchLists).mockResolvedValue([inbox, casa])
  vi.mocked(listsApi.fetchArchivedLists).mockResolvedValue([])
  vi.mocked(listsApi.fetchRecentCaptures).mockResolvedValue([])
  if (downloaded) vi.mocked(itemsApi.fetchItems).mockResolvedValue([])
  else vi.mocked(itemsApi.fetchItems).mockRejectedValue(new TypeError('Failed to fetch'))
  vi.mocked(itemsApi.fetchMovedFromInbox).mockResolvedValue([])
  return renderRoute(path, {
    session,
    seed: (queryClient) => {
      queryClient.setQueryData(queryKeys.lists.all, [inbox, casa])
      queryClient.setQueryData(queryKeys.lists.archived, [])
      queryClient.setQueryData(queryKeys.items.latest('i', 3), [])
      if (downloaded) queryClient.setQueryData(queryKeys.items.byList('i'), [])
    },
  })
}

describe('sin conexión', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })
  afterEach(() => {
    onlineManager.setOnline(true)
  })

  it('la banda dice «Sin conexión» y cuántos cambios esperan; al volver, que se enviaron', async () => {
    const user = userEvent.setup()
    vi.mocked(itemsApi.createItem).mockResolvedValue()
    onlineManager.setOnline(false)
    renderAt('/lists/i')

    const band = await screen.findByRole('status')
    expect(band).toHaveTextContent('Sin conexión')

    await user.type(
      await screen.findByRole('textbox', { name: '¿Qué tienes en mente?' }),
      'Comprar pilas{Enter}',
    )
    expect(within(band).getByText('1 por enviar')).toBeInTheDocument()
    expect(itemsApi.createItem).not.toHaveBeenCalled()

    act(() => {
      onlineManager.setOnline(true)
    })
    expect(await screen.findByText('Ya hay conexión · 1 cambio enviado')).toBeInTheDocument()
    expect(itemsApi.createItem).toHaveBeenCalled()
  })

  it('con red no hay banda', async () => {
    renderAt('/')
    expect(await screen.findByRole('heading', { level: 1, name: 'Mis listas' })).toBeInTheDocument()
    expect(screen.queryByText('Sin conexión')).not.toBeInTheDocument()
  })

  it('una lista que nunca se abrió aquí lo dice, y se le puede añadir igual', async () => {
    const user = userEvent.setup()
    onlineManager.setOnline(false)
    renderAt('/lists/casa', { downloaded: false })
    await screen.findByRole('heading', { level: 1, name: 'Casa' })

    expect(await screen.findByText('Esta lista aún no está en este ordenador.')).toBeInTheDocument()
    await user.type(
      screen.getByRole('textbox', { name: /Añadir a Casa/ }),
      'Arreglar el grifo{Enter}',
    )

    expect(await screen.findByRole('button', { name: 'Arreglar el grifo' })).toBeInTheDocument()
    expect(screen.queryByText(/aún no está en este/)).not.toBeInTheDocument()
  })
})
