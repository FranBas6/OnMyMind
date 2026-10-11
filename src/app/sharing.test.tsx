import { onlineManager } from '@tanstack/react-query'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import * as itemsApi from '@/features/items/api'
import * as listsApi from '@/features/lists/api'
import type { List } from '@/features/lists'
import * as sharingApi from '@/features/sharing/api'
import type { InvitePreview, ListPerson } from '@/features/sharing/schemas'
import { queryKeys } from '@/lib/queryKeys'
import { fakeSession, renderRoute } from '@/test/render-route'

vi.mock('@/features/items/api')
vi.mock('@/features/lists/api')
// Las funciones puras (la dirección del enlace, el token del `?redirect=`) se quedan de verdad.
vi.mock('@/features/sharing/api', async (importOriginal) => {
  const original = await importOriginal<typeof sharingApi>()
  return {
    ...original,
    subscribeToLiveChanges: () => () => undefined,
    fetchActiveInvite: vi.fn(),
    createInvite: vi.fn(),
    revokeInvite: vi.fn(),
    fetchInvitePreview: vi.fn(),
    acceptInvite: vi.fn(),
    fetchListPeople: vi.fn(),
    leaveList: vi.fn(),
    removeMember: vi.fn(),
    fetchSharedPeople: vi.fn(() => Promise.resolve(new Map())),
    fetchDeparture: vi.fn(() => Promise.resolve(null)),
  }
})

const session = fakeSession()
const ME = session.user.id
const MARTA = '00000000-0000-0000-0000-00000000000b'

function list(id: string, name: string, overrides: Partial<List> = {}): List {
  return {
    id,
    name,
    color: 'blue',
    icon: null,
    kind: 'shopping',
    view: 'list',
    position: 2000,
    counters: {
      pending: 5,
      done: 0,
      pendingPriceCents: 0,
      notes: 0,
      kinds: { note: 0, task: 0, shopping: 0, event: 0 },
    },
    archivedAt: null,
    isOwner: true,
    ...overrides,
  }
}

const inbox = list('i', 'En mente', { kind: 'inbox', color: 'indigo', position: 1000 })
const compras = list('compras', 'Compras')
const casaDeAna = list('casa-ana', 'Casa de Ana', { kind: 'tasks', isOwner: false })

const fran: ListPerson = {
  userId: ME,
  displayName: 'fran',
  avatarUrl: null,
  isOwner: true,
  joinedAt: null,
}
const marta: ListPerson = {
  userId: MARTA,
  displayName: 'Marta',
  avatarUrl: null,
  isOwner: false,
  joinedAt: new Date(2026, 9, 3),
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

function renderHome(lists: List[] = [inbox, compras, casaDeAna]) {
  vi.mocked(listsApi.fetchLists).mockResolvedValue(lists)
  vi.mocked(listsApi.fetchArchivedLists).mockResolvedValue([])
  vi.mocked(listsApi.fetchRecentCaptures).mockResolvedValue([])
  vi.mocked(itemsApi.fetchItems).mockResolvedValue([])
  return renderRoute('/', {
    session,
    seed: (queryClient) => {
      queryClient.setQueryData(queryKeys.lists.all, lists)
      queryClient.setQueryData(queryKeys.lists.archived, [])
      queryClient.setQueryData(queryKeys.items.latest('i', 3), [])
    },
  })
}

const preview = (overrides: Partial<InvitePreview> = {}): InvitePreview => ({
  status: 'valid',
  listId: 'compras-de-fran',
  listName: 'Compras',
  listColor: 'blue',
  listKind: 'shopping',
  pendingCount: 7,
  inviterName: 'Fran',
  memberSince: null,
  ...overrides,
})

describe('compartir una lista (3.2, diseño 20)', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })
  afterEach(() => {
    setDesktop(false)
    onlineManager.setOnline(true)
  })

  it('quien la creó: «Compartir…» crea el enlace, enseña cuándo caduca, lo copia y lo anula (S2–S5)', async () => {
    const user = userEvent.setup()
    setDesktop(true)
    const writeText = vi.fn(() => Promise.resolve())
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } })
    vi.mocked(sharingApi.fetchListPeople).mockResolvedValue([fran])
    vi.mocked(sharingApi.fetchActiveInvite).mockResolvedValue(null)
    vi.mocked(sharingApi.createInvite).mockResolvedValue({
      token: 'k7Q2xpA9zL3m',
      expiresAt: new Date(2026, 9, 13),
    })
    vi.mocked(sharingApi.revokeInvite).mockResolvedValue()
    renderHome()

    await user.click(await screen.findByRole('button', { name: 'Opciones de «Compras»' }))
    await user.click(await screen.findByRole('menuitem', { name: 'Compartir…' }))
    const dialog = await screen.findByRole('dialog', { name: 'Compartir «Compras»' })
    expect(await within(dialog).findByText('Tú · Creó la lista')).toBeInTheDocument()

    // En escritorio no hay hoja del sistema: el enlace se copia con el texto.
    await user.click(within(dialog).getByRole('button', { name: 'Invitar con un enlace' }))
    expect(sharingApi.createInvite).toHaveBeenCalledWith('compras')
    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith(
        `fran te invita a «Compras» en OnMyMind\n${window.location.origin}/i/k7Q2xpA9zL3m`,
      )
    })
    expect(await within(dialog).findByText('Caduca el martes 13 oct')).toBeInTheDocument()
    expect(within(dialog).getByText(`${window.location.host}/i/k7Q2xpA9zL3m`)).toBeInTheDocument()

    // Recién copiado, el botón lo dice (S7).
    expect(within(dialog).getByRole('button', { name: 'Copiado' })).toBeInTheDocument()

    await user.click(within(dialog).getByRole('button', { name: 'Anular enlace' }))
    expect(within(dialog).getByText(/Quien ya entró sigue dentro/)).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: 'Anular' }))
    expect(sharingApi.revokeInvite).toHaveBeenCalledWith('compras')
    expect(
      await within(dialog).findByRole('button', { name: 'Invitar con un enlace' }),
    ).toBeInTheDocument()
  })

  it('quien la creó ve quién entró y la quita con confirmación (S7, S8)', async () => {
    const user = userEvent.setup()
    vi.mocked(sharingApi.fetchListPeople).mockResolvedValue([fran, marta])
    vi.mocked(sharingApi.fetchActiveInvite).mockResolvedValue(null)
    vi.mocked(sharingApi.removeMember).mockResolvedValue()
    renderHome()

    await user.click(await screen.findByRole('button', { name: 'Opciones de «Compras»' }))
    await user.click(await screen.findByRole('button', { name: 'Compartir' }))
    const dialog = await screen.findByRole('dialog', { name: 'Compartir «Compras»' })
    expect(await within(dialog).findByText('Entró el 3 oct')).toBeInTheDocument()

    await user.click(within(dialog).getByRole('button', { name: 'Quitar' }))
    const confirm = await screen.findByRole('alertdialog', {
      name: '¿Quitar a Marta de «Compras»?',
    })
    expect(within(confirm).getByText(/Lo que añadió se queda en ella/)).toBeInTheDocument()
    await user.click(within(confirm).getByRole('button', { name: 'Quitar a Marta' }))
    expect(sharingApi.removeMember).toHaveBeenCalledWith('compras', MARTA)
  })

  it('sin conexión no se puede invitar, y lo dice (S6)', async () => {
    const user = userEvent.setup()
    vi.mocked(sharingApi.fetchListPeople).mockResolvedValue([fran])
    vi.mocked(sharingApi.fetchActiveInvite).mockResolvedValue(null)
    renderHome()
    await user.click(await screen.findByRole('button', { name: 'Opciones de «Compras»' }))
    await user.click(await screen.findByRole('button', { name: 'Compartir' }))
    const dialog = await screen.findByRole('dialog', { name: 'Compartir «Compras»' })
    await within(dialog).findByText('Tú · Creó la lista')

    onlineManager.setOnline(false)
    expect(await within(dialog).findByText(/Para invitar hace falta conexión/)).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'Invitar con un enlace' })).toBeDisabled()
  })

  it('quien entró: su menú solo tiene «Quién está» y «Salir»; salir la quita y vuelve a Inicio (M3–M5)', async () => {
    const user = userEvent.setup()
    const ana: ListPerson = { ...fran, userId: 'ana', displayName: 'Ana' }
    const me: ListPerson = { ...marta, userId: ME, displayName: 'fran' }
    vi.mocked(sharingApi.fetchListPeople).mockResolvedValue([ana, me])
    vi.mocked(sharingApi.leaveList).mockImplementation(() => {
      vi.mocked(listsApi.fetchLists).mockResolvedValue([inbox, compras])
      return Promise.resolve()
    })
    renderHome()

    await user.click(await screen.findByRole('button', { name: 'Opciones de «Casa de Ana»' }))
    const sheet = await screen.findByRole('dialog', { name: 'Opciones de «Casa de Ana»' })
    expect(await within(sheet).findByText('De Ana · compartida contigo')).toBeInTheDocument()
    expect(within(sheet).queryByRole('button', { name: 'Editar' })).not.toBeInTheDocument()
    expect(within(sheet).queryByRole('button', { name: 'Archivar' })).not.toBeInTheDocument()
    expect(within(sheet).queryByRole('button', { name: 'Borrar' })).not.toBeInTheDocument()
    expect(within(sheet).getByText(/es cosa de Ana, que creó la lista/)).toBeInTheDocument()

    await user.click(within(sheet).getByRole('button', { name: 'Salir de la lista' }))
    const people = await screen.findByRole('dialog', { name: 'Quién está' })
    expect(await within(people).findByText('Tú · entraste el 3 oct')).toBeInTheDocument()
    expect(within(people).getByText('¿Salir de «Casa de Ana»?')).toBeInTheDocument()
    await user.click(within(people).getByRole('button', { name: 'Salir' }))

    expect(sharingApi.leaveList).toHaveBeenCalledWith('casa-ana', ME)
    expect(await screen.findByText('Has salido de «Casa de Ana»')).toBeInTheDocument()
    await waitFor(() => {
      expect(screen.queryByRole('link', { name: /^Casa de Ana/ })).not.toBeInTheDocument()
    })
  })
})

describe('unirse con el enlace (3.2, diseño 20)', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })
  afterEach(() => {
    onlineManager.setOnline(true)
  })

  function renderInvite(path = '/i/k7Q2xpA9zL3m', withSession = true) {
    vi.mocked(listsApi.fetchLists).mockResolvedValue([inbox, compras])
    vi.mocked(listsApi.fetchArchivedLists).mockResolvedValue([])
    vi.mocked(listsApi.fetchRecentCaptures).mockResolvedValue([])
    return renderRoute(path, {
      session: withSession ? session : null,
      seed: (queryClient) => {
        queryClient.setQueryData(queryKeys.items.latest('i', 3), [])
      },
    })
  }

  it('con sesión: «Fran te invita a «Compras»», y «Unirme» lleva a Inicio con el aviso (J2, M1)', async () => {
    const user = userEvent.setup()
    vi.mocked(sharingApi.fetchInvitePreview).mockResolvedValue(preview())
    vi.mocked(sharingApi.acceptInvite).mockResolvedValue({
      status: 'joined',
      listId: 'compras-de-fran',
    })
    const { router } = renderInvite()

    expect(
      await screen.findByRole('heading', { name: 'Fran te invita a «Compras»' }),
    ).toBeInTheDocument()
    expect(
      screen.getByText(
        'Una lista con 7 cosas. Podrás añadir, completar, editar y ordenar lo de dentro.',
      ),
    ).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Unirme' }))

    expect(sharingApi.acceptInvite).toHaveBeenCalledWith('k7Q2xpA9zL3m')
    expect(await screen.findByText('Te has unido a «Compras»')).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/')
  })

  it.each([
    [
      'expired',
      'Este enlace ha caducado',
      'Las invitaciones duran 7 días. Pídele a Fran uno nuevo.',
      'Ir a mis listas',
    ],
    [
      'revoked',
      'Este enlace ya no vale',
      'Fran lo ha anulado. Si quieres entrar en «Compras», pídele otro.',
      'Ir a mis listas',
    ],
    [
      'own',
      '«Compras» es tu lista',
      'Es el enlace que compartiste. Para invitar a alguien, envíaselo a esa persona.',
      'Abrir Compras',
    ],
    [
      'unknown',
      'Este enlace no funciona',
      'Puede que esté incompleto. Pídele a quien te lo mandó que te lo envíe otra vez.',
      'Ir a mis listas',
    ],
  ] as const)('estado %s (J4, J5, J7)', async (status, title, text, action) => {
    vi.mocked(sharingApi.fetchInvitePreview).mockResolvedValue(preview({ status }))
    renderInvite()
    expect(await screen.findByRole('heading', { name: title })).toBeInTheDocument()
    expect(screen.getByText(text)).toBeInTheDocument()
    expect(
      screen.getByRole(action === 'Abrir Compras' ? 'link' : 'button', { name: action }),
    ).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Unirme' })).not.toBeInTheDocument()
  })

  it('ya estás dentro: desde cuándo y «Abrir Compras» (J6)', async () => {
    vi.mocked(sharingApi.fetchInvitePreview).mockResolvedValue(
      preview({ status: 'member', memberSince: new Date(2026, 9, 3) }),
    )
    renderInvite()
    expect(
      await screen.findByRole('heading', { name: 'Ya estás en «Compras»' }),
    ).toBeInTheDocument()
    expect(screen.getByText('Entraste el 3 oct. La tienes entre tus listas.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Abrir Compras' })).toHaveAttribute(
      'href',
      '/lists/compras-de-fran',
    )
  })

  it('sin sesión: el acceso dice quién te invita y a qué lista, y vuelve al enlace (J1)', async () => {
    vi.mocked(sharingApi.fetchInvitePreview).mockResolvedValue(preview())
    const { router } = renderInvite('/i/k7Q2xpA9zL3m', false)
    expect(await screen.findByText('Fran te invita a «Compras»')).toBeInTheDocument()
    expect(screen.getByText('Entra o crea tu cuenta para unirte.')).toBeInTheDocument()
    expect(screen.queryByText('Sácalo de la cabeza.')).not.toBeInTheDocument()
    expect(router.state.location.search).toEqual({ redirect: '/i/k7Q2xpA9zL3m' })
  })
})
