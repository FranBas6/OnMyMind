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
import { fakeSession, renderRoute } from '@/test/render-route'

vi.mock('@/features/items/api')
vi.mock('@/features/lists/api')
vi.mock('@/features/prices/api')

const session = fakeSession()
const COCINA = '00000000-0000-4000-8000-000000000001'

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
const casa: List = { ...inbox, id: 'casa', name: 'Casa', color: 'coral', kind: 'tasks' }

const URL_PIN = 'https://www.pinterest.es/cocinas-pequenas'
const URL_MARTIN = 'https://cocinasmartin.es/presupuesto'
const URL_LEROY = 'https://www.leroymerlin.es/encimera-cuarzo'

function cocina(overrides: Partial<Item> = {}): Item {
  return {
    id: COCINA,
    listId: 'casa',
    kind: 'task',
    parentId: null,
    chooseOne: false,
    chosenId: null,
    sealed: null,
    title: 'Reformar la cocina',
    notes: null,
    status: 'pending',
    priority: null,
    dueAt: null,
    allDay: false,
    recurrence: null,
    position: 1000,
    completedAt: null,
    createdAt: new Date(2026, 8, 2),
    leftInboxId: null,
    leftInboxAt: null,
    url: URL_PIN,
    urlTitle: 'Ideas de cocinas pequeñas',
    imageUrl: null,
    imagePath: null,
    urlSite: 'Pinterest',
    priceCents: null,
    currency: 'EUR',
    priceSource: null,
    previousPriceCents: null,
    priceCheckedAt: null,
    links: [],
    images: [],
    files: [],
    priceLinkId: null,
    priceStore: null,
    priceTracking: null,
    createdBy: null,
    completedBy: null,
    ...overrides,
  }
}

const enlace = (id: string, url: string, title: string | null, position: number): ItemLink => ({
  id,
  url,
  urlTitle: title,
  urlSite: null,
  priceCents: null,
  currency: 'EUR',
  priceSource: null,
  priceCheckedAt: null,
  priceTracking: null,
  position,
})
const TRES = [
  enlace('pin', URL_PIN, 'Ideas de cocinas pequeñas', 1000),
  enlace('martin', URL_MARTIN, 'Presupuesto · Cocinas Martín', 2000),
  enlace('leroy', URL_LEROY, 'Encimera de cuarzo blanco', 3000),
]

function renderCasa(items: Item[], open?: string) {
  const lists = [inbox, casa]
  vi.mocked(listsApi.fetchLists).mockResolvedValue(lists)
  vi.mocked(listsApi.fetchArchivedLists).mockResolvedValue([])
  vi.mocked(itemsApi.fetchItems).mockReturnValue(new Promise(() => undefined))
  vi.mocked(itemsApi.updateItem).mockResolvedValue()
  return renderRoute(open ? `/lists/casa?item=${open}` : '/lists/casa', {
    session,
    seed: (queryClient) => {
      queryClient.setQueryData(queryKeys.lists.all, lists)
      queryClient.setQueryData(queryKeys.lists.archived, [])
      queryClient.setQueryData(queryKeys.items.byList('casa'), items)
    },
  })
}

const detail = () => screen.findByRole('dialog', { name: /Detalle de/ })
const box = async () => within(await detail()).findByRole('region', { name: 'Enlaces' })
const row = () =>
  within(screen.getByRole('list', { name: 'Ítems', hidden: true })).getAllByRole('listitem', {
    hidden: true,
  })[0]

describe('varios enlaces en lo que no es compra (diseño 23, D11–D13)', () => {
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

  it('«+ Otro enlace» bajo el de la tarea: los dos pasan a «Enlaces», sin precio aunque la web lo dé, y luego un tercero', async () => {
    const user = userEvent.setup()
    vi.mocked(itemsApi.fetchLinkMetadata).mockResolvedValue({
      title: 'Presupuesto · Cocinas Martín',
      image: null,
      siteName: null,
      price: { cents: 450000, currency: 'EUR' },
    })
    renderCasa([cocina()], COCINA)
    const sheet = await detail()

    await user.click(within(sheet).getByRole('button', { name: 'Otro enlace' }))
    // El mismo enlace no se repite.
    await user.paste(URL_PIN + '/')
    expect(within(sheet).getByText('Este enlace ya está.')).toBeInTheDocument()
    expect(itemsApi.insertLinks).not.toHaveBeenCalled()

    await user.clear(within(sheet).getByRole('textbox', { name: 'Pega un enlace' }))
    await user.paste(URL_MARTIN)
    await waitFor(() => {
      expect(itemsApi.insertLinks).toHaveBeenCalledWith(COCINA, [
        expect.objectContaining({ url: URL_PIN, urlTitle: 'Ideas de cocinas pequeñas' }),
        expect.objectContaining({ url: URL_MARTIN, urlTitle: null, position: 2000 }),
      ])
    })
    await waitFor(() => {
      expect(itemsApi.updateLink).toHaveBeenCalledWith(expect.any(String), {
        urlTitle: 'Presupuesto · Cocinas Martín',
        urlSite: null,
      })
    })

    const links = await box()
    await waitFor(() => {
      expect(
        within(links)
          .getAllByRole('listitem')
          .map((entry) => entry.textContent),
      ).toEqual([
        'Ideas de cocinas pequeñaspinterest.es',
        'Presupuesto · Cocinas Martíncocinasmartin.es',
        'Otro enlace',
      ])
    })
    expect(links).not.toHaveTextContent('€')

    vi.mocked(itemsApi.fetchLinkMetadata).mockResolvedValue({
      title: 'Encimera de cuarzo blanco',
      image: null,
      siteName: 'Leroy Merlin',
      price: null,
    })
    await user.click(within(links).getByRole('button', { name: 'Otro enlace' }))
    await user.paste(URL_MARTIN)
    expect(within(links).getByText('Este enlace ya está.')).toBeInTheDocument()
    await user.clear(within(links).getByRole('textbox', { name: 'Pega un enlace' }))
    await user.paste(URL_LEROY)
    await waitFor(() => {
      expect(itemsApi.insertLinks).toHaveBeenLastCalledWith(COCINA, [
        expect.objectContaining({ url: URL_LEROY, position: 3000 }),
      ])
    })
    expect(await within(links).findByText('Encimera de cuarzo blanco')).toBeInTheDocument()
    expect(row()).toHaveTextContent('en 3 enlaces')
  })

  it('tocar un enlace: «Quitar enlace» con «Deshacer», que lo devuelve', async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 })
    renderCasa([cocina({ links: TRES })], COCINA)
    const links = await box()
    expect(row()).toHaveTextContent('en 3 enlaces')
    expect(within(links).getByRole('link', { name: 'Abrir cocinasmartin.es' })).toHaveAttribute(
      'href',
      URL_MARTIN,
    )

    await user.click(
      within(links).getByRole('button', { name: 'Presupuesto · Cocinas Martín: opciones' }),
    )
    expect(await screen.findByRole('button', { name: 'Abrir en la web' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Quitar enlace' }))
    expect(itemsApi.deleteLink).toHaveBeenCalledWith('martin')
    expect(await screen.findByText('Enlace quitado')).toBeInTheDocument()
    expect(row()).toHaveTextContent('en 2 enlaces')

    await user.click(await screen.findByRole('button', { name: 'Deshacer' }))
    await waitFor(() => {
      expect(itemsApi.insertLinks).toHaveBeenCalledWith(COCINA, [
        expect.objectContaining({ id: 'martin' }),
      ])
    })
    expect(row()).toHaveTextContent('en 3 enlaces')
  })

  it('al quitar hasta uno, la caja vuelve a ser la fila del enlace', async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 })
    renderCasa([cocina({ links: TRES.slice(0, 2) })], COCINA)
    const links = await box()
    await user.click(
      within(links).getByRole('button', { name: 'Ideas de cocinas pequeñas: opciones' }),
    )
    await user.click(await screen.findByRole('button', { name: 'Quitar enlace' }))
    const sheet = await detail()
    await waitFor(() => {
      expect(within(sheet).queryByRole('region', { name: 'Enlaces' })).not.toBeInTheDocument()
    })
    expect(within(sheet).getByText('Presupuesto · Cocinas Martín')).toBeInTheDocument()
    expect(within(sheet).getByRole('button', { name: 'Quitar el enlace' })).toBeInTheDocument()
    expect(row()).toHaveTextContent('cocinasmartin.es')
  })

  it('sin conexión: se guarda con su dominio, busca el título al volver y lo dice debajo (D13)', async () => {
    const user = userEvent.setup()
    vi.mocked(itemsApi.fetchLinkMetadata).mockResolvedValue({
      title: 'Cocinas IKEA',
      image: null,
      siteName: 'IKEA',
      price: null,
    })
    renderCasa([cocina({ links: TRES.slice(0, 2) })], COCINA)
    const links = await box()
    onlineManager.setOnline(false)

    await user.click(within(links).getByRole('button', { name: 'Otro enlace' }))
    await user.paste('https://www.ikea.com/es/cocinas')
    const waiting = await within(links).findByText('Buscará el título al volver la red')
    expect(waiting.closest('li')).toHaveTextContent('ikea.com')
    expect(
      within(await detail()).getByText(
        'El enlace se ha guardado. Las fotos necesitan conexión para subirse.',
      ),
    ).toBeInTheDocument()
    expect(itemsApi.fetchLinkMetadata).not.toHaveBeenCalled()

    onlineManager.setOnline(true)
    await waitFor(() => {
      expect(itemsApi.updateLink).toHaveBeenCalledWith(expect.any(String), {
        urlTitle: 'Cocinas IKEA',
        urlSite: 'IKEA',
      })
    })
    expect(await within(links).findByText('Cocinas IKEA')).toBeInTheDocument()
    expect(within(await detail()).queryByText(/El enlace se ha guardado/)).not.toBeInTheDocument()
  })

  it('pasar una compra de dos tiendas a tarea y volver no pierde nada', async () => {
    const user = userEvent.setup()
    const tiendas: ItemLink[] = [
      {
        ...enlace('pc', 'https://www.pccomponentes.com/lg', 'Monitor LG', 1000),
        urlSite: 'PcComponentes',
        priceCents: 26900,
        priceSource: 'web',
        priceCheckedAt: new Date(2026, 9, 1),
      },
      {
        ...enlace('mm', 'https://www.mediamarkt.es/lg', 'Monitor LG', 2000),
        urlSite: 'MediaMarkt',
        priceCents: 24900,
        priceSource: 'web',
        priceCheckedAt: new Date(2026, 9, 1),
      },
    ]
    renderCasa(
      [
        cocina({
          kind: 'shopping',
          title: 'Monitor',
          url: 'https://www.pccomponentes.com/lg',
          urlTitle: 'Monitor LG',
          urlSite: 'PcComponentes',
          priceCents: 24900,
          priceSource: 'web',
          priceCheckedAt: new Date(2026, 9, 1),
          links: tiendas,
          priceLinkId: 'mm',
          priceStore: 'MediaMarkt',
        }),
      ],
      COCINA,
    )
    const sheet = await detail()
    const change = async (to: 'Tarea' | 'Compra') => {
      await user.click(within(sheet).getByRole('button', { name: /^Tipo/ }))
      const kinds = await screen.findByRole('radiogroup', { name: 'Tipo' })
      await user.click(within(kinds).getByRole('radio', { name: new RegExp(to) }))
      await user.click(
        within(screen.getByRole('dialog', { name: 'Tipo' })).getByRole('button', { name: 'Listo' }),
      )
    }

    await change('Tarea')
    expect(itemsApi.updateItem).toHaveBeenLastCalledWith(COCINA, {
      kind: 'task',
      status: 'pending',
      priceCents: null,
      priceSource: null,
    })
    const links = await box()
    expect(within(links).getAllByRole('listitem')).toHaveLength(3)
    expect(links).toHaveTextContent('pccomponentes.com')
    expect(links).not.toHaveTextContent('€')
    expect(row()).toHaveTextContent('en 2 enlaces')

    await change('Compra')
    expect(itemsApi.updateItem).toHaveBeenLastCalledWith(COCINA, {
      kind: 'shopping',
      status: 'pending',
    })
    const stores = await within(sheet).findByRole('region', { name: 'Dónde comprarlo' })
    expect(within(stores).getByText('Más barata')).toBeInTheDocument()
    expect(within(sheet).getByRole('region', { name: 'Precio' })).toHaveTextContent('249 €')
    expect(row()).toHaveTextContent('en 2 tiendas')
    expect(row()).toHaveTextContent('249 €')
  })
})
