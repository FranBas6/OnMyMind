import { onlineManager } from '@tanstack/react-query'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import * as itemsApi from '@/features/items/api'
import type { Item } from '@/features/items'
import type { ItemLink } from '@/features/items/types'
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
  view: 'list',
  position: 1000,
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
}
const compras: List = { ...inbox, id: 'compras', name: 'Compras', color: 'blue', kind: 'shopping' }

function item(id: string, title: string, overrides: Partial<Item> = {}): Item {
  return {
    id,
    listId: 'compras',
    kind: 'shopping',
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
const rows = () =>
  within(screen.getByRole('list', { name: 'Ítems', hidden: true })).getAllByRole('listitem', {
    hidden: true,
  })
const URL_PC = 'https://www.pccomponentes.com/lg-27uq850'
const URL_MM = 'https://www.mediamarkt.es/lg-27uq850'
const URL_LG = 'https://www.lg.com/es/27uq850'
const tienda = (
  id: string,
  url: string,
  site: string,
  price: number | null,
  extra: Partial<ItemLink> = {},
): ItemLink => ({
  id,
  url,
  urlTitle: 'Monitor LG 27UQ850',
  urlSite: site,
  priceCents: price,
  currency: 'EUR',
  priceSource: price === null ? null : 'web',
  priceCheckedAt: new Date(2026, 6, 30, 12),
  priceTracking: price === null ? null : 'on',
  position: 1000,
  ...extra,
})
const MM = tienda('mm', URL_MM, 'MediaMarkt', 24900)
const PC = tienda('pc', URL_PC, 'PcComponentes', 26900, { position: 2000 })
const LG = tienda('lg', URL_LG, 'LG', 29900, { position: 3000 })
const TRES = [MM, PC, LG]
const monitor = (overrides: Partial<Item> = {}) =>
  item(ID.auriculares, 'Monitor LG 27" 4K UltraFine', {
    url: URL_MM,
    urlTitle: 'Monitor LG 27UQ850',
    urlSite: 'MediaMarkt',
    priceCents: 24900,
    previousPriceCents: null,
    priceSource: 'web',
    priceCheckedAt: new Date(2026, 6, 30, 12),
    links: TRES,
    priceLinkId: 'mm',
    priceStore: 'MediaMarkt',
    priceTracking: null,
    ...overrides,
  })
const uno = () =>
  item(ID.auriculares, 'Monitor LG 27" 4K UltraFine', {
    url: URL_PC,
    urlTitle: 'Monitor LG 27UQ850',
    urlSite: 'PcComponentes',
    priceCents: 26900,
    priceSource: 'web',
    priceCheckedAt: new Date(2026, 6, 30, 12),
  })
const stores = async () => within(await detail()).findByRole('region', { name: 'Dónde comprarlo' })
const block = async () => within(await detail()).findByRole('region', { name: 'Precio' })

describe('varias tiendas en una compra (diseño 19)', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    onlineManager.setOnline(true)
    vi.mocked(itemsApi.insertLinks).mockResolvedValue()
    vi.mocked(itemsApi.updateLink).mockResolvedValue()
    vi.mocked(itemsApi.deleteLink).mockResolvedValue()
    vi.mocked(pricesApi.fetchPriceHistory).mockResolvedValue([])
  })
  afterEach(() => {
    onlineManager.setOnline(true)
  })

  it('«+ Otra tienda» bajo el enlace: la de siempre y la nueva pasan a «Dónde comprarlo»', async () => {
    const user = userEvent.setup()
    vi.mocked(itemsApi.fetchLinkMetadata).mockResolvedValue({
      title: 'LG 27UQ850',
      image: null,
      siteName: 'MediaMarkt',
      price: { cents: 24900, currency: 'EUR' },
    })
    renderList(compras, [uno()], ID.auriculares)
    const sheet = await detail()

    await user.click(within(sheet).getByRole('button', { name: 'Otra tienda' }))
    // La misma tienda no se repite (T9).
    await user.paste(URL_PC + '/')
    expect(within(sheet).getByText('Esta tienda ya está en la lista.')).toBeInTheDocument()
    expect(itemsApi.insertLinks).not.toHaveBeenCalled()

    await user.clear(within(sheet).getByRole('textbox', { name: 'Pega un enlace' }))
    await user.paste(URL_MM)
    await waitFor(() => {
      expect(itemsApi.insertLinks).toHaveBeenCalledWith(ID.auriculares, [
        expect.objectContaining({
          url: URL_PC,
          urlSite: 'PcComponentes',
          priceCents: 26900,
          position: 1000,
        }),
        expect.objectContaining({ url: URL_MM, urlTitle: null, priceCents: null, position: 2000 }),
      ])
    })
    await waitFor(() => {
      expect(itemsApi.updateLink).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ urlSite: 'MediaMarkt', priceCents: 24900, priceSource: 'web' }),
      )
    })

    const list = await stores()
    expect(list).toHaveTextContent('2 tiendas')
    expect(within(list).getByText('Más barata')).toBeInTheDocument()
    expect(list).toHaveTextContent('+20 €')
    const price = await block()
    expect(price).toHaveTextContent('249 €')
    expect(price).toHaveTextContent('En MediaMarkt, la más barata de 2')
    expect(
      within(price).getByText('MediaMarkt es la más barata: 20 € menos que PcComponentes.'),
    ).toBeInTheDocument()
  })

  it('con tres: la más barata marcada, cuánto más cuestan las otras y «en 3 tiendas» en la fila', async () => {
    renderList(compras, [monitor()], ID.auriculares)
    const list = await stores()
    expect(list).toHaveTextContent('3 tiendas')
    expect(
      within(list)
        .getAllByRole('listitem')
        .map((row) => row.textContent),
    ).toEqual([
      expect.stringMatching(/MediaMarkt.*Más barata.*249\s€/),
      expect.stringMatching(/PcComponentes.*269\s€\+20\s€/),
      expect.stringMatching(/LG.*299\s€\+50\s€/),
      'Otra tienda',
    ])
    // La fila del enlace de siempre no sale: su sitio es «Dónde comprarlo».
    expect(
      within(await detail()).queryByRole('button', { name: 'Quitar el enlace' }),
    ).not.toBeInTheDocument()
    expect(within(await block()).queryByRole('button', { name: 'Cambiar' })).not.toBeInTheDocument()
    expect(rows()[0]).toHaveTextContent('en 3 tiendas')
    expect(rows()[0]).toHaveTextContent('249 €')
  })

  it('quitar la más barata: pasa a contar la siguiente, con «Deshacer»', async () => {
    // El aviso sale mientras la hoja del detalle sigue abierta (vaul quita los clics de fuera).
    const user = userEvent.setup({ pointerEventsCheck: 0 })
    renderList(compras, [monitor()], ID.auriculares)
    const list = await stores()

    await user.click(within(list).getByRole('button', { name: 'MediaMarkt: opciones' }))
    await user.click(await screen.findByRole('button', { name: 'Quitar tienda' }))
    expect(itemsApi.deleteLink).toHaveBeenCalledWith('mm')
    const price = await block()
    expect(
      await within(price).findByText('Ahora la más barata es PcComponentes.'),
    ).toBeInTheDocument()
    expect(price).toHaveTextContent('269 €')

    await user.click(await screen.findByRole('button', { name: 'Deshacer' }))
    await waitFor(() => {
      expect(itemsApi.insertLinks).toHaveBeenCalledWith(ID.auriculares, [
        expect.objectContaining({ id: 'mm' }),
      ])
    })
  })

  it('borrar la compra y «Deshacer»: vuelve con sus tres tiendas y la más barata (4.1)', async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 })
    vi.mocked(itemsApi.deleteItem).mockResolvedValue()
    vi.mocked(itemsApi.insertItems).mockResolvedValue()
    renderList(compras, [monitor()], ID.auriculares)

    await user.click(within(await detail()).getByRole('button', { name: 'Borrar' }))
    expect(itemsApi.deleteItem).toHaveBeenCalledWith(ID.auriculares)
    await user.click(await screen.findByRole('button', { name: 'Deshacer' }))

    await waitFor(() => {
      expect(itemsApi.insertItems).toHaveBeenCalledWith([
        expect.objectContaining({ id: ID.auriculares, links: TRES, priceLinkId: 'mm' }),
      ])
    })
    await waitFor(() => {
      expect(rows()[0]).toHaveTextContent('en 3 tiendas')
    })
    expect(rows()[0]).toHaveTextContent('249 €')
  })

  it('una tienda que no da el precio: se escribe a mano en esa tienda', async () => {
    const user = userEvent.setup()
    renderList(
      compras,
      [
        monitor({
          links: [
            ...TRES,
            tienda('am', 'https://www.amazon.es/dp/x', '', null, {
              urlSite: null,
              urlTitle: 'Amazon.es',
              position: 4000,
            }),
          ],
        }),
      ],
      ID.auriculares,
    )
    const list = await stores()
    const amazon = within(list).getAllByRole('listitem')[3]
    expect(amazon).toHaveTextContent('No da el precio')
    expect(
      within(await block()).getByText(
        lineText('En MediaMarkt, la más barata de 3 con precio · de la web · mirado el 30 jul'),
      ),
    ).toBeInTheDocument()

    await user.click(within(amazon ?? document.body).getByRole('button', { name: 'Añadir precio' }))
    const field = await screen.findByRole('textbox', { name: 'Precio' })
    expect(
      screen.getByText('amazon.es no da el precio. Lo que escribas cuenta solo para esta tienda.'),
    ).toBeInTheDocument()
    await user.type(field, '239{Enter}')
    expect(itemsApi.updateLink).toHaveBeenCalledWith('am', {
      priceCents: 23900,
      priceSource: 'manual',
      priceCheckedAt: expect.any(Date) as Date,
    })
  })

  it('«Actualizar precio» mira todas a la vez (menos las escritas a mano) y lo resume', async () => {
    const user = userEvent.setup()
    vi.mocked(itemsApi.fetchLinkMetadata).mockImplementation((url) =>
      url === URL_PC
        ? Promise.resolve({ title: 'LG', image: null, price: { cents: 23900, currency: 'EUR' } })
        : Promise.resolve({ title: 'LG', image: null, price: { cents: 24900, currency: 'EUR' } }),
    )
    renderList(
      compras,
      [
        monitor({
          links: [MM, PC, { ...LG, priceSource: 'manual' }],
        }),
      ],
      ID.auriculares,
    )
    const price = await block()

    await user.click(within(price).getByRole('button', { name: 'Actualizar precio' }))
    expect(
      await within(price).findByText('PcComponentes bajó a 239 €. Ahora es la más barata.'),
    ).toBeInTheDocument()
    expect(itemsApi.fetchLinkMetadata).toHaveBeenCalledTimes(2)
    expect(itemsApi.fetchLinkMetadata).not.toHaveBeenCalledWith(URL_LG)
    expect(itemsApi.updateLink).toHaveBeenCalledWith(
      'pc',
      expect.objectContaining({ priceCents: 23900, priceSource: 'web' }),
    )
    expect(itemsApi.updateLink).toHaveBeenCalledWith(
      'mm',
      expect.objectContaining({ priceSource: 'web' }),
    )
  })

  it('si una no contesta, se queda con su último precio', async () => {
    const user = userEvent.setup()
    vi.mocked(itemsApi.fetchLinkMetadata).mockImplementation((url) =>
      url === URL_LG
        ? Promise.reject(new Error('fetch-metadata no contesta'))
        : Promise.resolve({ title: 'LG', image: null, price: null }),
    )
    renderList(compras, [monitor()], ID.auriculares)
    const price = await block()

    await user.click(within(price).getByRole('button', { name: 'Actualizar precio' }))
    expect(
      await within(price).findByText(
        'LG no contestó; se queda con su último precio. Las otras, al día.',
      ),
    ).toBeInTheDocument()
    expect(within(await stores()).getByText('No contestó · precio del 30 jul')).toBeInTheDocument()
  })

  it('comprada: «¿Dónde lo compraste?» cambia lo pagado', async () => {
    const user = userEvent.setup()
    renderList(compras, [monitor({ status: 'bought', completedAt: new Date() })], ID.auriculares)
    const price = await block()
    expect(price).toHaveTextContent('Pagaste249 €')
    expect(price).toHaveTextContent('en MediaMarkt, la más barata')

    await user.click(within(price).getByRole('button', { name: 'Cambiar' }))
    const options = await screen.findByRole('radiogroup', { name: '¿Dónde lo compraste?' })
    await user.click(within(options).getByRole('radio', { name: /PcComponentes/ }))
    await user.click(screen.getByRole('button', { name: /^Pagaste 269/ }))
    expect(itemsApi.updateItem).toHaveBeenCalledWith(
      ID.auriculares,
      expect.objectContaining({
        priceCents: 26900,
        priceLinkId: 'pc',
        priceStore: 'PcComponentes',
      }),
    )
  })
})
