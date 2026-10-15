import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import * as itemsApi from '@/features/items/api'
import type { Item } from '@/features/items/types'
import * as listsApi from '@/features/lists/api'
import type { List } from '@/features/lists'
import { lock } from '@/features/private'
import * as privateApi from '@/features/private/api'
import type * as Passkey from '@/features/private/passkey'
import { generateVaultKey, keyCheck, wrapWithPassword } from '@/features/private/vault'
import * as profileApi from '@/features/profile/api'
import type * as SharingApi from '@/features/sharing/api'
import * as sharingApi from '@/features/sharing/api'
import type { ListPerson } from '@/features/sharing/schemas'
import { queryKeys } from '@/lib/queryKeys'
import { fakeSession, renderRoute, testProfile } from '@/test/render-route'

vi.mock('@/features/items/api')
vi.mock('@/features/lists/api')
vi.mock('@/features/profile/api')
vi.mock('@/features/private/api')
vi.mock('@/features/sharing/api', async (importOriginal) => ({
  ...(await importOriginal<typeof SharingApi>()),
  fetchSharedPeople: vi.fn(),
  fetchDeparture: vi.fn(),
  fetchListPeople: vi.fn(),
  fetchActiveInvite: vi.fn(),
  subscribeToLiveChanges: () => () => undefined,
}))
// Este aparato de jsdom no tiene Face ID: se desbloquea con la clave.
vi.mock('@/features/private/passkey', async (importOriginal) => ({
  ...(await importOriginal<typeof Passkey>()),
  canUsePasskeys: () => Promise.resolve(false),
}))

const session = fakeSession()
const ME = session.user.id
const BEA = '00000000-0000-0000-0000-00000000000b'
const PASSWORD = 'la del candado'
const PENDIENTES = '00000000-0000-4000-8000-0000000000c1'

function list(id: string, name: string, overrides: Partial<List> = {}): List {
  return {
    id,
    name,
    color: 'coral',
    icon: null,
    kind: 'list',
    view: 'list',
    position: 2000,
    counters: {
      pending: 1,
      done: 0,
      pendingPriceCents: 7900,
      notes: 0,
      kinds: { note: 0, task: 0, shopping: 1, event: 0 },
    },
    archivedAt: null,
    isOwner: true,
    hidden: false,
    ...overrides,
  }
}

function item(id: string, listId: string, title: string): Item {
  return {
    id,
    listId,
    kind: 'task',
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
    createdAt: new Date(2026, 9, 3, 10, 0),
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
  }
}

const person = (userId: string, displayName: string, isOwner: boolean): ListPerson => ({
  userId,
  displayName,
  avatarUrl: null,
  isOwner,
  joinedAt: null,
})

const inbox = list('i', 'En mente', { kind: 'inbox', color: 'indigo', position: 1000 })
const casa = list('casa', 'Casa', { position: 3000 })
const regalos = list('regalos', 'Regalos de Marta', { color: 'indigo', position: 2000 })
const sorpresa = list('sorpresa', 'Sorpresa 40 de Marta', {
  color: 'teal',
  position: 4000,
  hidden: true,
})

async function makeVault() {
  const key = await generateVaultKey()
  const vault: privateApi.PrivateVault = {
    keyId: 'caja-1',
    wrap: await wrapWithPassword(key, PASSWORD, 1000),
    check: await keyCheck(key),
  }
  return vault
}

/**
 * Hace de Supabase: las listas de siempre sin las ocultas y las ocultas aparte, como `my_lists`
 * con `hidden`. Ocultar y mostrar las cambian de sitio.
 */
function render(
  path: string,
  {
    vault,
    hidden = [],
    defaultListId = null,
    shared = new Map(),
  }: {
    vault: privateApi.PrivateVault | null
    hidden?: List[]
    defaultListId?: string | null
    shared?: Map<string, ListPerson[]>
  },
) {
  let visible = [inbox, regalos, casa].filter((entry) => !hidden.some((h) => h.id === entry.id))
  let secret = hidden.map((entry) => ({ ...entry, hidden: true }))
  vi.mocked(listsApi.fetchLists).mockImplementation(() => Promise.resolve(visible))
  vi.mocked(listsApi.fetchArchivedLists).mockResolvedValue([])
  vi.mocked(listsApi.fetchHiddenLists).mockImplementation(() => Promise.resolve(secret))
  vi.mocked(listsApi.fetchHiddenListIds).mockImplementation(() =>
    Promise.resolve(secret.map((entry) => entry.id)),
  )
  vi.mocked(listsApi.fetchRecentCaptures).mockResolvedValue([])
  vi.mocked(listsApi.hideList).mockImplementation((id) => {
    const found = visible.find((entry) => entry.id === id)
    visible = visible.filter((entry) => entry.id !== id)
    if (found) secret = [...secret, { ...found, hidden: true }]
    return Promise.resolve()
  })
  vi.mocked(listsApi.showList).mockImplementation((id) => {
    const found = secret.find((entry) => entry.id === id)
    secret = secret.filter((entry) => entry.id !== id)
    if (found) visible = [...visible, { ...found, hidden: false }]
    return Promise.resolve()
  })
  vi.mocked(itemsApi.fetchItems).mockImplementation((listId) =>
    Promise.resolve(
      listId === 'sorpresa' ? [item(PENDIENTES, 'sorpresa', 'Encargar la tarta')] : [],
    ),
  )
  vi.mocked(itemsApi.fetchMovedFromInbox).mockResolvedValue([])
  vi.mocked(itemsApi.fetchSublists).mockResolvedValue([])
  const profile = testProfile(ME)
  profile.settings.defaultListId = defaultListId
  vi.mocked(profileApi.fetchProfile).mockResolvedValue(profile)
  vi.mocked(privateApi.fetchPrivateVault).mockResolvedValue({ vault, keys: [] })
  vi.mocked(sharingApi.fetchSharedPeople).mockResolvedValue(shared)
  vi.mocked(sharingApi.fetchDeparture).mockResolvedValue(null)
  vi.mocked(sharingApi.fetchListPeople).mockResolvedValue([person(ME, 'Ana', true)])
  vi.mocked(sharingApi.fetchActiveInvite).mockResolvedValue(null)
  return renderRoute(path, {
    session,
    seed: (queryClient) => {
      queryClient.setQueryData(queryKeys.lists.all, visible)
      queryClient.setQueryData(queryKeys.lists.archived, [])
      queryClient.setQueryData(
        queryKeys.lists.hiddenIds,
        secret.map((entry) => entry.id),
      )
      queryClient.setQueryData(queryKeys.items.latest('i', 3), [])
      queryClient.setQueryData(queryKeys.privateVault, { vault, keys: [] })
      queryClient.setQueryData(queryKeys.sharing.shared, shared)
      queryClient.setQueryData(queryKeys.profile(), profile)
    },
  })
}

async function unlockWithKey(user: ReturnType<typeof userEvent.setup>) {
  const dialog = await screen.findByRole('dialog', { name: 'Listas ocultas' })
  expect(within(dialog).getByText('Escribe tu clave privada para verlas.')).toBeInTheDocument()
  await user.type(within(dialog).getByPlaceholderText('Clave privada'), PASSWORD)
  await user.click(within(dialog).getByRole('button', { name: 'Desbloquear' }))
}

/** El menú ··· de una tarjeta de Inicio, en el móvil: una hoja. */
async function cardMenu(user: ReturnType<typeof userEvent.setup>, name: string) {
  await user.click(await screen.findByRole('button', { name: `Opciones de «${name}»` }))
  return screen.findByRole('dialog', { name: `Opciones de «${name}»` })
}

describe('listas ocultas (5.8, diseño 27)', { timeout: 20_000 }, () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })
  afterEach(() => {
    lock()
  })

  it('ocultar sin clave: se crea antes, se confirma y sale de Inicio sin decir cuál', async () => {
    const user = userEvent.setup()
    const vault = await makeVault()
    vi.mocked(privateApi.createPrivateVault).mockResolvedValue(vault)
    render('/', { vault: null, defaultListId: 'regalos' })

    const menu = await cardMenu(user, 'Regalos de Marta')
    expect(within(menu).getByText('solo en Perfil')).toBeInTheDocument()
    await user.click(within(menu).getByRole('button', { name: /Ocultar/ }))

    // D3c: la clave, con lo de las listas ocultas.
    const create = await screen.findByRole('dialog', { name: 'Antes, crea tu clave privada' })
    expect(
      within(create).getByText(/Las listas ocultas se abren con la misma clave/),
    ).toBeInTheDocument()
    expect(within(create).getByText(/Tus listas ocultas no se pierden/)).toBeInTheDocument()
    await user.type(within(create).getByPlaceholderText('Clave privada'), PASSWORD)
    await user.type(within(create).getByPlaceholderText('Repítela'), PASSWORD)
    await user.click(within(create).getByRole('button', { name: 'Crear clave' }))

    // D1c: era la lista por defecto de la captura.
    const confirm = await screen.findByRole('dialog', { name: 'Ocultar «Regalos de Marta»' })
    expect(
      within(confirm).getByText('Desaparece de Inicio, Hoy, Buscar, la captura y el calendario.'),
    ).toBeInTheDocument()
    expect(within(confirm).getByText(/Es tu lista por defecto para capturar/)).toBeInTheDocument()
    await user.click(within(confirm).getByRole('button', { name: 'Ocultar' }))

    await waitFor(() => {
      expect(listsApi.hideList).toHaveBeenCalledWith('regalos')
    })
    expect(await screen.findByText('Lista oculta')).toBeInTheDocument()
    const grid = screen.getByRole('list', { name: 'Mis listas' })
    await waitFor(() => {
      expect(within(grid).queryByText('Regalos de Marta')).not.toBeInTheDocument()
    })
    expect(within(grid).getByText('Casa')).toBeInTheDocument()
  })

  it('Perfil › «Listas ocultas»: se desbloquea, se ven sus tarjetas y al bloquear se tapa', async () => {
    const user = userEvent.setup()
    const vault = await makeVault()
    render('/profile', { vault, hidden: [regalos, sorpresa] })

    const privado = await screen.findByRole('region', { name: 'Privado' })
    await user.click(within(privado).getByRole('button', { name: 'Listas ocultas' }))
    await unlockWithKey(user)

    const grid = await screen.findByRole('list', { name: 'Listas ocultas' })
    expect(within(grid).getByText('Regalos de Marta')).toBeInTheDocument()
    expect(within(grid).getByText('Sorpresa 40 de Marta')).toBeInTheDocument()
    expect(screen.getByText(/Desbloqueadas · se bloquean solas en 5 min/)).toBeInTheDocument()
    expect(listsApi.fetchHiddenLists).toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: 'Bloquear' }))
    expect(await screen.findByText('Se han bloqueado')).toBeInTheDocument()
    expect(screen.queryByText('Regalos de Marta')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Desbloquear' })).toBeInTheDocument()
  })

  it('vacía: cómo se oculta una (D4b)', async () => {
    const user = userEvent.setup()
    const vault = await makeVault()
    render('/profile/hidden', { vault })

    expect(await screen.findByText('Bloqueadas')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Desbloquear' }))
    await unlockWithKey(user)
    expect(await screen.findByText('Aquí no hay nada.')).toBeInTheDocument()
  })

  it('una oculta abierta con su enlace: tapada y sin pedir lo de dentro hasta desbloquear; «Mostrar» la devuelve', async () => {
    const user = userEvent.setup()
    const vault = await makeVault()
    render('/lists/sorpresa', { vault, hidden: [sorpresa] })

    expect(await screen.findByText('Lista oculta')).toBeInTheDocument()
    expect(screen.queryByText('Encargar la tarta')).not.toBeInTheDocument()
    expect(itemsApi.fetchItems).not.toHaveBeenCalledWith('sorpresa')

    await user.click(screen.getByRole('button', { name: 'Desbloquear' }))
    await unlockWithKey(user)
    expect(await screen.findByText('Encargar la tarta')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Listas ocultas' })).toBeInTheDocument()
    expect(screen.getByText('Oculta')).toBeInTheDocument()

    const menu = await cardMenu(user, 'Sorpresa 40 de Marta')
    expect(within(menu).getByText(/^Oculta ·/)).toBeInTheDocument()
    expect(within(menu).getByText('vuelve a Mis listas')).toBeInTheDocument()
    await user.click(within(menu).getByRole('button', { name: /Mostrar/ }))

    await waitFor(() => {
      expect(listsApi.showList).toHaveBeenCalledWith('sorpresa')
    })
    expect(
      await screen.findByText('«Sorpresa 40 de Marta» vuelve a Mis listas'),
    ).toBeInTheDocument()
    const grid = await screen.findByRole('list', { name: 'Mis listas' })
    expect(await within(grid).findByText('Sorpresa 40 de Marta')).toBeInTheDocument()
  })

  it('compartida: ocultarla es solo tuyo, y dentro lo recuerda (D7 y D7b)', async () => {
    const user = userEvent.setup()
    const vault = await makeVault()
    const shared = new Map([
      ['regalos', [person(ME, 'Ana', true), person(BEA, 'Bea', false)]],
      ['sorpresa', [person(ME, 'Ana', true), person(BEA, 'Bea', false)]],
    ])
    render('/', { vault, hidden: [sorpresa], shared })

    const menu = await cardMenu(user, 'Regalos de Marta')
    await user.click(within(menu).getByRole('button', { name: /Ocultar/ }))
    const confirm = await screen.findByRole('dialog', { name: 'Ocultar «Regalos de Marta»' })
    expect(
      within(confirm).getByText('Solo se oculta para ti. Bea la sigue viendo en sus listas.'),
    ).toBeInTheDocument()
    await user.click(within(confirm).getByRole('button', { name: 'Cancelar' }))

    // Dentro de la que ya está oculta.
    const [profileLink] = screen.getAllByRole('link', { name: 'Perfil' })
    if (!profileLink) throw new Error('sin Perfil')
    await user.click(profileLink)
    const privado = await screen.findByRole('region', { name: 'Privado' })
    await user.click(within(privado).getByRole('button', { name: 'Listas ocultas' }))
    await unlockWithKey(user)
    await user.click(await screen.findByRole('link', { name: /Sorpresa 40 de Marta/ }))
    expect(
      await screen.findByText('Solo está oculta para ti. Bea la ve en sus listas, como siempre.'),
    ).toBeInTheDocument()
  })
})
