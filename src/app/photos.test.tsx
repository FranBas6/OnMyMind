import { onlineManager } from '@tanstack/react-query'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import * as itemsApi from '@/features/items/api'
import type { Item } from '@/features/items'
import * as photos from '@/features/items/photos'
import * as listsApi from '@/features/lists/api'
import type { List } from '@/features/lists'
import { queryKeys } from '@/lib/queryKeys'
import { fakeSession, renderRoute } from '@/test/render-route'

vi.mock('@/features/items/api')
vi.mock('@/features/lists/api')
vi.mock('@/features/items/photos', async (importOriginal) => ({
  ...(await importOriginal<typeof photos>()),
  uploadItemPhoto: vi.fn(),
  signedPhotoUrl: vi.fn(),
}))

const session = fakeSession()
const ID = {
  camiseta: '00000000-0000-4000-8000-000000000001',
  pizarra: '00000000-0000-4000-8000-000000000002',
}

const inbox: List = {
  id: 'i',
  name: 'En mente',
  color: 'indigo',
  icon: null,
  kind: 'inbox',
  view: 'list',
  position: 1000,
  counters: {
    pending: 1,
    done: 0,
    pendingPriceCents: 0,
    notes: 0,
    kinds: { note: 0, task: 0, shopping: 0, event: 0 },
  },
  archivedAt: null,
  isOwner: true,
}

function item(id: string, title: string, overrides: Partial<Item> = {}): Item {
  return {
    id,
    listId: 'i',
    kind: 'note',
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
    createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
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

function renderInbox(items: Item[], open?: string) {
  vi.mocked(listsApi.fetchLists).mockResolvedValue([inbox])
  vi.mocked(listsApi.fetchArchivedLists).mockResolvedValue([])
  vi.mocked(itemsApi.fetchItems).mockReturnValue(new Promise(() => undefined))
  vi.mocked(itemsApi.fetchMovedFromInbox).mockResolvedValue([])
  vi.mocked(itemsApi.updateItem).mockResolvedValue()
  return renderRoute(open ? `/lists/i?item=${open}` : '/lists/i', {
    session,
    seed: (queryClient) => {
      queryClient.setQueryData(queryKeys.lists.all, [inbox])
      queryClient.setQueryData(queryKeys.lists.archived, [])
      queryClient.setQueryData(queryKeys.items.movedFrom('i'), [])
      queryClient.setQueryData(queryKeys.items.byList('i'), items)
    },
  })
}

const foto = (n: number) => ({
  id: `f${String(n)}`,
  path: `u/i/${String(n)}.webp`,
  position: n * 1000,
})
const fotos = (count: number) => Array.from({ length: count }, (_, index) => foto(index + 1))
const conFotos = (count: number) =>
  item(ID.pizarra, 'Reformar la cocina', {
    images: fotos(count),
    imagePath: count > 0 ? foto(1).path : null,
  })
/** La ficha: una hoja en el móvil y un panel en escritorio. */
const panel = () =>
  waitFor(() => {
    const found =
      screen.queryByRole('dialog', { name: /Detalle de/ }) ??
      screen.queryByRole('region', { name: /Detalle de/ })
    if (!found) throw new Error('sin ficha')
    return found
  })
const strip = async () => within(await panel()).findByRole('region', { name: 'Fotos' })

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

describe('varias fotos (4.5, diseño 23, D)', () => {
  beforeAll(() => {
    URL.createObjectURL = vi.fn(() => 'blob:preview')
    URL.revokeObjectURL = vi.fn()
  })
  beforeEach(() => {
    vi.resetAllMocks()
    onlineManager.setOnline(true)
    vi.mocked(photos.signedPhotoUrl).mockImplementation((path, size) =>
      Promise.resolve(`https://storage.local/${path}-${size}`),
    )
    vi.mocked(itemsApi.insertImages).mockResolvedValue()
    vi.mocked(itemsApi.updateImage).mockResolvedValue()
    vi.mocked(itemsApi.deleteImage).mockResolvedValue()
  })
  afterEach(() => {
    onlineManager.setOnline(true)
    setDesktop(false)
  })

  it('la tira: «3 de 10», la primera es la miniatura, y se añaden varias a la vez al final (D2–D4)', async () => {
    const user = userEvent.setup()
    vi.mocked(photos.uploadItemPhoto)
      .mockResolvedValueOnce('u/i/nueva-1.webp')
      .mockResolvedValueOnce('u/i/nueva-2.webp')
    renderInbox([conFotos(3)], ID.pizarra)

    const fotosRegion = await strip()
    expect(fotosRegion).toHaveTextContent('3 de 10')
    expect(
      within(fotosRegion).getByRole('button', { name: 'Foto 1 de 3, la miniatura' }),
    ).toHaveTextContent('Miniatura')
    expect(within(fotosRegion).getByRole('button', { name: 'Foto 2 de 3' })).toBeInTheDocument()

    await user.upload(within(await panel()).getByLabelText('Elegir fotos'), [
      new File(['a'], 'a.png', { type: 'image/png' }),
      new File(['b'], 'b.png', { type: 'image/png' }),
    ])
    await waitFor(() => {
      expect(itemsApi.insertImages).toHaveBeenCalledTimes(2)
    })
    expect(
      vi
        .mocked(itemsApi.insertImages)
        .mock.calls.map(([[image]]) => image?.position)
        .sort(),
    ).toEqual([4000, 5000])
    expect(await strip()).toHaveTextContent('5 de 10')
  })

  it('con 9, de tres elegidas sube una; con 10, ni el cuadrado de añadir (D7)', async () => {
    const user = userEvent.setup()
    vi.mocked(photos.uploadItemPhoto).mockResolvedValue('u/i/nueva.webp')
    renderInbox([conFotos(9)], ID.pizarra)

    await user.upload(within(await panel()).getByLabelText('Elegir fotos'), [
      new File(['a'], 'a.png', { type: 'image/png' }),
      new File(['b'], 'b.png', { type: 'image/png' }),
      new File(['c'], 'c.png', { type: 'image/png' }),
    ])
    await waitFor(() => {
      expect(itemsApi.insertImages).toHaveBeenCalledTimes(1)
    })
    expect(photos.uploadItemPhoto).toHaveBeenCalledTimes(1)
    const fotosRegion = await strip()
    await waitFor(() => {
      expect(fotosRegion).toHaveTextContent('10 de 10')
    })
    expect(
      within(fotosRegion).queryByRole('button', { name: 'Añadir fotos' }),
    ).not.toBeInTheDocument()
    expect(fotosRegion).toHaveTextContent('Has llegado a 10 fotos. Quita alguna para añadir otra.')
  })

  it('el visor pasa de una a otra y «Poner la primera» la hace la miniatura (D8)', async () => {
    const user = userEvent.setup()
    renderInbox([conFotos(3)], ID.pizarra)

    await user.click(within(await strip()).getByRole('button', { name: 'Foto 2 de 3' }))
    const viewer = await screen.findByRole('dialog', { name: 'Reformar la cocina' })
    expect(viewer).toHaveTextContent('2 de 3')
    expect(
      within(viewer).getAllByRole('img', { name: 'Foto de «Reformar la cocina»' }),
    ).toHaveLength(3)

    await user.click(within(viewer).getByRole('button', { name: 'Poner la primera' }))
    await waitFor(() => {
      expect(itemsApi.updateImage).toHaveBeenCalledWith('f2', { position: 0 })
    })
    // El visor la sigue: ahora es la primera, y ya no ofrece ponerla la primera.
    expect(viewer).toHaveTextContent('1 de 3')
    expect(
      within(viewer).queryByRole('button', { name: 'Poner la primera' }),
    ).not.toBeInTheDocument()
    await user.click(within(viewer).getByRole('button', { name: 'Cerrar la foto' }))
    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'Reformar la cocina' })).not.toBeInTheDocument()
    })
  })

  it('en escritorio: el visor con ← →, y el botón derecho de una foto (E6)', async () => {
    const user = userEvent.setup()
    setDesktop(true)
    renderInbox([conFotos(3)], ID.pizarra)

    await user.click(
      await within(await strip()).findByRole('button', { name: 'Foto 1 de 3, la miniatura' }),
    )
    const viewer = await screen.findByRole('dialog', { name: 'Reformar la cocina · 1 de 3' })
    expect(
      within(viewer).queryByRole('button', { name: 'Poner la primera' }),
    ).not.toBeInTheDocument()
    await user.keyboard('{ArrowRight}')
    expect(
      await screen.findByRole('dialog', { name: 'Reformar la cocina · 2 de 3' }),
    ).toBeInTheDocument()
    await user.keyboard('{Escape}')

    fireEvent.contextMenu(within(await strip()).getByRole('button', { name: 'Foto 3 de 3' }))
    await user.click(await screen.findByRole('menuitem', { name: 'Quitar' }))
    await waitFor(() => {
      expect(itemsApi.deleteImage).toHaveBeenCalledWith('f3')
    })
  })

  it('sin conexión, el cuadrado de añadir dice que necesita conexión (D13)', async () => {
    onlineManager.setOnline(false)
    renderInbox([conFotos(2)], ID.pizarra)
    expect(
      within(await strip()).getByRole('button', { name: 'Añadir fotos: necesita conexión' }),
    ).toBeDisabled()
  })

  it('en la fila, la primera con el número de fotos', async () => {
    const { container } = renderInbox([conFotos(5)])
    await screen.findByRole('heading', { level: 1, name: 'En mente' })
    await waitFor(() => {
      expect(container.querySelector('[aria-hidden] > span')).toHaveTextContent('5')
    })
  })
})
