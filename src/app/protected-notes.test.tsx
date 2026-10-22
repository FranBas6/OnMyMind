import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import * as itemsApi from '@/features/items/api'
import type { Item, ItemPatch } from '@/features/items/types'
import * as listsApi from '@/features/lists/api'
import type { List } from '@/features/lists'
import { lock } from '@/features/private'
import * as privateApi from '@/features/private/api'
import type * as Passkey from '@/features/private/passkey'
import {
  generateVaultKey,
  keyCheck,
  openText,
  sealText,
  wrapWithPassword,
} from '@/features/private/vault'
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
// Este móvil de jsdom no tiene Face ID: se desbloquea con la clave.
vi.mock('@/features/private/passkey', async (importOriginal) => ({
  ...(await importOriginal<typeof Passkey>()),
  canUsePasskeys: () => Promise.resolve(false),
}))

const session = fakeSession()
const ME = session.user.id
const MARTA = '00000000-0000-0000-0000-00000000000b'
const PASSWORD = 'la del candado'
// Los ids van en `?item=`, que solo admite uuid.
const WIFI = '00000000-0000-4000-8000-0000000000a1'
const SUPER = '00000000-0000-4000-8000-0000000000a2'
const BODY = 'Red: MiFibra-7A2F\nClave: tq8M-29xk-Lp4r'

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
      pending: 0,
      done: 0,
      pendingPriceCents: 0,
      notes: 1,
      kinds: { note: 1, task: 0, shopping: 0, event: 0 },
    },
    archivedAt: null,
    isOwner: true,
    hidden: false,
    ...overrides,
  }
}

function note(id: string, title: string, overrides: Partial<Item> = {}): Item {
  return {
    id,
    listId: 'casa',
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
    files: [],
    priceLinkId: null,
    priceStore: null,
    priceTracking: null,
    createdBy: null,
    completedBy: null,
    ...overrides,
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
const casa = list('casa', 'Casa')
const trabajo = list('trabajo', 'Trabajo', { color: 'pink', position: 3000 })

/** Una caja de verdad, con pocas vueltas para que el test no espere, y su clave. */
async function makeVault() {
  const key = await generateVaultKey()
  const vault: privateApi.PrivateVault = {
    keyId: 'caja-1',
    wrap: await wrapWithPassword(key, PASSWORD, 1000),
    check: await keyCheck(key),
  }
  return { key, vault }
}

function render(
  path: string,
  {
    vault,
    items,
    shared = new Map(),
  }: {
    vault: privateApi.PrivateVault
    items: Item[]
    shared?: Map<string, ListPerson[]>
  },
) {
  const lists = [inbox, casa, trabajo]
  vi.mocked(listsApi.fetchLists).mockResolvedValue(lists)
  vi.mocked(listsApi.fetchArchivedLists).mockResolvedValue([])
  vi.mocked(listsApi.fetchRecentCaptures).mockResolvedValue([])
  // Hace de Supabase: lo que se guarda es lo que vuelve al pedirlo otra vez.
  let server = items
  vi.mocked(itemsApi.fetchItems).mockImplementation((listId) =>
    Promise.resolve(server.filter((item) => item.listId === listId)),
  )
  vi.mocked(itemsApi.fetchMovedFromInbox).mockResolvedValue([])
  vi.mocked(itemsApi.fetchSublists).mockResolvedValue([])
  vi.mocked(itemsApi.updateItem).mockImplementation((id, patch) => {
    server = server.map((item) =>
      item.id === id
        ? {
            ...item,
            ...(patch.title !== undefined && { title: patch.title }),
            ...(patch.notes !== undefined && { notes: patch.notes }),
            ...(patch.sealed !== undefined && { sealed: patch.sealed }),
          }
        : item,
    )
    return Promise.resolve()
  })
  vi.mocked(itemsApi.moveItem).mockResolvedValue()
  vi.mocked(profileApi.fetchProfile).mockResolvedValue(testProfile(ME))
  vi.mocked(privateApi.fetchPrivateVault).mockResolvedValue({ vault, keys: [] })
  vi.mocked(sharingApi.fetchSharedPeople).mockResolvedValue(shared)
  vi.mocked(sharingApi.fetchDeparture).mockResolvedValue(null)
  vi.mocked(sharingApi.fetchListPeople).mockResolvedValue([person(ME, 'Fran', true)])
  vi.mocked(sharingApi.fetchActiveInvite).mockResolvedValue(null)
  return renderRoute(path, {
    session,
    seed: (queryClient) => {
      queryClient.setQueryData(queryKeys.lists.all, lists)
      queryClient.setQueryData(queryKeys.lists.archived, [])
      queryClient.setQueryData(queryKeys.items.latest('i', 3), [])
      queryClient.setQueryData(queryKeys.privateVault, { vault, keys: [] })
      queryClient.setQueryData(queryKeys.sharing.shared, shared)
      for (const id of ['i', 'casa', 'trabajo']) {
        queryClient.setQueryData(
          queryKeys.items.byList(id),
          items.filter((item) => item.listId === id),
        )
      }
    },
  })
}

/** El último cambio guardado de un ítem, y que nunca lleva el texto en claro de la nota. */
function lastPatch(): ItemPatch {
  const call = vi.mocked(itemsApi.updateItem).mock.calls.at(-1)
  if (!call) throw new Error('no se ha guardado nada')
  return call[1]
}

async function unlockWithKey(user: ReturnType<typeof userEvent.setup>) {
  const dialog = await screen.findByRole('dialog', { name: 'Desbloquear' })
  await user.type(within(dialog).getByPlaceholderText('Clave privada'), PASSWORD)
  await user.click(within(dialog).getByRole('button', { name: 'Desbloquear' }))
}

describe('notas protegidas (5.7, diseño 26)', { timeout: 20_000 }, () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })
  afterEach(() => {
    lock()
  })

  it('proteger «Wifi de casa»: se confirma, se desbloquea y a la base solo va lo cifrado', async () => {
    const user = userEvent.setup()
    const { key, vault } = await makeVault()
    render(`/lists/casa?item=${WIFI}`, {
      vault,
      items: [note(WIFI, 'Wifi de casa', { notes: BODY })],
    })

    await user.click(await screen.findByRole('button', { name: 'Opciones de «Wifi de casa»' }))
    await user.click(await screen.findByRole('menuitem', { name: 'Proteger' }))

    const confirm = await screen.findByRole('dialog', { name: 'Proteger «Wifi de casa»' })
    expect(within(confirm).getByText(/La primera línea se sigue viendo/)).toBeInTheDocument()
    await user.click(within(confirm).getByRole('button', { name: 'Proteger' }))
    await unlockWithKey(user)

    await waitFor(() => {
      expect(itemsApi.updateItem).toHaveBeenCalled()
    })
    const patch = lastPatch()
    expect(patch.notes).toBeNull()
    expect(JSON.stringify(vi.mocked(itemsApi.updateItem).mock.calls)).not.toContain('tq8M')
    if (!patch.sealed) throw new Error('sin cifrar')
    expect(patch.sealed.keyId).toBe('caja-1')
    expect(await openText(key, patch.sealed)).toBe(BODY)

    expect(await screen.findByText('“Wifi de casa” protegida')).toBeInTheDocument()
    // Sigue abierta, desbloqueada, con su texto.
    expect(await screen.findByText(/Desbloqueada · se bloquea sola en 5 min/)).toBeInTheDocument()
    expect(screen.getByText('Clave: tq8M-29xk-Lp4r')).toBeInTheDocument()
  })

  it('bloqueada: la fila con candado y la ficha sin texto; desbloqueada, se copia y se edita', async () => {
    const user = userEvent.setup()
    const { key, vault } = await makeVault()
    const sealed = { ...(await sealText(key, BODY)), keyId: 'caja-1' }
    render(`/lists/casa?item=${WIFI}`, {
      vault,
      items: [note(WIFI, 'Wifi de casa', { sealed })],
    })

    expect(await screen.findByText('Protegida. Desbloquea para verla.')).toBeInTheDocument()
    expect(screen.queryByText(/tq8M/)).not.toBeInTheDocument()
    // La fila, detrás de la hoja (oculta para los lectores mientras está abierta).
    expect(
      screen.getAllByRole('img', { name: 'Nota protegida', hidden: true }).length,
    ).toBeGreaterThan(0)
    expect(screen.getByRole('button', { name: 'Cerrar' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Desbloquear' }))
    await unlockWithKey(user)
    expect(await screen.findByText('Clave: tq8M-29xk-Lp4r')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Listo' })).toBeInTheDocument()

    // «Copiar» copia el texto sin la primera línea, y lo dice.
    await user.click(screen.getByRole('button', { name: 'Copiar' }))
    expect(await navigator.clipboard.readText()).toBe(BODY)
    expect(await screen.findByText('Se borra del portapapeles en 30 s.')).toBeInTheDocument()

    // Tocar el texto lo edita; al salir, se cifra otra vez.
    await user.click(screen.getByText('Clave: tq8M-29xk-Lp4r'))
    const field = await screen.findByRole('textbox', { name: 'El resto de la nota' })
    await user.type(field, ' (la nueva)')
    await user.click(screen.getByText(/Desbloqueada · se bloquea sola/))
    await waitFor(() => {
      expect(itemsApi.updateItem).toHaveBeenCalled()
    })
    const patch = lastPatch()
    expect(patch.notes).toBeUndefined()
    if (!patch.sealed) throw new Error('sin cifrar')
    expect(await openText(key, patch.sealed)).toBe(`${BODY} (la nueva)`)
    expect(JSON.stringify(vi.mocked(itemsApi.updateItem).mock.calls)).not.toContain('tq8M')

    // «Bloquear» la cierra otra vez.
    await user.click(screen.getByRole('button', { name: 'Bloquear' }))
    expect(await screen.findByText('Protegida. Desbloquea para verla.')).toBeInTheDocument()
    expect(screen.queryByText(/tq8M/)).not.toBeInTheDocument()
  })

  it('cada línea se copia sola: de «Contraseña: 123456», solo «123456»', async () => {
    const user = userEvent.setup()
    const { key, vault } = await makeVault()
    const body = 'Usuario: @francisco\nContraseña: 123456'
    const sealed = { ...(await sealText(key, body)), keyId: 'caja-1' }
    render(`/lists/casa?item=${WIFI}`, {
      vault,
      items: [note(WIFI, 'Instagram', { sealed })],
    })

    await user.click(await screen.findByRole('button', { name: 'Desbloquear' }))
    await unlockWithKey(user)
    await user.click(await screen.findByRole('button', { name: 'Copiar Contraseña' }))
    expect(await navigator.clipboard.readText()).toBe('123456')
    expect(await screen.findByText('Se borra del portapapeles en 30 s.')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Copiar Usuario' }))
    expect(await navigator.clipboard.readText()).toBe('@francisco')
  })

  it('en una lista compartida, «Proteger» en gris con su porqué (C9)', async () => {
    const user = userEvent.setup()
    const { vault } = await makeVault()
    render(`/lists/casa?item=${SUPER}`, {
      vault,
      items: [note(SUPER, 'Código del súper', { notes: 'Tarjeta 004512' })],
      shared: new Map([['casa', [person(ME, 'Fran', true), person(MARTA, 'Marta', false)]]]),
    })

    await user.click(await screen.findByRole('button', { name: 'Opciones de «Código del súper»' }))
    const protect = await screen.findByRole('menuitem', { name: 'Proteger' })
    expect(protect).toHaveAttribute('aria-disabled', 'true')
    expect(
      screen.getByText('En una lista compartida no se puede proteger: Marta no tiene tu clave.'),
    ).toBeInTheDocument()
  })

  it('una lista con protegidas no se comparte: se mueven antes (C9b)', async () => {
    const user = userEvent.setup()
    const { key, vault } = await makeVault()
    const sealed = { ...(await sealText(key, BODY)), keyId: 'caja-1' }
    const wifi = note(WIFI, 'Wifi de casa', { sealed })
    render('/', { vault, items: [wifi] })

    await user.click(await screen.findByRole('button', { name: 'Opciones de «Casa»' }))
    await user.click(await screen.findByRole('button', { name: 'Compartir' }))
    const dialog = await screen.findByRole('dialog', { name: 'Compartir «Casa»' })
    expect(await within(dialog).findByText('1 nota protegida')).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'Invitar con un enlace' })).toBeDisabled()

    await user.click(within(dialog).getByRole('button', { name: 'Mover las protegidas a…' }))
    await user.click(within(dialog).getByRole('button', { name: 'Trabajo' }))
    await waitFor(() => {
      expect(itemsApi.moveItem).toHaveBeenCalledWith(
        WIFI,
        expect.objectContaining({ listId: 'trabajo' }),
      )
    })
  })
})
