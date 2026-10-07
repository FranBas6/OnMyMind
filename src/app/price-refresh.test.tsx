import { onlineManager } from '@tanstack/react-query'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { Item } from '@/features/items'
import * as itemsApi from '@/features/items/api'
import type { List } from '@/features/lists'
import * as listsApi from '@/features/lists/api'
import * as pricesApi from '@/features/prices/api'
import * as profileApi from '@/features/profile/api'
import { queryKeys } from '@/lib/queryKeys'
import { fakeSession, renderRoute, testProfile } from '@/test/render-route'
import { lineText } from '@/test/text'

vi.mock('@/features/items/api')
vi.mock('@/features/lists/api')
vi.mock('@/features/prices/api')
vi.mock('@/features/profile/api')

const session = fakeSession()
const DAY = 24 * 60 * 60 * 1000
const ID = {
  cascos: '00000000-0000-4000-8000-000000000001',
  teclado: '00000000-0000-4000-8000-000000000002',
  lampara: '00000000-0000-4000-8000-000000000003',
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

/** Hoy a las 9:00, cuando se mira solo. */
const NINE = new Date(new Date().setHours(9, 0, 0, 0))

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
    createdAt: new Date(Date.now() - 30 * DAY),
    leftInboxId: null,
    leftInboxAt: null,
    url: 'https://www.keychron.es/q1',
    urlTitle: 'Auriculares inalámbricos Q1',
    imageUrl: null,
    imagePath: null,
    urlSite: 'Keychron',
    priceCents: 7900,
    currency: 'EUR',
    priceSource: 'auto',
    previousPriceCents: 9900,
    priceCheckedAt: NINE,
    links: [],
    priceLinkId: null,
    priceStore: null,
    priceTracking: 'on',
    createdBy: null,
    completedBy: null,
    ...overrides,
  }
}

const cascos = item(ID.cascos, 'Auriculares')
/** Bajó esta mañana: el de ayer era a mano (diseño 22, P4). */
const HISTORY = [
  {
    cents: 9900,
    currency: 'EUR',
    source: 'manual' as const,
    recordedAt: new Date(Date.now() - 20 * DAY),
    store: null,
  },
  { cents: 7900, currency: 'EUR', source: 'auto' as const, recordedAt: NINE, store: null },
]

function renderList(
  items: Item[],
  open: string,
  { general = false, alerts = [] as string[] } = {},
) {
  const lists = [inbox, compras]
  vi.mocked(listsApi.fetchLists).mockResolvedValue(lists)
  vi.mocked(listsApi.fetchArchivedLists).mockResolvedValue([])
  vi.mocked(itemsApi.fetchItems).mockReturnValue(new Promise(() => undefined))
  vi.mocked(pricesApi.fetchPriceHistory).mockResolvedValue(HISTORY)
  // Lo que se guarda vuelve en la siguiente lectura, como en el servidor.
  const saved = new Set(alerts)
  vi.mocked(pricesApi.fetchPriceAlerts).mockImplementation(() => Promise.resolve([...saved]))
  vi.mocked(pricesApi.setPriceAlert).mockImplementation((itemId, _userId, on) => {
    if (on) saved.add(itemId)
    else saved.delete(itemId)
    return Promise.resolve()
  })
  const profile = testProfile(session.user.id)
  profile.settings.priceDropAlerts = general
  vi.mocked(profileApi.updateSettings).mockImplementation((_userId, patch) => {
    if (patch.priceDropAlerts !== undefined)
      profile.settings.priceDropAlerts = patch.priceDropAlerts
    return Promise.resolve()
  })
  vi.mocked(profileApi.fetchProfile).mockImplementation(() =>
    Promise.resolve({ ...profile, settings: { ...profile.settings } }),
  )
  return renderRoute(`/lists/compras?item=${open}`, {
    session,
    seed: (queryClient) => {
      queryClient.setQueryData(queryKeys.lists.all, lists)
      queryClient.setQueryData(queryKeys.lists.archived, [])
      queryClient.setQueryData(queryKeys.items.byList('compras'), items)
      queryClient.setQueryData(queryKeys.profile(), profile)
      queryClient.setQueryData(queryKeys.priceAlerts, alerts)
    },
  })
}

const detail = () => screen.findByRole('dialog', { name: /Detalle de/ })

describe('precios que se miran solos (3.8, diseño 22)', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    onlineManager.setOnline(true)
  })
  afterEach(() => {
    onlineManager.setOnline(true)
  })

  it('tras una bajada de esta mañana: el chip en euros, «bajó esta mañana» y lo que había a mano (P2, P4)', async () => {
    renderList([cascos], ID.cascos)
    const block = await within(await detail()).findByRole('region', { name: 'Precio' })
    expect(within(block).getByText('↓ 20 € · 20 %')).toBeInTheDocument()
    expect(
      await within(block).findByText(lineText('Keychron · bajó esta mañana · comprobado solo')),
    ).toBeInTheDocument()
    expect(
      within(block).getByText(
        'Antes estaba a 99 € puesto a mano. Ahora manda el de la web; si quieres otro, «Cambiar».',
      ),
    ).toBeInTheDocument()
    expect(screen.getByRole('switch', { name: 'Avisarme si baja' })).not.toBeChecked()
  })

  it('una tienda que no da el precio: sin «Avisarme si baja», y se dice (P5)', async () => {
    const teclado = item(ID.teclado, 'Teclado K2', {
      url: 'https://www.amazon.es/k2',
      urlSite: 'Amazon',
      priceCents: 9900,
      previousPriceCents: null,
      priceSource: 'manual',
      priceTracking: null,
    })
    renderList([teclado], ID.teclado)
    const block = await within(await detail()).findByRole('region', { name: 'Precio' })
    expect(
      within(block).getByText('Amazon no da el precio a la app. Se queda el que pongas.'),
    ).toBeInTheDocument()
    expect(screen.queryByRole('switch', { name: 'Avisarme si baja' })).not.toBeInTheDocument()
  })

  it('ya no se puede seguir: lo dice el bloque y el aviso queda en pausa (T3)', async () => {
    const lampara = item(ID.lampara, 'Lámpara', {
      priceTracking: 'stopped',
      priceSource: 'web',
      previousPriceCents: null,
      priceCheckedAt: new Date(2026, 9, 3, 12),
    })
    renderList([lampara], ID.lampara, { general: true, alerts: [ID.lampara] })
    const block = await within(await detail()).findByRole('region', { name: 'Precio' })
    expect(
      within(block).getByText(
        lineText('Keychron · Ya no se puede seguir · último precio el 3 oct'),
      ),
    ).toBeInTheDocument()
    expect(
      within(block).getByText(/Keychron no ha dado el precio tres mañanas/),
    ).toBeInTheDocument()
    expect(
      screen.getByText('En pausa mientras no se pueda seguir. Tu elección se guarda.'),
    ).toBeInTheDocument()
  })

  it('encender el aviso con el general apagado enciende también el general y lo dice (A3)', async () => {
    const user = userEvent.setup()
    renderList([cascos], ID.cascos)
    await detail()
    await user.click(await screen.findByRole('switch', { name: 'Avisarme si baja' }))

    await waitFor(() => {
      expect(pricesApi.setPriceAlert).toHaveBeenCalledWith(ID.cascos, session.user.id, true)
    })
    await waitFor(() => {
      expect(profileApi.updateSettings).toHaveBeenCalledWith(session.user.id, {
        priceDropAlerts: true,
      })
    })
    expect(
      await screen.findByText(/También hemos encendido «Bajadas de precio» en Perfil/),
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Ver en Perfil' })).toBeInTheDocument()
  })

  it('callado desde Perfil: tocarlo vuelve a encender el general sin apagar el de la compra (A6)', async () => {
    const user = userEvent.setup()
    renderList([cascos], ID.cascos, { alerts: [ID.cascos] })
    await detail()
    expect(
      await screen.findByText(/Callado: «Bajadas de precio» está apagado en Perfil/),
    ).toBeInTheDocument()
    await user.click(screen.getByRole('switch', { name: 'Avisarme si baja' }))
    await waitFor(() => {
      expect(profileApi.updateSettings).toHaveBeenCalledWith(session.user.id, {
        priceDropAlerts: true,
      })
    })
    expect(pricesApi.setPriceAlert).not.toHaveBeenCalled()
  })

  it('la gráfica distingue lo que se miró solo de lo escrito a mano (P1)', async () => {
    renderList([cascos], ID.cascos)
    const block = await within(await detail()).findByRole('region', { name: 'Precio' })
    expect(await within(block).findByText('Solo, cada mañana')).toBeInTheDocument()
    expect(within(block).getByText('A mano')).toBeInTheDocument()
    expect(within(block).queryByText('Al actualizar')).not.toBeInTheDocument()
  })
})

describe('«Bajaron esta mañana» (N3)', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('el aviso de varias abre la hoja con sus compras', async () => {
    const lists = [inbox, compras]
    vi.mocked(listsApi.fetchLists).mockResolvedValue(lists)
    vi.mocked(listsApi.fetchArchivedLists).mockResolvedValue([])
    vi.mocked(listsApi.fetchRecentCaptures).mockResolvedValue([])
    vi.mocked(pricesApi.fetchPriceDrops).mockResolvedValue([
      {
        itemId: ID.cascos,
        listId: 'compras',
        listName: 'Compras',
        title: 'Auriculares',
        store: 'Keychron',
        imageUrl: null,
        imagePath: null,
        priceCents: 7900,
        previousPriceCents: 9900,
        currency: 'EUR',
      },
    ])
    renderRoute('/?bajadas=hoy', {
      session,
      seed: (queryClient) => {
        queryClient.setQueryData(queryKeys.lists.all, lists)
        queryClient.setQueryData(queryKeys.lists.archived, [])
      },
    })
    const sheet = await screen.findByRole('dialog', { name: 'Bajaron esta mañana' })
    const row = await within(sheet).findByRole('link', { name: /Auriculares/ })
    expect(row).toHaveTextContent('Compras · Keychron')
    expect(row).toHaveTextContent('↓ 20 €')
    expect(row).toHaveAttribute('href', `/lists/compras?item=${ID.cascos}`)
  })
})

describe('Perfil · «Bajadas de precio» (PF1, PF2)', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('apagado lo explica; al encenderlo, cuántas compras lo tienen pedido', async () => {
    const user = userEvent.setup()
    const lists = [inbox, compras]
    vi.mocked(listsApi.fetchLists).mockResolvedValue(lists)
    vi.mocked(listsApi.fetchArchivedLists).mockResolvedValue([])
    vi.mocked(listsApi.fetchRecentCaptures).mockResolvedValue([])
    vi.mocked(pricesApi.fetchSavings).mockResolvedValue(0)
    vi.mocked(pricesApi.fetchPriceAlerts).mockResolvedValue([ID.cascos, ID.teclado, ID.lampara])
    vi.mocked(profileApi.fetchCalendarToken).mockResolvedValue(null)
    const profile = testProfile(session.user.id)
    vi.mocked(profileApi.updateSettings).mockImplementation((_userId, patch) => {
      if (patch.priceDropAlerts !== undefined)
        profile.settings.priceDropAlerts = patch.priceDropAlerts
      return Promise.resolve()
    })
    vi.mocked(profileApi.fetchProfile).mockImplementation(() =>
      Promise.resolve({ ...profile, settings: { ...profile.settings } }),
    )
    renderRoute('/profile', {
      session,
      seed: (queryClient) => {
        queryClient.setQueryData(queryKeys.lists.all, lists)
        queryClient.setQueryData(queryKeys.lists.archived, [])
        queryClient.setQueryData(queryKeys.profile(), profile)
      },
    })
    const avisos = await screen.findByRole('region', { name: 'Avisos' })
    expect(within(avisos).getByText(/Apagado, las calla todas sin quitarlas/)).toBeInTheDocument()

    await user.click(within(avisos).getByRole('switch', { name: 'Bajadas de precio' }))
    expect(
      await within(avisos).findByText(
        lineText(
          'Avisa cuando baja una compra con «Avisarme si baja». Ahora: 3 compras. Se mira cada mañana a las 9:00.',
        ),
      ),
    ).toBeInTheDocument()
    await waitFor(() => {
      expect(profileApi.updateSettings).toHaveBeenCalledWith(session.user.id, {
        priceDropAlerts: true,
      })
    })
  })
})
