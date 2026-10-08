import { onlineManager } from '@tanstack/react-query'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import * as itemsApi from '@/features/items/api'
import type { Item } from '@/features/items'
import * as listsApi from '@/features/lists/api'
import * as pricesApi from '@/features/prices/api'
import type { List } from '@/features/lists'
import { queryKeys } from '@/lib/queryKeys'
import { lineText } from '@/test/text'
import { fakeSession, renderRoute } from '@/test/render-route'

vi.mock('@/features/items/api')
vi.mock('@/features/lists/api')
vi.mock('@/features/prices/api')

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
    images: [],
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
const URL_SONY = 'https://www.pccomponentes.com/sony-wh-1000xm5'
const sony = (overrides: Partial<Item> = {}) =>
  item(ID.auriculares, 'Auriculares Sony WH-1000XM5', {
    url: URL_SONY,
    urlTitle: 'Sony WH-1000XM5',
    urlSite: 'PcComponentes',
    priceCents: 27900,
    previousPriceCents: 29500,
    priceSource: 'web',
    priceCheckedAt: new Date(2026, 6, 30, 12),
    ...overrides,
  })
const HISTORY = [
  {
    cents: 30200,
    currency: 'EUR',
    source: 'web' as const,
    recordedAt: new Date(Date.now() - 120 * DAY),
    store: null,
  },
  {
    cents: 29500,
    currency: 'EUR',
    source: 'manual' as const,
    recordedAt: new Date(Date.now() - 60 * DAY),
    store: null,
  },
  {
    cents: 27900,
    currency: 'EUR',
    source: 'web' as const,
    recordedAt: new Date(Date.now() - 30 * DAY),
    store: null,
  },
]
const metadata = (
  price: { cents: number; currency: string } | null,
  title: string | null = 'Sony',
) => ({
  title,
  image: null,
  siteName: 'PcComponentes',
  price,
})
const block = async () => within(await detail()).findByRole('region', { name: 'Precio' })

describe('la ficha de compra (diseño 16, 2.2)', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    onlineManager.setOnline(true)
    vi.mocked(pricesApi.fetchPriceHistory).mockResolvedValue(HISTORY)
  })
  afterEach(() => {
    onlineManager.setOnline(true)
  })

  it('«Actualizar precio» trae el precio nuevo de la web y lo dice dentro del bloque', async () => {
    const user = userEvent.setup()
    vi.mocked(itemsApi.fetchLinkMetadata).mockResolvedValue(
      metadata({ cents: 25900, currency: 'EUR' }),
    )
    renderList(compras, [sony()], ID.auriculares)
    const price = await block()

    await user.click(within(price).getByRole('button', { name: 'Actualizar precio' }))
    expect(itemsApi.fetchLinkMetadata).toHaveBeenCalledWith(URL_SONY)
    expect(itemsApi.updateItem).toHaveBeenCalledWith(ID.auriculares, {
      priceCents: 25900,
      currency: 'EUR',
      priceSource: 'web',
    })
    expect(await within(price).findByText('Precio nuevo de la web, ahora.')).toBeInTheDocument()
    expect(price).toHaveTextContent('259 €')
    expect(price).toHaveTextContent('↓ 7 % desde 279 €')
    expect(
      within(price).getByText(lineText('PcComponentes · de la web · ahora')),
    ).toBeInTheDocument()
  })

  it('con el mismo precio solo apunta que se miró', async () => {
    const user = userEvent.setup()
    vi.mocked(itemsApi.fetchLinkMetadata).mockResolvedValue(
      metadata({ cents: 27900, currency: 'EUR' }),
    )
    renderList(compras, [sony()], ID.auriculares)
    const price = await block()

    await user.click(within(price).getByRole('button', { name: 'Actualizar precio' }))
    expect(await within(price).findByText('Sigue a 279 €. Mirado ahora.')).toBeInTheDocument()
    expect(itemsApi.updateItem).toHaveBeenCalledWith(ID.auriculares, {
      priceSource: 'web',
      priceCheckedAt: expect.any(Date) as Date,
    })
  })

  it('si la web no lo da o no deja mirar, invita a escribirlo', async () => {
    const user = userEvent.setup()
    vi.mocked(itemsApi.fetchLinkMetadata)
      .mockResolvedValueOnce(metadata(null))
      .mockResolvedValueOnce(metadata(null, null))
    renderList(compras, [sony()], ID.auriculares)
    const price = await block()

    await user.click(within(price).getByRole('button', { name: 'Actualizar precio' }))
    expect(
      await within(price).findByText(/Esta vez no vemos el precio en la web\. Si lo sabes,/),
    ).toBeInTheDocument()
    await user.click(within(price).getByRole('button', { name: 'Actualizar precio' }))
    expect(
      await within(price).findByText(/La web no nos deja mirar el precio\. Puedes/),
    ).toBeInTheDocument()
    await user.click(within(price).getByRole('button', { name: 'escribirlo tú' }))
    expect(within(await detail()).getByRole('textbox', { name: 'Precio' })).toHaveFocus()
    expect(itemsApi.updateItem).not.toHaveBeenCalled()
  })

  it('sin conexión, «Actualizar precio» espera y lo dice', async () => {
    onlineManager.setOnline(false)
    renderList(
      compras,
      [
        sony(),
        item(ID.pilas, 'Pilas recargables AA', {
          priceCents: 999,
          priceSource: 'manual',
          position: 2000,
        }),
      ],
      ID.auriculares,
    )
    const price = await block()
    const button = within(price).getByRole('button', { name: /Actualizar precio/ })
    expect(button).toBeDisabled()
    expect(button).toHaveTextContent('Necesita conexión')
    onlineManager.setOnline(true)
  })

  it('sin enlace, «Actualizar precio» abre el campo y lo explica', async () => {
    const user = userEvent.setup()
    renderList(
      compras,
      [item(ID.pilas, 'Pilas recargables AA', { priceCents: 999, priceSource: 'manual' })],
      ID.pilas,
    )
    const price = await block()
    await user.click(within(price).getByRole('button', { name: 'Actualizar precio' }))
    const sheet = await detail()
    expect(within(sheet).getByRole('textbox', { name: 'Precio' })).toHaveValue('9,99')
    expect(
      within(sheet).getByText('Sin enlace no hay web que mirar. Escribe el precio nuevo.'),
    ).toBeInTheDocument()
    expect(itemsApi.fetchLinkMetadata).not.toHaveBeenCalled()
  })

  it('el histórico de seis meses, con un punto por cambio; con un solo precio, no', async () => {
    renderList(compras, [sony()], ID.auriculares)
    const price = await block()

    // Con una sola tienda, «Histórico de precios» (diseño 16, B1); el «más bajo» es de varias (19).
    expect(await within(price).findByText('Histórico de precios')).toBeInTheDocument()
    expect(within(price).getByText('6 meses')).toBeInTheDocument()
    expect(pricesApi.fetchPriceHistory).toHaveBeenCalledWith(ID.auriculares)
    // Para quien no ve la gráfica, la misma historia en una frase.
    expect(
      within(price).getByText(/302 € el .+; 295 € el .+, a mano; 279 € el /),
    ).toBeInTheDocument()
  })

  it('con un solo precio no se pide el histórico', async () => {
    renderList(compras, [sony({ previousPriceCents: null })], ID.auriculares)
    const price = await block()
    expect(
      within(price).getByText('Es el primer precio. El histórico aparece cuando cambie.'),
    ).toBeInTheDocument()
    expect(within(price).queryByText('Histórico de precios')).not.toBeInTheDocument()
    expect(pricesApi.fetchPriceHistory).not.toHaveBeenCalled()
  })

  it('comprada: lo que pagaste y lo que ahorraste, sin actualizar', async () => {
    renderList(
      compras,
      [
        sony({
          status: 'bought',
          completedAt: new Date(),
          priceCents: 25900,
          previousPriceCents: 27900,
        }),
      ],
      ID.auriculares,
    )
    const price = await block()

    expect(price).toHaveTextContent('Pagaste259 €')
    expect(await within(price).findByText('Ahorraste 43 €')).toBeInTheDocument()
    expect(
      within(price).getByText('PcComponentes · desde 302 €, su primer precio'),
    ).toBeInTheDocument()
    expect(
      within(price).queryByRole('button', { name: /Actualizar precio/ }),
    ).not.toBeInTheDocument()
    expect(within(price).getByRole('button', { name: 'Cambiar' })).toBeInTheDocument()
  })
})
