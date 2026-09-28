import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import * as authApi from '@/features/auth/api'
import * as listsApi from '@/features/lists/api'
import type { List } from '@/features/lists'
import * as profileApi from '@/features/profile/api'
import { parseSettings, type Profile } from '@/features/profile'
import { queryKeys } from '@/lib/queryKeys'
import { fakeSession, renderRoute, testProfile } from '@/test/render-route'

vi.mock('@/features/auth/api')
vi.mock('@/features/lists/api')
vi.mock('@/features/profile/api')

const session = fakeSession()

function list(id: string, name: string, overrides: Partial<List> = {}): List {
  return {
    id,
    name,
    color: 'coral',
    icon: null,
    kind: 'tasks',
    position: 2000,
    counters: { pending: 2, done: 3, pendingPriceCents: 0 },
    archivedAt: null,
    ...overrides,
  }
}

const inbox = list('i', 'En mente', {
  kind: 'inbox',
  color: 'indigo',
  position: 1000,
  counters: { pending: 1, done: 4, pendingPriceCents: 0 },
})
const casa = list('casa', 'Casa')
const trabajo = list('trabajo', 'Trabajo', { color: 'pink', position: 3000 })
const regalos = list('regalos', 'Regalos', {
  color: 'green',
  archivedAt: new Date(2026, 8, 1),
  counters: { pending: 0, done: 2, pendingPriceCents: 0 },
})

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

/**
 * Perfil con la caché sembrada. `server` hace de Supabase: guardar el nombre o un ajuste se le
 * aplica, y `fetchProfile` devuelve lo que tenga, para que el refresco tras guardar sea realista.
 */
function renderProfile(profile: Partial<Profile> = {}, path = '/profile') {
  let signedIn = true
  vi.mocked(authApi.signOut).mockImplementation(() => {
    signedIn = false
    return Promise.resolve()
  })
  const seeded = testProfile(session.user.id, profile)
  let server = seeded
  vi.mocked(listsApi.fetchLists).mockResolvedValue([inbox, casa, trabajo])
  vi.mocked(listsApi.fetchArchivedLists).mockResolvedValue([regalos])
  vi.mocked(listsApi.fetchRecentCaptures).mockResolvedValue([])
  vi.mocked(profileApi.fetchProfile).mockImplementation(() => Promise.resolve(server))
  vi.mocked(profileApi.updateSettings).mockImplementation((_id, patch) => {
    server = {
      ...server,
      themeStored: server.themeStored || patch.theme !== undefined,
      settings: {
        ...server.settings,
        ...(patch.theme && { theme: patch.theme }),
        ...(patch.defaultListId !== undefined && { defaultListId: patch.defaultListId }),
      },
    }
    return Promise.resolve()
  })
  vi.mocked(profileApi.updateDisplayName).mockImplementation((_id, name) => {
    server = { ...server, displayName: name }
    return Promise.resolve()
  })
  return renderRoute(path, {
    session,
    getSession: () => Promise.resolve(signedIn ? session : null),
    seed: (queryClient) => {
      queryClient.setQueryData(queryKeys.lists.all, [inbox, casa, trabajo])
      queryClient.setQueryData(queryKeys.lists.archived, [regalos])
      queryClient.setQueryData(queryKeys.profile(), seeded)
    },
  })
}

const region = (name: string) => screen.getByRole('region', { name })

describe('Perfil', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })
  afterEach(() => {
    setDesktop(false)
    // next-themes recuerda el tema en este navegador: que no pase de un test a otro.
    localStorage.clear()
    document.documentElement.classList.remove('dark')
  })

  it('tu nombre (tomado del email), las dos cifras y los ajustes de la fase 1', async () => {
    renderProfile()

    expect(await screen.findByRole('heading', { level: 1, name: 'Perfil' })).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /Cambiar tu nombre, ahora «fran»/ }),
    ).toBeInTheDocument()
    expect(screen.getByText(/fran@ejemplo\.com/)).toHaveTextContent('· nombre tomado del email')
    // 4 + 3 + 3 hechas en las activas y 2 en la archivada; dos listas sin contar «En mente».
    expect(screen.getByText('12').closest('div')).toHaveTextContent('fuera de la cabeza')
    expect(screen.getByText('listas').closest('div')).toHaveTextContent('2')
    expect(
      within(region('Captura')).getByRole('button', { name: /Lista por defecto: En mente/ }),
    ).toBeInTheDocument()
    expect(screen.queryByText(/Avisos|Exportar|ahorrados/)).not.toBeInTheDocument()
  })

  it('cambiar el nombre en móvil: vacío no vale, y al guardar deja de decir «tomado del email»', async () => {
    const user = userEvent.setup()
    renderProfile()

    await user.click(await screen.findByRole('button', { name: 'Cambiar tu nombre' }))
    const sheet = await screen.findByRole('dialog', { name: 'Tu nombre' })
    const field = within(sheet).getByRole('textbox', { name: 'Tu nombre' })
    await user.clear(field)
    await user.click(within(sheet).getByRole('button', { name: 'Listo' }))
    expect(within(sheet).getByText('Ponle un nombre.')).toBeInTheDocument()

    await user.type(field, 'Fran Bas{Enter}')

    await waitFor(() => {
      expect(profileApi.updateDisplayName).toHaveBeenCalledWith(session.user.id, 'Fran Bas')
    })
    expect(await screen.findByRole('button', { name: /ahora «Fran Bas»/ })).toBeInTheDocument()
    expect(screen.queryByText(/nombre tomado del email/)).not.toBeInTheDocument()
  })

  it('en escritorio el nombre se edita en el sitio: Intro guarda, Escape cancela', async () => {
    const user = userEvent.setup()
    setDesktop(true)
    renderProfile()

    await user.click(await screen.findByRole('button', { name: 'Cambiar tu nombre' }))
    await user.keyboard('{Escape}')
    expect(profileApi.updateDisplayName).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: 'Cambiar tu nombre' }))
    const field = screen.getByRole('textbox', { name: 'Tu nombre' })
    await user.clear(field)
    await user.type(field, 'Fran{Enter}')
    await waitFor(() => {
      expect(profileApi.updateDisplayName).toHaveBeenCalledTimes(1)
    })
    expect(profileApi.updateDisplayName).toHaveBeenCalledWith(session.user.id, 'Fran')
    // El pie del sidebar también lo enseña.
    expect(screen.getByRole('link', { name: 'Perfil' })).toHaveTextContent('Fran')
  })

  it('el tema se aplica al momento y se guarda en el perfil', async () => {
    const user = userEvent.setup()
    renderProfile()

    await user.click(await screen.findByRole('radio', { name: 'Oscuro' }))

    expect(document.documentElement).toHaveClass('dark')
    await waitFor(() => {
      expect(profileApi.updateSettings).toHaveBeenCalledWith(session.user.id, { theme: 'dark' })
    })
  })

  it('el tema guardado en el perfil manda al entrar', async () => {
    renderProfile({ settings: { ...parseSettings({}), theme: 'dark' } })

    await waitFor(() => {
      expect(document.documentElement).toHaveClass('dark')
    })
  })

  it('una cuenta sin tema guardado sube el de este navegador en vez de pisarlo', async () => {
    renderProfile({ themeStored: false })

    await waitFor(() => {
      expect(profileApi.updateSettings).toHaveBeenCalledWith(session.user.id, {
        theme: 'system',
      })
    })
  })

  it('elegir la lista por defecto, y la captura la trae elegida', async () => {
    const user = userEvent.setup()
    renderProfile()

    await user.click(await screen.findByRole('button', { name: /Lista por defecto/ }))
    const sheet = await screen.findByRole('dialog', { name: 'Lista por defecto' })
    expect(within(sheet).getByText('Siempre disponible')).toBeInTheDocument()
    expect(within(sheet).queryByText('Regalos')).not.toBeInTheDocument()
    await user.click(within(sheet).getByRole('button', { name: /Casa/ }))

    await waitFor(() => {
      expect(profileApi.updateSettings).toHaveBeenCalledWith(session.user.id, {
        defaultListId: 'casa',
      })
    })
    expect(
      await screen.findByRole('button', { name: /Lista por defecto: Casa/ }),
    ).toBeInTheDocument()

    // Perfil no lleva el +: la captura se abre desde Inicio.
    const [home] = screen.getAllByRole('link', { name: 'Listas' })
    if (home) await user.click(home)
    await user.click(await screen.findByRole('button', { name: 'Captura rápida' }))
    const capture = await screen.findByRole('dialog', { name: 'Captura rápida' })
    expect(within(capture).getByRole('radio', { name: 'Casa' })).toHaveAttribute(
      'aria-checked',
      'true',
    )
  })

  it('si la elegida se archivó, lo dice; al tocar la fila vuelve a «En mente»', async () => {
    const user = userEvent.setup()
    renderProfile({ settings: { ...parseSettings({}), defaultListId: 'regalos' } })

    expect(
      await screen.findByText('«Regalos» se archivó, así que ahora se guarda en En mente.'),
    ).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /Lista por defecto: En mente/ }))

    await waitFor(() => {
      expect(profileApi.updateSettings).toHaveBeenCalledWith(session.user.id, {
        defaultListId: 'i',
      })
    })
    expect(screen.queryByText(/se archivó/)).not.toBeInTheDocument()
  })

  it('cambiar la contraseña: tienen que coincidir, y avisa al terminar', async () => {
    const user = userEvent.setup()
    vi.mocked(authApi.updatePassword).mockResolvedValue()
    renderProfile()

    await user.click(await screen.findByRole('button', { name: 'Cambiar la contraseña' }))
    const dialog = await screen.findByRole('dialog', { name: 'Cambiar la contraseña' })
    await user.type(within(dialog).getByLabelText('Contraseña nueva'), 'nueva-clave-1')
    await user.type(within(dialog).getByLabelText('Repite la contraseña'), 'otra-clave-2')
    await user.click(within(dialog).getByRole('button', { name: 'Guardar' }))
    expect(within(dialog).getByText('Las contraseñas no coinciden.')).toBeInTheDocument()
    expect(authApi.updatePassword).not.toHaveBeenCalled()

    await user.clear(within(dialog).getByLabelText('Repite la contraseña'))
    await user.type(within(dialog).getByLabelText('Repite la contraseña'), 'nueva-clave-1')
    await user.click(within(dialog).getByRole('button', { name: 'Guardar' }))

    await waitFor(() => {
      expect(authApi.updatePassword).toHaveBeenCalledWith('nueva-clave-1')
    })
    expect((await screen.findAllByText('Contraseña cambiada')).length).toBeGreaterThan(0)
    expect(screen.queryByRole('dialog', { name: 'Cambiar la contraseña' })).not.toBeInTheDocument()
  })

  it('si el servidor dice que no, el error sale en el formulario', async () => {
    const user = userEvent.setup()
    const { AuthFailure } = await import('@/features/auth/errors')
    vi.mocked(authApi.updatePassword).mockRejectedValue(
      new AuthFailure('Es la misma que ya tienes. Elige otra.'),
    )
    renderProfile()

    await user.click(await screen.findByRole('button', { name: 'Cambiar la contraseña' }))
    const dialog = await screen.findByRole('dialog', { name: 'Cambiar la contraseña' })
    await user.type(within(dialog).getByLabelText('Contraseña nueva'), 'misma-clave')
    await user.type(within(dialog).getByLabelText('Repite la contraseña'), 'misma-clave')
    await user.click(within(dialog).getByRole('button', { name: 'Guardar' }))

    expect(
      await within(dialog).findByText('Es la misma que ya tienes. Elige otra.'),
    ).toBeInTheDocument()
  })

  it('cerrar sesión pide confirmación y lleva a /login', async () => {
    const user = userEvent.setup()
    const { router } = renderProfile()

    await user.click(await screen.findByRole('button', { name: 'Cerrar sesión' }))
    const dialog = await screen.findByRole('alertdialog', { name: '¿Cerrar sesión?' })
    expect(within(dialog).getByText(/Tus listas se quedan en la cuenta/)).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: 'Cerrar sesión' }))

    await waitFor(() => {
      expect(authApi.signOut).toHaveBeenCalled()
    })
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/login')
    })
  })
})
