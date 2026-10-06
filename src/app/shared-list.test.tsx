import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { startOfDay } from 'date-fns'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { Item } from '@/features/items'
import * as itemsApi from '@/features/items/api'
import type { List } from '@/features/lists'
import * as listsApi from '@/features/lists/api'
import * as pricesApi from '@/features/prices/api'
import * as profileApi from '@/features/profile/api'
import * as sharingApi from '@/features/sharing/api'
import type { ListPerson } from '@/features/sharing/schemas'
import * as todayApi from '@/features/today/api'
import { dayKey } from '@/features/today/today'
import { queryKeys } from '@/lib/queryKeys'
import { fakeSession, renderRoute, testProfile } from '@/test/render-route'

vi.mock('@/features/items/api')
vi.mock('@/features/lists/api')
vi.mock('@/features/today/api')
vi.mock('@/features/profile/api')
vi.mock('@/features/prices/api')
vi.mock('@/features/sharing/api', async (importOriginal) => ({
  ...(await importOriginal<typeof sharingApi>()),
  fetchSharedPeople: vi.fn(),
  fetchDeparture: vi.fn(),
  fetchListPeople: vi.fn(),
  fetchActiveInvite: vi.fn(),
}))

const session = fakeSession()
const ME = session.user.id
const MARTA = '00000000-0000-0000-0000-00000000000b'
const ANA = '00000000-0000-0000-0000-00000000000a'

function list(id: string, name: string, overrides: Partial<List> = {}): List {
  return {
    id,
    name,
    color: 'blue',
    icon: null,
    kind: 'shopping',
    position: 2000,
    counters: { pending: 2, done: 1, pendingPriceCents: 0 },
    archivedAt: null,
    isOwner: true,
    ...overrides,
  }
}

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
    createdAt: new Date(2026, 9, 1),
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
    createdBy: ME,
    completedBy: null,
    ...overrides,
  }
}

const person = (userId: string, displayName: string, isOwner: boolean): ListPerson => ({
  userId,
  displayName,
  avatarUrl: null,
  isOwner,
  joinedAt: isOwner ? null : new Date(2026, 9, 3),
})

const inbox = list('i', 'En mente', { kind: 'inbox', color: 'indigo', position: 1000 })
// Tuya, compartida con Marta; y la de Ana, compartida contigo; y una que no comparte nadie.
const compras = list('compras', 'Compras')
const casaDeAna = list('casa-ana', 'Casa de Ana', { kind: 'tasks', isOwner: false })
const trabajo = list('trabajo', 'Trabajo', { kind: 'tasks', color: 'pink' })

const shared = new Map([
  ['compras', [person(ME, 'fran', true), person(MARTA, 'Marta', false)]],
  ['casa-ana', [person(ANA, 'Ana', true), person(ME, 'fran', false)]],
])

function seedLists(lists: List[] = [inbox, compras, casaDeAna, trabajo]) {
  vi.mocked(listsApi.fetchLists).mockResolvedValue(lists)
  vi.mocked(listsApi.fetchArchivedLists).mockResolvedValue([])
  vi.mocked(listsApi.fetchRecentCaptures).mockResolvedValue([])
  vi.mocked(sharingApi.fetchSharedPeople).mockResolvedValue(shared)
  vi.mocked(sharingApi.fetchDeparture).mockResolvedValue(null)
  return lists
}

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

describe('una lista compartida en el día a día (3.3, diseño 20)', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })
  afterEach(() => {
    setDesktop(false)
  })

  it('Inicio y sidebar dicen qué está compartido, y con quién (M1, D3)', async () => {
    setDesktop(true)
    const lists = seedLists()
    renderRoute('/', {
      session,
      seed: (queryClient) => {
        queryClient.setQueryData(queryKeys.lists.all, lists)
        queryClient.setQueryData(queryKeys.items.latest('i', 3), [])
      },
    })
    const main = await screen.findByRole('main')
    expect(
      await within(main).findByRole('link', { name: /^Compras.*compartida con Marta/ }),
    ).toBeInTheDocument()
    expect(
      within(main).getByRole('link', { name: /^Casa de Ana.*compartida con Ana/ }),
    ).toBeInTheDocument()
    expect(within(main).getByRole('link', { name: /^Trabajo/ })).not.toHaveTextContent('compartida')

    const sidebar = screen.getByRole('region', { name: 'Mis listas' })
    const sidebarLink = (name: string) =>
      within(sidebar)
        .getAllByRole('link')
        .find((link) => link.textContent.startsWith(name))
    expect(sidebarLink('Compras')).toHaveTextContent('Compras (compartida)')
    expect(sidebarLink('Trabajo')).not.toHaveTextContent('compartida')
  })

  it('el detalle: «con Marta», sus iniciales abren la hoja y lo suyo lleva su inicial (M2)', async () => {
    const user = userEvent.setup()
    const lists = seedLists()
    const leche = item('leche', 'Leche', { createdBy: MARTA })
    const pan = item('pan', 'Pan', { position: 2000 })
    const huevos = item('huevos', 'Huevos', {
      status: 'bought',
      completedAt: new Date(2026, 9, 5),
      completedBy: MARTA,
      position: 3000,
    })
    vi.mocked(itemsApi.fetchItems).mockResolvedValue([leche, pan, huevos])
    vi.mocked(sharingApi.fetchListPeople).mockResolvedValue(shared.get('compras') ?? [])
    vi.mocked(sharingApi.fetchActiveInvite).mockResolvedValue(null)
    renderRoute('/lists/compras', {
      session,
      seed: (queryClient) => {
        queryClient.setQueryData(queryKeys.lists.all, lists)
        queryClient.setQueryData(queryKeys.items.byList('compras'), [leche, pan, huevos])
      },
    })

    expect(await screen.findByText('2 pendientes · 1 comprada · con Marta')).toBeInTheDocument()
    const rows = screen.getByRole('list', { name: 'Ítems' })
    const row = (title: string) =>
      within(rows).getByRole('button', { name: title }).closest('li') as HTMLElement
    // Dos veces: la línea de móvil y la de escritorio (una de las dos, oculta).
    expect(await within(row('Leche')).findAllByText('Lo añadió Marta')).not.toHaveLength(0)
    expect(within(row('Pan')).queryByText(/Lo añadió/)).not.toBeInTheDocument()
    // «Fuera de la cabeza» está abierta: lo que compró Marta lleva su inicial.
    expect(await screen.findByText('Lo completó Marta')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Compartir «Compras»' }))
    expect(await screen.findByRole('dialog', { name: 'Compartir «Compras»' })).toBeInTheDocument()
  })

  it('Hoy: el grupo de una lista compartida dice con quién (M6)', async () => {
    const lists = seedLists()
    const regalo = item('regalo', 'Comprar el regalo de Lucía', {
      listId: 'casa-ana',
      kind: 'task',
      createdBy: ANA,
      dueAt: startOfDay(new Date()),
      allDay: true,
    })
    vi.mocked(todayApi.fetchToday).mockResolvedValue([regalo])
    renderRoute('/today', {
      session,
      seed: (queryClient) => {
        queryClient.setQueryData(queryKeys.lists.all, lists)
        queryClient.setQueryData(queryKeys.items.today(dayKey(new Date())), [regalo])
      },
    })
    const heading = await screen.findByRole('heading', { name: /Casa de Ana/ })
    expect(await within(heading).findByText('con Ana')).toBeInTheDocument()
    expect(await screen.findByText('Lo añadió Ana')).toBeInTheDocument()
  })

  it('te quitan y tenías la lista abierta: lo dice (M9)', async () => {
    const lists = seedLists([inbox, compras])
    vi.mocked(sharingApi.fetchDeparture).mockResolvedValue({
      reason: 'removed',
      listName: 'Casa de Ana',
      ownerName: 'Ana',
    })
    vi.mocked(itemsApi.fetchItems).mockResolvedValue([])
    renderRoute('/lists/casa-ana', {
      session,
      seed: (queryClient) => {
        queryClient.setQueryData(queryKeys.lists.all, lists)
      },
    })
    expect(
      await screen.findByRole('heading', { name: 'Ya no estás en «Casa de Ana»' }),
    ).toBeInTheDocument()
    expect(
      screen.getByText('Ana te ha quitado de la lista. Lo que añadiste se queda en ella.'),
    ).toBeInTheDocument()
    expect(sharingApi.fetchDeparture).toHaveBeenCalledWith('casa-ana')
  })

  it('una lista tuya que ya no está (la borraste): a Inicio, como siempre', async () => {
    const lists = seedLists([inbox, compras])
    const { router } = renderRoute('/lists/borrada', {
      session,
      seed: (queryClient) => {
        queryClient.setQueryData(queryKeys.lists.all, lists)
        queryClient.setQueryData(queryKeys.items.latest('i', 3), [])
      },
    })
    expect(await screen.findByRole('heading', { level: 1, name: 'Mis listas' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/')
  })

  it('borrar la cuenta: dice qué pasa con cada lista compartida (P1)', async () => {
    const user = userEvent.setup()
    const lists = seedLists()
    vi.mocked(pricesApi.fetchSavings).mockResolvedValue(0)
    const profile = testProfile(ME)
    vi.mocked(profileApi.fetchProfile).mockResolvedValue(profile)
    vi.mocked(profileApi.fetchAccountCounts).mockResolvedValue({ lists: 2, items: 9 })
    renderRoute('/profile', {
      session,
      seed: (queryClient) => {
        queryClient.setQueryData(queryKeys.lists.all, lists)
        queryClient.setQueryData(queryKeys.lists.archived, [])
        queryClient.setQueryData(queryKeys.profile(), profile)
      },
    })
    const account = await screen.findByRole('region', { name: 'Cuenta' })
    await user.click(within(account).getByRole('button', { name: 'Borrar la cuenta' }))
    const dialog = await screen.findByRole('dialog', { name: '¿Borrar tu cuenta?' })
    const notice = await within(dialog).findByRole('region', { name: 'Listas compartidas' })
    expect(within(notice).getByText('«Compras» se borrará también para Marta.')).toBeInTheDocument()
    expect(
      within(notice).getByText('Saldrás de «Casa de Ana». Lo que añadiste se queda.'),
    ).toBeInTheDocument()
    expect(within(notice).queryByText(/Trabajo/)).not.toBeInTheDocument()
    expect(profileApi.fetchAccountCounts).toHaveBeenCalledWith(ME)
  })
})
