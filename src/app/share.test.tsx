import { onlineManager } from '@tanstack/react-query'
import { screen, waitFor } from '@testing-library/react'
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
    position: 2000,
    counters: { pending: 0, done: 0, pendingPriceCents: 0 },
    archivedAt: null,
    isOwner: true,
    ...overrides,
  }
}

const inbox = list('i', 'En mente', { kind: 'inbox', color: 'indigo', position: 1000 })
const all = [inbox, list('casa', 'Casa')]
const GRAFICA = 'https://www.pccomponentes.com/gigabyte-geforce-rtx-5070'
const grafica = {
  title: 'Gigabyte GeForce RTX 5070 Gaming OC 12GB',
  image: 'https://img.pccomponentes.com/rtx-5070.jpg',
  siteName: 'PcComponentes',
  price: { cents: 61990, currency: 'EUR' },
}

function renderAt(path: string) {
  vi.mocked(listsApi.fetchLists).mockResolvedValue(all)
  vi.mocked(listsApi.fetchArchivedLists).mockResolvedValue([])
  vi.mocked(itemsApi.fetchItems).mockReturnValue(new Promise(() => undefined))
  vi.mocked(itemsApi.fetchMovedFromInbox).mockResolvedValue([])
  vi.mocked(itemsApi.createItem).mockResolvedValue()
  vi.mocked(itemsApi.updateItem).mockResolvedValue()
  vi.mocked(itemsApi.deleteItem).mockResolvedValue()
  return renderRoute(path, {
    session,
    seed: (queryClient) => {
      queryClient.setQueryData(queryKeys.lists.all, all)
      queryClient.setQueryData(queryKeys.lists.archived, [])
      queryClient.setQueryData(queryKeys.items.byList('i'), [])
    },
  })
}

const share = (params: Record<string, string>) => `/share?${new URLSearchParams(params).toString()}`

describe('compartir a OnMyMind (4.7)', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    onlineManager.setOnline(true)
  })
  afterEach(() => {
    onlineManager.setOnline(true)
  })

  it('un enlace desde Android se guarda directo en «En mente», que se abre con «Deshacer»', async () => {
    const user = userEvent.setup()
    vi.mocked(itemsApi.fetchLinkMetadata).mockResolvedValue(grafica)
    const { router } = renderAt(share({ title: grafica.title, text: GRAFICA }))

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/lists/i')
    })
    expect(router.state.location.search).toEqual({})
    expect(itemsApi.createItem).toHaveBeenCalledTimes(1)
    expect(itemsApi.createItem).toHaveBeenCalledWith(
      expect.objectContaining({
        listId: 'i',
        kind: 'note',
        title: grafica.title,
        link: expect.objectContaining({ url: GRAFICA, urlTitle: null }) as unknown,
      }),
    )
    expect(await screen.findByText(grafica.title)).toBeInTheDocument()
    // Llega la página: el nombre de la web y la imagen, sin precio (en «En mente» no es compra).
    await waitFor(() => {
      expect(itemsApi.updateItem).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ urlSite: 'PcComponentes', imageUrl: grafica.image }),
      )
    })
    expect(itemsApi.updateItem).not.toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ priceCents: expect.anything() as unknown }),
    )

    expect(screen.getByText('Guardado en En mente')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Deshacer' }))
    await waitFor(() => {
      expect(itemsApi.deleteItem).toHaveBeenCalled()
    })
  })

  it('el Atajo del iPhone (solo `url`): el dominio, que pasa a ser el título de la página', async () => {
    vi.mocked(itemsApi.fetchLinkMetadata).mockResolvedValue(grafica)
    const { router } = renderAt(share({ url: GRAFICA }))
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/lists/i')
    })
    expect(itemsApi.createItem).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'pccomponentes.com' }),
    )
    await waitFor(() => {
      expect(itemsApi.updateItem).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ title: grafica.title }),
      )
    })
    expect(await screen.findByText(grafica.title)).toBeInTheDocument()
  })

  it('sin red se guarda igual, con el dominio, y se completa al volver', async () => {
    vi.mocked(itemsApi.fetchLinkMetadata).mockResolvedValue(grafica)
    onlineManager.setOnline(false)
    const { router } = renderAt(share({ text: GRAFICA }))
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/lists/i')
    })
    expect((await screen.findAllByText('pccomponentes.com')).length).toBeGreaterThan(0)
    expect(itemsApi.createItem).not.toHaveBeenCalled()

    onlineManager.setOnline(true)
    await waitFor(() => {
      expect(itemsApi.createItem).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'pccomponentes.com' }),
      )
    })
    await waitFor(() => {
      expect(itemsApi.updateItem).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ title: grafica.title }),
      )
    })
  })

  it('un texto sin enlace va a «En mente» como nota, con el resto en las notas', async () => {
    const { router } = renderAt(share({ text: 'Bizcocho de yogur\n3 huevos\n1 yogur' }))
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/lists/i')
    })
    expect(itemsApi.createItem).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Bizcocho de yogur',
        notes: 'Bizcocho de yogur\n3 huevos\n1 yogur',
      }),
    )
    expect(itemsApi.fetchLinkMetadata).not.toHaveBeenCalled()
  })

  it('sin nada que guardar, va a Inicio sin guardar nada', async () => {
    const { router } = renderAt('/share')
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/')
    })
    expect(itemsApi.createItem).not.toHaveBeenCalled()
  })
})
