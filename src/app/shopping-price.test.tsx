import { onlineManager } from '@tanstack/react-query'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import * as itemsApi from '@/features/items/api'
import type { Item } from '@/features/items'
import * as listsApi from '@/features/lists/api'
import type { List } from '@/features/lists'
import { queryKeys } from '@/lib/queryKeys'
import { lineText } from '@/test/text'
import { fakeSession, renderRoute } from '@/test/render-route'

vi.mock('@/features/items/api')
vi.mock('@/features/lists/api')

const session = fakeSession()
const DAY = 24 * 60 * 60 * 1000
const ID = {
  camiseta: '00000000-0000-4000-8000-000000000001',
  auriculares: '00000000-0000-4000-8000-000000000002',
  pilas: '00000000-0000-4000-8000-000000000003',
  cable: '00000000-0000-4000-8000-000000000004',
  mochila: '00000000-0000-4000-8000-000000000005',
  informe: '00000000-0000-4000-8000-000000000006',
}
const URL_CAMISETA = 'https://shop.realmadrid.com/products/camiseta'

const inbox: List = {
  id: 'i',
  name: 'En mente',
  color: 'indigo',
  icon: null,
  kind: 'inbox',
  position: 1000,
  counters: { pending: 0, done: 0, pendingPriceCents: 0 },
  archivedAt: null,
  isOwner: true,
}
const compras: List = { ...inbox, id: 'compras', name: 'Compras', color: 'blue', kind: 'shopping' }
const trabajo: List = { ...inbox, id: 'trabajo', name: 'Trabajo', color: 'pink', kind: 'tasks' }

function item(id: string, title: string, overrides: Partial<Item> = {}): Item {
  return {
    id,
    listId: 'compras',
    kind: 'shopping',
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
    createdAt: new Date(Date.now() - DAY),
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
    priceTracking: null,
    createdBy: null,
    completedBy: null,
    ...overrides,
  }
}

function renderList(list: List, items: Item[], open?: string) {
  const lists = [inbox, list]
  vi.mocked(listsApi.fetchLists).mockResolvedValue(lists)
  vi.mocked(listsApi.fetchArchivedLists).mockResolvedValue([])
  vi.mocked(itemsApi.fetchItems).mockReturnValue(new Promise(() => undefined))
  vi.mocked(itemsApi.updateItem).mockResolvedValue()
  return renderRoute(open ? `/lists/${list.id}?item=${open}` : `/lists/${list.id}`, {
    session,
    seed: (queryClient) => {
      queryClient.setQueryData(queryKeys.lists.all, lists)
      queryClient.setQueryData(queryKeys.lists.archived, [])
      queryClient.setQueryData(queryKeys.items.byList(list.id), items)
    },
  })
}

const detail = () => screen.findByRole('dialog', { name: /Detalle de/ })
const rows = () =>
  within(screen.getByRole('list', { name: 'Ítems', hidden: true })).getAllByRole('listitem', {
    hidden: true,
  })
describe('el precio de las compras (diseño 16)', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    onlineManager.setOnline(true)
  })
  afterEach(() => {
    onlineManager.setOnline(true)
  })

  it('escribir el precio a mano: se guarda como «Puesto a mano», sale en la fila y suma al total', async () => {
    const user = userEvent.setup()
    renderList(compras, [item(ID.pilas, 'Pilas recargables AA')], ID.pilas)
    const sheet = await detail()

    // Sin precio, la fila gris «Añadir precio» (B2) y ningún total.
    expect(screen.queryByText('Total', { exact: true })).not.toBeInTheDocument()
    await user.click(within(sheet).getByRole('button', { name: 'Añadir precio' }))
    const field = within(sheet).getByRole('textbox', { name: 'Precio' })
    expect(field).toHaveFocus()
    expect(field).toHaveAttribute('inputmode', 'decimal')
    expect(within(sheet).getByText('Se guarda como «Puesto a mano».')).toBeInTheDocument()

    // Lo que no es un precio lo dice y no se guarda (B4).
    await user.type(field, '9,99,5{Enter}')
    expect(within(sheet).getByRole('alert')).toHaveTextContent('Eso no parece un precio.')
    expect(itemsApi.updateItem).not.toHaveBeenCalled()

    await user.clear(field)
    await user.type(field, '9,99{Enter}')
    expect(itemsApi.updateItem).toHaveBeenCalledWith(ID.pilas, {
      priceCents: 999,
      priceSource: 'manual',
      currency: 'EUR',
    })

    // El bloque (B7, a mano): el precio, de dónde y cuándo, y que es el primero.
    const block = await within(sheet).findByRole('region', { name: 'Precio' })
    expect(block).toHaveTextContent('9,99 €')
    expect(within(block).getByText('puesto a mano · ahora')).toBeInTheDocument()
    expect(
      within(block).getByText('Es el primer precio. El histórico aparece cuando cambie.'),
    ).toBeInTheDocument()

    // La fila lo lleva a la derecha, y la cabecera el total (A1).
    expect(rows()[0]).toHaveTextContent('9,99 €')
    expect(screen.getByText('Total', { exact: true }).parentElement).toHaveTextContent('9,99 €')
  })

  it('cambiar y quitar un precio', async () => {
    const user = userEvent.setup()
    renderList(
      compras,
      [item(ID.pilas, 'Teclado Keychron K2', { priceCents: 9900, priceSource: 'manual' })],
      ID.pilas,
    )
    const sheet = await detail()

    await user.click(within(sheet).getByRole('button', { name: 'Cambiar' }))
    const field = within(sheet).getByRole('textbox', { name: 'Precio' })
    expect(field).toHaveValue('99')
    await user.click(within(sheet).getByRole('button', { name: 'Quitar precio' }))
    expect(itemsApi.updateItem).toHaveBeenCalledWith(ID.pilas, {
      priceCents: null,
      priceSource: null,
    })
    expect(await within(sheet).findByRole('button', { name: 'Añadir precio' })).toBeInTheDocument()
  })

  it('pegar el enlace de una compra sin precio trae el precio y la tienda de la web', async () => {
    const user = userEvent.setup()
    vi.mocked(itemsApi.fetchLinkMetadata).mockResolvedValue({
      title: 'Camiseta 1.ª equipación 25/26',
      image: 'https://cdn.realmadrid.com/camiseta.jpg',
      siteName: 'Real Madrid CF',
      price: { cents: 10000, currency: 'EUR' },
    })
    renderList(compras, [item(ID.camiseta, 'Camiseta del Madrid')], ID.camiseta)
    const sheet = await detail()

    await user.click(within(sheet).getByRole('button', { name: '+ Enlace' }))
    await user.paste(URL_CAMISETA)
    await waitFor(() => {
      expect(itemsApi.updateItem).toHaveBeenCalledWith(ID.camiseta, {
        urlTitle: 'Camiseta 1.ª equipación 25/26',
        urlSite: 'Real Madrid CF',
        imageUrl: 'https://cdn.realmadrid.com/camiseta.jpg',
        priceCents: 10000,
        currency: 'EUR',
        priceSource: 'web',
      })
    })
    const block = await within(sheet).findByRole('region', { name: 'Precio' })
    expect(block).toHaveTextContent('100 €')
    expect(
      within(block).getByText(lineText('Real Madrid CF · de la web · ahora')),
    ).toBeInTheDocument()
  })

  it('lo escrito a mano no se pisa con el precio de la web', async () => {
    const user = userEvent.setup()
    vi.mocked(itemsApi.fetchLinkMetadata).mockResolvedValue({
      title: 'Camiseta',
      image: null,
      price: { cents: 10000, currency: 'EUR' },
    })
    renderList(
      compras,
      [item(ID.camiseta, 'Camiseta', { priceCents: 8500, priceSource: 'manual' })],
      ID.camiseta,
    )
    const sheet = await detail()

    await user.click(within(sheet).getByRole('button', { name: '+ Enlace' }))
    await user.paste(URL_CAMISETA)
    await waitFor(() => {
      expect(itemsApi.updateItem).toHaveBeenCalledWith(ID.camiseta, {
        urlTitle: 'Camiseta',
        urlSite: null,
      })
    })
    expect(within(sheet).getByRole('region', { name: 'Precio' })).toHaveTextContent('85 €')
  })

  it('si la web no da el precio, se dice sin que suene a error', async () => {
    vi.mocked(itemsApi.fetchLinkMetadata).mockResolvedValue({
      title: null,
      image: null,
      siteName: null,
      price: null,
    })
    renderList(
      compras,
      [
        item(ID.camiseta, 'Soporte para el portátil', {
          url: 'https://www.amazon.es/dp/B0',
          urlTitle: '',
        }),
      ],
      ID.camiseta,
    )
    const sheet = await detail()

    // Ya tenía el título buscado: se pide solo por el precio, una vez.
    expect(
      await within(sheet).findByText('La web no da el precio. Puedes escribirlo tú.'),
    ).toBeInTheDocument()
    expect(itemsApi.fetchLinkMetadata).toHaveBeenCalledTimes(1)
    expect(itemsApi.updateItem).not.toHaveBeenCalled()
    expect(within(sheet).getByRole('button', { name: 'Añadir precio' })).toBeInTheDocument()
  })

  it('sin conexión, el precio se buscará al volver', async () => {
    onlineManager.setOnline(false)
    renderList(
      compras,
      [item(ID.camiseta, 'Camiseta del Madrid', { url: URL_CAMISETA, urlTitle: null })],
      ID.camiseta,
    )
    const sheet = await detail()

    expect(
      await within(sheet).findByText('El precio se buscará al volver la conexión.'),
    ).toBeInTheDocument()
    expect(itemsApi.fetchLinkMetadata).not.toHaveBeenCalled()
  })

  it('la variación en la fila y en el bloque, y lo comprado con su precio', async () => {
    renderList(
      compras,
      [
        item(ID.auriculares, 'Auriculares Sony', {
          priceCents: 27900,
          previousPriceCents: 30200,
          priceSource: 'web',
          urlSite: 'PcComponentes',
          priceCheckedAt: new Date(2026, 6, 30, 12),
        }),
        item(ID.camiseta, 'Teclado Keychron', {
          priceCents: 9900,
          previousPriceCents: 9600,
          position: 2000,
        }),
        item(ID.pilas, 'Pilas recargables AA', { position: 3000 }),
        item(ID.cable, 'Cable USB-C', {
          status: 'bought',
          completedAt: new Date(),
          priceCents: 1200,
        }),
      ],
      ID.auriculares,
    )
    const sheet = await detail()

    const [first, second, third] = rows()
    expect(first).toHaveTextContent('279 €')
    expect(first).toHaveTextContent('↓ 8 %')
    expect(within(first ?? document.body).getByText(', ha bajado un 8 %')).toBeInTheDocument()
    expect(second).toHaveTextContent('↑ 3 %')
    // Sin precio, la fila es la de siempre.
    expect(third).not.toHaveTextContent('€')
    expect(
      within(screen.getByRole('region', { name: 'Fuera de la cabeza', hidden: true })).getByText(
        'Comprado · 12 €',
      ),
    ).toBeInTheDocument()

    const block = within(sheet).getByRole('region', { name: 'Precio' })
    expect(block).toHaveTextContent('↓ 8 % desde 302 €')
    expect(
      within(block).getByText(lineText('PcComponentes · de la web · mirado el 30 jul')),
    ).toBeInTheDocument()
    expect(within(block).queryByText(/Es el primer precio/)).not.toBeInTheDocument()
    // Lo comprado no suma al total.
    expect(screen.getByText('Total', { exact: true }).parentElement).toHaveTextContent('378 €')
  })

  it('«Trabajo», mixta, enseña su total; un precio en dólares va aparte', async () => {
    renderList(trabajo, [
      item(ID.informe, 'Enviar informe', { listId: 'trabajo', kind: 'task' }),
      item(ID.auriculares, 'Monitor Dell 27"', {
        listId: 'trabajo',
        priceCents: 21900,
        position: 2000,
      }),
      item(ID.mochila, 'Mochila de cabina', {
        listId: 'trabajo',
        priceCents: 4900,
        currency: 'USD',
        position: 3000,
      }),
    ])

    await screen.findByRole('heading', { level: 1, name: 'Trabajo' })
    const total = screen.getByText('Total', { exact: true }).parentElement
    expect(total).toHaveTextContent('219 €')
    expect(total).toHaveTextContent('y 49 US$ aparte')
    expect(rows()[2]).toHaveTextContent('49 US$')
  })

  it('pasar una compra a tarea avisa de que se quita el precio', async () => {
    const user = userEvent.setup()
    renderList(
      compras,
      [item(ID.pilas, 'Pilas', { priceCents: 999, priceSource: 'manual' })],
      ID.pilas,
    )
    const sheet = await detail()

    await user.click(within(sheet).getByRole('button', { name: /^Tipo/ }))
    const kinds = await screen.findByRole('radiogroup', { name: 'Tipo del ítem' })
    await user.click(within(kinds).getByRole('radio', { name: /Tarea/ }))
    expect(
      screen.getByText('Al pasar a Tarea se quita el precio. Pendiente sigue siendo Pendiente.'),
    ).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Cambiar a Tarea' }))
    expect(itemsApi.updateItem).toHaveBeenCalledWith(ID.pilas, {
      kind: 'task',
      status: 'pending',
      priceCents: null,
      priceSource: null,
    })
  })
})
