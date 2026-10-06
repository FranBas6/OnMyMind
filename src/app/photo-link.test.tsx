import { onlineManager } from '@tanstack/react-query'
import { screen, waitFor, within } from '@testing-library/react'
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
const URL_CAMISETA = 'https://shop.realmadrid.com/es-es/camiseta'

const inbox: List = {
  id: 'i',
  name: 'En mente',
  color: 'indigo',
  icon: null,
  kind: 'inbox',
  position: 1000,
  counters: { pending: 1, done: 0, pendingPriceCents: 0 },
  archivedAt: null,
  isOwner: true,
}

function item(id: string, title: string, overrides: Partial<Item> = {}): Item {
  return {
    id,
    listId: 'i',
    kind: 'note',
    parentId: null,
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
    priceLinkId: null,
    priceStore: null,
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

const detail = () => screen.findByRole('dialog', { name: /Detalle de/ })

describe('una foto y un enlace en cualquier ítem (diseño 15)', () => {
  beforeAll(() => {
    URL.createObjectURL = vi.fn(() => 'blob:preview')
    URL.revokeObjectURL = vi.fn()
  })
  beforeEach(() => {
    vi.resetAllMocks()
    onlineManager.setOnline(true)
  })
  afterEach(() => {
    onlineManager.setOnline(true)
  })

  it('pegar un enlace lo guarda y trae solo el título y la imagen de la página', async () => {
    const user = userEvent.setup()
    vi.mocked(itemsApi.fetchLinkMetadata).mockResolvedValue({
      title: 'Camiseta 1.ª equipación 25/26',
      image: 'https://cdn.realmadrid.com/camiseta.jpg',
    })
    renderInbox([item(ID.camiseta, 'Quiero la camiseta del Madrid')], ID.camiseta)
    const sheet = await detail()

    // Sin nada, «+ Foto» y «+ Enlace» bajo las notas (M1).
    expect(within(sheet).getByRole('button', { name: '+ Foto' })).toBeEnabled()
    await user.click(within(sheet).getByRole('button', { name: '+ Enlace' }))
    const field = within(sheet).getByRole('textbox', { name: 'Pega un enlace' })
    expect(field).toHaveFocus()

    // Lo que no es un enlace lo dice y espera (M6).
    await user.type(field, 'camiseta madrid talla m{Enter}')
    expect(within(sheet).getByText('Eso no parece un enlace.')).toBeInTheDocument()
    expect(itemsApi.updateItem).not.toHaveBeenCalled()

    await user.clear(field)
    await user.paste(URL_CAMISETA)
    await waitFor(() => {
      expect(itemsApi.updateItem).toHaveBeenCalledWith(ID.camiseta, {
        url: URL_CAMISETA,
        urlTitle: null,
        urlSite: null,
      })
    })
    expect(itemsApi.fetchLinkMetadata).toHaveBeenCalledWith(URL_CAMISETA)
    await waitFor(() => {
      expect(itemsApi.updateItem).toHaveBeenCalledWith(ID.camiseta, {
        urlTitle: 'Camiseta 1.ª equipación 25/26',
        urlSite: null,
        imageUrl: 'https://cdn.realmadrid.com/camiseta.jpg',
      })
    })

    // El título y el dominio, y la imagen de la web como foto (M4).
    expect(await within(sheet).findByText('Camiseta 1.ª equipación 25/26')).toBeInTheDocument()
    expect(within(sheet).getByText('shop.realmadrid.com')).toBeInTheDocument()
    expect(within(sheet).getByRole('link', { name: 'Abrir shop.realmadrid.com' })).toHaveAttribute(
      'href',
      URL_CAMISETA,
    )
    expect(within(sheet).getByText('De la web')).toBeInTheDocument()
    expect(within(sheet).queryByRole('button', { name: '+ Foto' })).not.toBeInTheDocument()
  })

  it('una web que no da título se queda con el dominio y la ruta, sin error', async () => {
    const user = userEvent.setup()
    vi.mocked(itemsApi.fetchLinkMetadata).mockResolvedValue({ title: null, image: null })
    renderInbox([item(ID.camiseta, 'Camiseta')], ID.camiseta)
    const sheet = await detail()

    await user.click(within(sheet).getByRole('button', { name: '+ Enlace' }))
    await user.type(
      within(sheet).getByRole('textbox', { name: 'Pega un enlace' }),
      'tiendamadridista.es/p/1024{Enter}',
    )
    await waitFor(() => {
      expect(itemsApi.updateItem).toHaveBeenCalledWith(ID.camiseta, { urlTitle: '', urlSite: null })
    })
    expect(await within(sheet).findByText('tiendamadridista.es')).toBeInTheDocument()
    expect(within(sheet).getByText('tiendamadridista.es/p/1024')).toBeInTheDocument()
    // Sin foto, «+ Foto» sigue debajo, a todo el ancho.
    expect(within(sheet).getByRole('button', { name: '+ Foto' })).toBeInTheDocument()

    await user.click(within(sheet).getByRole('button', { name: 'Quitar el enlace' }))
    expect(itemsApi.updateItem).toHaveBeenLastCalledWith(ID.camiseta, {
      url: null,
      urlTitle: null,
      urlSite: null,
    })
    expect(await within(sheet).findByRole('button', { name: '+ Enlace' })).toBeInTheDocument()
  })

  it('si la función no contesta, no guarda «sin título»: se vuelve a intentar', async () => {
    const user = userEvent.setup()
    vi.mocked(itemsApi.fetchLinkMetadata).mockRejectedValue(new Error('fetch-metadata no contesta'))
    renderInbox([item(ID.camiseta, 'Camiseta')], ID.camiseta)
    const sheet = await detail()

    await user.click(within(sheet).getByRole('button', { name: '+ Enlace' }))
    await user.paste(URL_CAMISETA)
    // Sale con su dominio y su ruta, sin quedarse buscando…
    expect(
      await within(sheet).findByText('shop.realmadrid.com/es-es/camiseta', {}, { timeout: 3000 }),
    ).toBeInTheDocument()
    expect(within(sheet).queryByText('Buscando título…')).not.toBeInTheDocument()
    // …y sin guardar `urlTitle`: solo se guardó el enlace.
    expect(itemsApi.updateItem).toHaveBeenCalledTimes(1)
    expect(itemsApi.updateItem).toHaveBeenCalledWith(ID.camiseta, {
      url: URL_CAMISETA,
      urlTitle: null,
      urlSite: null,
    })
  })

  it('subir una foto: «Subiendo…», y si falla, «Reintentar»', async () => {
    const user = userEvent.setup()
    vi.mocked(photos.uploadItemPhoto)
      .mockRejectedValueOnce(new Error('caída'))
      .mockResolvedValueOnce('u/i/foto.webp')
    vi.mocked(photos.signedPhotoUrl).mockResolvedValue('https://storage.local/foto-thumb.webp')
    renderInbox([item(ID.pizarra, 'Pizarra de la reunión del lunes')], ID.pizarra)
    const sheet = await detail()

    const file = new File(['png'], 'pizarra.png', { type: 'image/png' })
    await user.upload(within(sheet).getByLabelText('Elegir una foto'), file)

    expect(await within(sheet).findByText('No se ha podido subir la foto.')).toBeInTheDocument()
    expect(itemsApi.updateItem).not.toHaveBeenCalled()
    await user.click(within(sheet).getByRole('button', { name: 'Reintentar' }))

    await waitFor(() => {
      expect(itemsApi.updateItem).toHaveBeenCalledWith(ID.pizarra, {
        imagePath: 'u/i/foto.webp',
        imageUrl: null,
      })
    })
    expect(photos.uploadItemPhoto).toHaveBeenCalledTimes(2)
    expect(photos.uploadItemPhoto).toHaveBeenLastCalledWith(ID.pizarra, file)
    expect(
      await within(sheet).findByRole('button', {
        name: 'Ver la foto de «Pizarra de la reunión del lunes»',
      }),
    ).toBeEnabled()
  })

  it('la foto en grande, con «Cambiar» y «Quitar»', async () => {
    const user = userEvent.setup()
    vi.mocked(photos.signedPhotoUrl).mockImplementation((path, size) =>
      Promise.resolve(`https://storage.local/${path}-${size}`),
    )
    renderInbox([item(ID.pizarra, 'Pizarra', { imagePath: 'u/i/foto.webp' })], ID.pizarra)
    const sheet = await detail()

    await user.click(await within(sheet).findByRole('button', { name: 'Ver la foto de «Pizarra»' }))
    const viewer = await screen.findByRole('dialog', { name: 'Pizarra' })
    expect(await within(viewer).findByRole('img', { name: 'Foto de «Pizarra»' })).toHaveAttribute(
      'src',
      'https://storage.local/u/i/foto.webp-full',
    )
    expect(within(viewer).getByRole('button', { name: 'Cambiar' })).toBeEnabled()
    await user.click(within(viewer).getByRole('button', { name: 'Quitar' }))

    expect(itemsApi.updateItem).toHaveBeenCalledWith(ID.pizarra, {
      imagePath: null,
      imageUrl: null,
    })
    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'Pizarra' })).not.toBeInTheDocument()
    })
    expect(await within(sheet).findByRole('button', { name: '+ Foto' })).toBeInTheDocument()
  })

  it('sin conexión: el enlace espera su título y la foto necesita conexión', async () => {
    onlineManager.setOnline(false)
    renderInbox([item(ID.camiseta, 'Camiseta', { url: URL_CAMISETA, urlTitle: null })], ID.camiseta)
    const sheet = await detail()

    expect(within(sheet).getByText('Sin conexión')).toBeInTheDocument()
    expect(
      within(sheet).getByText('El título se buscará al volver la conexión.'),
    ).toBeInTheDocument()
    expect(within(sheet).getByText('shop.realmadrid.com')).toBeInTheDocument()
    expect(within(sheet).getByRole('button', { name: /\+ Foto/ })).toBeDisabled()
    expect(within(sheet).getByRole('button', { name: /\+ Foto/ })).toHaveTextContent(
      'Necesita conexión',
    )
    expect(itemsApi.fetchLinkMetadata).not.toHaveBeenCalled()
  })

  it('en la fila: la miniatura y el dominio del enlace; sin nada, como siempre', async () => {
    renderInbox([
      item(ID.camiseta, 'Quiero la camiseta del Madrid', {
        url: URL_CAMISETA,
        urlTitle: 'Camiseta',
        imageUrl: 'https://cdn.realmadrid.com/camiseta.jpg',
      }),
      item(ID.pizarra, 'Comprar pilas AA', { position: 2000 }),
    ])

    const rows = within(await screen.findByRole('list', { name: 'Ítems' })).getAllByRole('listitem')
    const [conTodo, sinNada] = rows
    if (!conTodo || !sinNada) throw new Error('faltan filas')
    expect(conTodo.querySelector('img')).toHaveAttribute(
      'src',
      'https://cdn.realmadrid.com/camiseta.jpg',
    )
    expect(conTodo).toHaveTextContent('Enlace: shop.realmadrid.com')
    expect(sinNada.querySelector('img')).toBeNull()
    expect(sinNada).not.toHaveTextContent('Enlace')
  })
})
