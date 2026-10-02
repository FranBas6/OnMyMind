import { onlineManager } from '@tanstack/react-query'
import { screen, waitFor, within } from '@testing-library/react'
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
    ...overrides,
  }
}

const inbox = list('i', 'En mente', { kind: 'inbox', color: 'indigo', position: 1000 })
const casa = list('casa', 'Casa', { counters: { pending: 4, done: 2, pendingPriceCents: 0 } })
const trabajo = list('trabajo', 'Trabajo', {
  color: 'pink',
  position: 3000,
  counters: { pending: 6, done: 3, pendingPriceCents: 0 },
})
const compras = list('compras', 'Compras', {
  kind: 'shopping',
  color: 'blue',
  position: 4000,
  counters: { pending: 3, done: 0, pendingPriceCents: 0 },
})
const regalos = list('regalos', 'Regalos', { kind: 'shopping', color: 'green', position: 5000 })
const all = [inbox, casa, trabajo, compras, regalos]

const CAMISETA = 'https://shop.realmadrid.com/camiseta-1-equipacion-26-27'
const ARTICULO = 'https://elpais.com/gastronomia/el-comidista/pan-masa-madre'
const camiseta = {
  title: 'Camiseta 1.ª equipación 26/27 · Real Madrid',
  image: 'https://cdn.realmadrid.com/camiseta.jpg',
  siteName: 'Real Madrid CF',
  price: { cents: 10000, currency: 'EUR' },
}

function renderAt(path: string) {
  vi.mocked(listsApi.fetchLists).mockResolvedValue(all)
  vi.mocked(listsApi.fetchArchivedLists).mockResolvedValue([])
  vi.mocked(listsApi.fetchRecentCaptures).mockResolvedValue([])
  vi.mocked(itemsApi.fetchItems).mockResolvedValue([])
  vi.mocked(itemsApi.fetchMovedFromInbox).mockResolvedValue([])
  vi.mocked(itemsApi.createItem).mockResolvedValue()
  vi.mocked(itemsApi.updateItem).mockResolvedValue()
  return renderRoute(path, {
    session,
    seed: (queryClient) => {
      queryClient.setQueryData(queryKeys.lists.all, all)
      queryClient.setQueryData(queryKeys.lists.archived, [])
      queryClient.setQueryData(queryKeys.items.latest('i', 3), [])
    },
  })
}

const captureDialog = () => screen.findByRole('dialog', { name: 'Captura rápida' })
const chips = (dialog: HTMLElement) =>
  within(within(dialog).getByRole('radiogroup', { name: 'Guardar en' })).getAllByRole('radio')

async function openAndPaste(url: string) {
  const user = userEvent.setup()
  await user.click(await screen.findByRole('button', { name: 'Captura rápida' }))
  const dialog = await captureDialog()
  await user.paste(url)
  return { user, dialog }
}

describe('captura con un enlace (2.3)', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })
  afterEach(() => {
    onlineManager.setOnline(true)
  })

  it('el enlace de un producto enseña la tarjeta, propone Compras y guarda una compra con todo', async () => {
    vi.mocked(itemsApi.fetchLinkMetadata).mockResolvedValue(camiseta)
    renderAt('/')
    const { user, dialog } = await openAndPaste(CAMISETA)

    const card = await within(dialog).findByRole('group', { name: camiseta.title })
    expect(within(card).getByText('Real Madrid CF ·')).toBeInTheDocument()
    expect(within(card).getByText(/^100\s€$/)).toBeInTheDocument()
    expect(
      within(dialog).getByText((_, element) =>
        element?.tagName === 'P'
          ? element.textContent === 'Parece un producto. Lo guardo en Compras como compra.'
          : false,
      ),
    ).toBeInTheDocument()
    // La propuesta va elegida y la primera (K1).
    expect(chips(dialog)[0]).toHaveAccessibleName('Compras')
    expect(chips(dialog)[0]).toHaveAttribute('aria-checked', 'true')

    await user.click(within(dialog).getByRole('button', { name: 'Guardar' }))

    await waitFor(() => {
      expect(itemsApi.createItem).toHaveBeenCalledWith(
        expect.objectContaining({
          listId: 'compras',
          kind: 'shopping',
          title: camiseta.title,
          link: {
            url: CAMISETA,
            urlTitle: camiseta.title,
            urlSite: 'Real Madrid CF',
            imageUrl: camiseta.image,
            price: { cents: 10000, currency: 'EUR' },
          },
        }),
      )
    })
    expect(await screen.findByText('Guardado en Compras')).toBeInTheDocument()
    // Ya se sabía todo: no se vuelve a preguntar ni a completar.
    expect(itemsApi.fetchLinkMetadata).toHaveBeenCalledTimes(1)
    expect(itemsApi.updateItem).not.toHaveBeenCalled()
  })

  it('un enlace que no es un producto va donde siempre, con su enlace y sin aviso', async () => {
    vi.mocked(itemsApi.fetchLinkMetadata).mockResolvedValue({
      title: 'Cómo hacer pan de masa madre en casa',
      image: null,
      siteName: 'El Comidista',
      price: null,
    })
    renderAt('/')
    const { user, dialog } = await openAndPaste(ARTICULO)

    const card = await within(dialog).findByRole('group', {
      name: 'Cómo hacer pan de masa madre en casa',
    })
    expect(within(card).getByText('El Comidista · elpais.com')).toBeInTheDocument()
    expect(within(dialog).queryByText(/Parece un producto/)).not.toBeInTheDocument()
    expect(within(dialog).getByRole('radio', { name: 'En mente' })).toHaveAttribute(
      'aria-checked',
      'true',
    )

    await user.keyboard('{Enter}')

    await waitFor(() => {
      expect(itemsApi.createItem).toHaveBeenCalledWith(
        expect.objectContaining({
          listId: 'i',
          title: 'Cómo hacer pan de masa madre en casa',
          link: expect.objectContaining({
            url: ARTICULO,
            urlSite: 'El Comidista',
            price: null,
          }) as unknown,
        }),
      )
    })
  })

  it('elegir otra lista a mano gana a la propuesta, y fuera de Compras no hay precio', async () => {
    let resolve: (value: typeof camiseta) => void = () => undefined
    vi.mocked(itemsApi.fetchLinkMetadata).mockReturnValue(
      new Promise((done) => {
        resolve = done
      }),
    )
    renderAt('/')
    const { user, dialog } = await openAndPaste(`Para el cumple de Ana ${CAMISETA}`)

    // Buscando: se puede guardar ya (K2).
    expect(
      await within(dialog).findByRole('group', {
        name: 'Buscando la página de shop.realmadrid.com',
      }),
    ).toBeInTheDocument()
    expect(within(dialog).getByText('Puedes guardar ya')).toBeInTheDocument()
    await user.click(within(dialog).getByRole('radio', { name: 'Casa' }))
    resolve(camiseta)

    expect(await within(dialog).findByRole('group', { name: camiseta.title })).toBeInTheDocument()
    expect(within(dialog).getByRole('radio', { name: 'Casa' })).toHaveAttribute(
      'aria-checked',
      'true',
    )
    expect(within(dialog).queryByText(/Parece un producto/)).not.toBeInTheDocument()

    await user.click(within(dialog).getByRole('button', { name: 'Guardar' }))
    await waitFor(() => {
      expect(itemsApi.createItem).toHaveBeenCalledWith(
        expect.objectContaining({
          listId: 'casa',
          kind: 'task',
          title: 'Para el cumple de Ana',
          link: expect.objectContaining({ url: CAMISETA, price: null }) as unknown,
        }),
      )
    })
  })

  it('guardado mientras se buscaba, se completa solo cuando llega la página', async () => {
    let resolve: (value: typeof camiseta) => void = () => undefined
    vi.mocked(itemsApi.fetchLinkMetadata).mockReturnValue(
      new Promise((done) => {
        resolve = done
      }),
    )
    renderAt('/')
    const { user, dialog } = await openAndPaste(CAMISETA)
    await within(dialog).findByText('Puedes guardar ya')
    await user.click(within(dialog).getByRole('radio', { name: 'Compras' }))
    await user.click(within(dialog).getByRole('button', { name: 'Guardar' }))

    await waitFor(() => {
      expect(itemsApi.createItem).toHaveBeenCalledWith(
        expect.objectContaining({
          listId: 'compras',
          title: 'shop.realmadrid.com',
          link: expect.objectContaining({ url: CAMISETA, urlTitle: null, price: null }) as unknown,
        }),
      )
    })
    resolve(camiseta)

    await waitFor(() => {
      expect(itemsApi.updateItem).toHaveBeenCalledWith(expect.any(String), {
        urlTitle: camiseta.title,
        urlSite: 'Real Madrid CF',
        imageUrl: camiseta.image,
        title: camiseta.title,
        priceCents: 10000,
        currency: 'EUR',
        priceSource: 'web',
      })
    })
  })

  it('sin conexión, la tarjeta dice que se guarda con el dominio, y guarda igual', async () => {
    onlineManager.setOnline(false)
    renderAt('/')
    const { user, dialog } = await openAndPaste(CAMISETA)

    const card = within(dialog).getByRole('group', { name: 'Enlace a shop.realmadrid.com' })
    expect(
      within(card).getByText('Se guarda con el dominio. El resto, al volver la red.'),
    ).toBeInTheDocument()
    expect(within(dialog).getByText('Sin conexión · se guarda igual')).toBeInTheDocument()

    await user.click(within(dialog).getByRole('button', { name: 'Guardar' }))
    expect((await screen.findAllByText('Guardado en En mente')).length).toBeGreaterThan(0)
    expect(itemsApi.createItem).not.toHaveBeenCalled()
    expect(itemsApi.fetchLinkMetadata).not.toHaveBeenCalled()

    // Al volver la red sale el alta, con el dominio, y después lo que trae la página.
    vi.mocked(itemsApi.fetchLinkMetadata).mockResolvedValue(camiseta)
    onlineManager.setOnline(true)
    await waitFor(() => {
      expect(itemsApi.createItem).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'shop.realmadrid.com', listId: 'i' }),
      )
    })
    await waitFor(() => {
      expect(itemsApi.updateItem).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ title: camiseta.title, urlSite: 'Real Madrid CF' }),
      )
    })
  })

  it('/add?url= (el Atajo de iOS) abre la captura con el enlace y su tarjeta', async () => {
    vi.mocked(itemsApi.fetchLinkMetadata).mockResolvedValue(camiseta)
    const { router } = renderAt(`/add?url=${encodeURIComponent(CAMISETA)}`)

    const dialog = await captureDialog()
    expect(within(dialog).getByRole('textbox')).toHaveValue(CAMISETA)
    expect(await within(dialog).findByRole('group', { name: camiseta.title })).toBeInTheDocument()
    expect(within(dialog).getByText(/Parece un producto/)).toBeInTheDocument()
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/')
    })
  })
})
