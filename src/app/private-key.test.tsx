import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import * as authApi from '@/features/auth/api'
import * as listsApi from '@/features/lists/api'
import type { List } from '@/features/lists'
import { lock } from '@/features/private'
import * as privateApi from '@/features/private/api'
import type * as Passkey from '@/features/private/passkey'
import {
  generateVaultKey,
  keyCheck,
  matchesCheck,
  unwrapWithPassword,
  wrapWithPassword,
} from '@/features/private/vault'
import * as pricesApi from '@/features/prices/api'
import * as profileApi from '@/features/profile/api'
import { queryKeys } from '@/lib/queryKeys'
import { fakeSession, renderRoute, testProfile } from '@/test/render-route'

vi.mock('@/features/auth/api')
vi.mock('@/features/lists/api')
vi.mock('@/features/profile/api')
vi.mock('@/features/prices/api')
vi.mock('@/features/private/api')
// Este «ordenador» de jsdom no tiene Face ID ni huella: se desbloquea con la clave.
vi.mock('@/features/private/passkey', async (importOriginal) => ({
  ...(await importOriginal<typeof Passkey>()),
  canUsePasskeys: () => Promise.resolve(false),
}))

const session = fakeSession()
// Derivar la clave tarda: 600 000 vueltas al crearla o cambiarla.
const SLOW = { timeout: 15_000 }

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
}

/** Una caja de verdad, con pocas vueltas para que el test no espere. */
async function vaultWith(password: string): Promise<privateApi.PrivateVault> {
  const key = await generateVaultKey()
  return {
    keyId: 'caja-1',
    wrap: await wrapWithPassword(key, password, 1000),
    check: await keyCheck(key),
  }
}

function renderProfile(vault: privateApi.PrivateVault | null) {
  vi.mocked(authApi.onAuthStateChange).mockImplementation((callback) => {
    callback(session)
    return () => undefined
  })
  vi.mocked(listsApi.fetchLists).mockResolvedValue([inbox])
  vi.mocked(listsApi.fetchArchivedLists).mockResolvedValue([])
  vi.mocked(listsApi.fetchRecentCaptures).mockResolvedValue([])
  vi.mocked(pricesApi.fetchSavings).mockResolvedValue(0)
  vi.mocked(profileApi.fetchProfile).mockResolvedValue(testProfile(session.user.id))
  // Hace de Supabase: lo que se crea o se cambia es lo que vuelve al pedirla otra vez.
  let server = vault
  vi.mocked(privateApi.fetchPrivateVault).mockImplementation(() =>
    Promise.resolve({ vault: server, keys: [] }),
  )
  const keep = (wrap: privateApi.PrivateVault['wrap'], check: string, keyId: string) => {
    server = { keyId, wrap, check }
    return Promise.resolve(server)
  }
  vi.mocked(privateApi.createPrivateVault).mockImplementation((wrap, check) =>
    keep(wrap, check, 'caja-1'),
  )
  vi.mocked(privateApi.resetPrivateVault).mockImplementation((wrap, check) =>
    keep(wrap, check, 'caja-2'),
  )
  vi.mocked(privateApi.rewrapPrivateVault).mockImplementation(async (wrap) => {
    if (server) await keep(wrap, server.check, server.keyId)
  })
  return renderRoute('/profile', {
    session,
    seed: (queryClient) => {
      queryClient.setQueryData(queryKeys.lists.all, [inbox])
      queryClient.setQueryData(queryKeys.lists.archived, [])
      queryClient.setQueryData(queryKeys.profile(), testProfile(session.user.id))
    },
  })
}

const privado = () => screen.getByRole('region', { name: 'Privado' })
/** «Privado» cuando ya se puede usar: con una hoja abierta, el resto de la página queda oculto. */
const privadoReady = () => screen.findByRole('region', { name: 'Privado' }, SLOW)
const sheet = (name: string) => screen.findByRole('dialog', { name })

// Con toda la batería en paralelo, derivar la clave tarda más: margen de sobra.
describe('la clave privada (5.6, diseño 26)', { timeout: 30_000 }, () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })
  afterEach(() => {
    lock()
  })

  it('crearla: escribirla dos veces, y queda creada y desbloqueada', async () => {
    const user = userEvent.setup()
    renderProfile(null)

    expect(
      await screen.findByText('Una sola clave para tus notas protegidas y tus listas ocultas.'),
    ).toBeInTheDocument()
    await user.click(within(privado()).getByRole('button', { name: /Clave privada\s*Crear/ }))
    const dialog = await sheet('Crea tu clave privada')
    expect(
      within(dialog).getByText(/mejor un gestor de contraseñas/, { exact: false }),
    ).toBeInTheDocument()

    await user.type(within(dialog).getByPlaceholderText('Clave privada'), 'la del candado')
    await user.type(within(dialog).getByPlaceholderText('Repítela'), 'la del candado rojo')
    await user.click(within(dialog).getByRole('button', { name: 'Crear clave' }))
    expect(within(dialog).getByText('No coinciden. Escríbela otra vez.')).toBeInTheDocument()
    expect(privateApi.createPrivateVault).not.toHaveBeenCalled()

    await user.clear(within(dialog).getByPlaceholderText('Repítela'))
    await user.type(within(dialog).getByPlaceholderText('Repítela'), 'la del candado')
    await user.click(within(dialog).getByRole('button', { name: 'Crear clave' }))

    expect(await screen.findByText('Clave creada', {}, SLOW)).toBeInTheDocument()
    // Lo guardado está cifrado y se abre con esa clave (y 600 000 vueltas).
    const [wrap, check] = vi.mocked(privateApi.createPrivateVault).mock.calls[0] ?? []
    if (!wrap || !check) throw new Error('No se creó la caja')
    expect(wrap.iterations).toBe(600_000)
    const opened = await unwrapWithPassword(wrap, 'la del candado')
    expect(opened && (await matchesCheck(opened, check))).toBe(true)
    expect(within(await privadoReady()).getByText('Desbloqueada')).toBeInTheDocument()
    // Aquí no hay Face ID ni huella: se dice y se usa la clave.
    expect(within(privado()).getByText('Solo con la clave en este ordenador')).toBeInTheDocument()
  })

  it('un PIN de 4 cifras vale; con 3, no', async () => {
    const user = userEvent.setup()
    renderProfile(null)

    await user.click(
      await within(await privadoReady()).findByRole('button', { name: /Clave privada\s*Crear/ }),
    )
    const dialog = await sheet('Crea tu clave privada')
    expect(
      within(dialog).getByText('Mínimo 4 caracteres. Una frase que recuerdes sirve.'),
    ).toBeInTheDocument()
    await user.type(within(dialog).getByPlaceholderText('Clave privada'), '482')
    await user.type(within(dialog).getByPlaceholderText('Repítela'), '482')
    expect(within(dialog).getByRole('button', { name: 'Crear clave' })).toBeDisabled()
    await user.type(within(dialog).getByPlaceholderText('Clave privada'), '1')
    await user.type(within(dialog).getByPlaceholderText('Repítela'), '1')
    await user.click(within(dialog).getByRole('button', { name: 'Crear clave' }))
    // Hasta que se crea de verdad (y queda desbloqueada), no un aviso de otro test.
    expect(
      await within(await privadoReady()).findByText('Desbloqueada', {}, SLOW),
    ).toBeInTheDocument()
    const [wrap] = vi.mocked(privateApi.createPrivateVault).mock.calls[0] ?? []
    if (!wrap) throw new Error('No se creó la caja')
    expect(await unwrapWithPassword(wrap, '4821')).not.toBeNull()
  })

  it('desbloquear con la clave (la equivocada no) y bloquear', async () => {
    const user = userEvent.setup()
    renderProfile(await vaultWith('la del candado'))

    await user.click(
      await within(await screen.findByRole('region', { name: 'Privado' })).findByRole('button', {
        name: /Clave privada\s*Creada/,
      }),
    )
    const dialog = await screen.findByRole('dialog', { name: 'Desbloquear' }, SLOW)
    await user.type(within(dialog).getByPlaceholderText('Clave privada'), 'otra cosa')
    await user.click(within(dialog).getByRole('button', { name: 'Desbloquear' }))
    expect(
      await within(dialog).findByText('Esa no es la clave. Prueba otra vez.', {}, SLOW),
    ).toBeInTheDocument()

    await user.clear(within(dialog).getByPlaceholderText('Clave privada'))
    await user.type(within(dialog).getByPlaceholderText('Clave privada'), 'la del candado')
    await user.click(within(dialog).getByRole('button', { name: 'Desbloquear' }))
    expect(
      await within(await privadoReady()).findByText('Desbloqueada', {}, SLOW),
    ).toBeInTheDocument()

    await user.click(
      within(privado()).getByRole('button', { name: /Clave privada\s*Desbloqueada/ }),
    )
    expect(await screen.findByText('Bloqueada', {}, SLOW)).toBeInTheDocument()
    expect(within(privado()).getByText('Creada')).toBeInTheDocument()
  })

  it('cambiar la clave: la misma caja, cifrada con la nueva', async () => {
    const user = userEvent.setup()
    const vault = await vaultWith('la del candado')
    renderProfile(vault)

    await user.click(
      await within(await screen.findByRole('region', { name: 'Privado' })).findByRole('button', {
        name: 'Cambiar la clave',
      }),
    )
    const dialog = await sheet('Cambiar la clave')
    await user.type(within(dialog).getByPlaceholderText('Clave de ahora'), 'no me acuerdo')
    await user.type(within(dialog).getByPlaceholderText('Clave nueva'), 'la del candado verde')
    await user.type(within(dialog).getByPlaceholderText('Repítela'), 'la del candado verde')
    await user.click(within(dialog).getByRole('button', { name: 'Cambiar la clave' }))
    expect(
      await within(dialog).findByText('Esa no es la clave de ahora. Prueba otra vez.', {}, SLOW),
    ).toBeInTheDocument()

    await user.clear(within(dialog).getByPlaceholderText('Clave de ahora'))
    await user.type(within(dialog).getByPlaceholderText('Clave de ahora'), 'la del candado')
    await user.click(within(dialog).getByRole('button', { name: 'Cambiar la clave' }))
    expect(await screen.findByText('Clave cambiada', {}, SLOW)).toBeInTheDocument()

    const [wrap] = vi.mocked(privateApi.rewrapPrivateVault).mock.calls[0] ?? []
    if (!wrap) throw new Error('No se cambió')
    const opened = await unwrapWithPassword(wrap, 'la del candado verde')
    expect(opened && (await matchesCheck(opened, vault.check))).toBe(true)
  })

  it('he olvidado la clave: con un código por email, otra clave en lugar de la de antes', async () => {
    const user = userEvent.setup()
    vi.mocked(privateApi.sendResetCode).mockResolvedValue()
    vi.mocked(privateApi.verifyResetCode).mockResolvedValue()
    renderProfile(await vaultWith('la del candado'))

    await user.click(
      await within(await screen.findByRole('region', { name: 'Privado' })).findByRole('button', {
        name: 'He olvidado la clave',
      }),
    )
    const forgot = await sheet('¿Crear una clave nueva?')
    expect(within(forgot).getByText(/se perderá/)).toBeInTheDocument()
    await user.click(within(forgot).getByRole('button', { name: 'Enviarme el código' }))
    expect(privateApi.sendResetCode).toHaveBeenCalledWith('fran@ejemplo.com')

    const code = await sheet('Revisa tu email')
    await user.type(within(code).getByRole('textbox', { name: 'Código de seis dígitos' }), '482913')
    await waitFor(() => {
      expect(vi.mocked(privateApi.verifyResetCode).mock.calls[0]?.[0]).toEqual({
        email: 'fran@ejemplo.com',
        token: '482913',
      })
    })

    const create = await sheet('Crea tu clave nueva')
    await user.type(within(create).getByPlaceholderText('Clave privada'), 'la del candado negro')
    await user.type(within(create).getByPlaceholderText('Repítela'), 'la del candado negro')
    await user.click(within(create).getByRole('button', { name: 'Crear clave' }))
    expect(await screen.findByText('Clave nueva creada', {}, SLOW)).toBeInTheDocument()
    expect(privateApi.resetPrivateVault).toHaveBeenCalled()
    expect(privateApi.createPrivateVault).not.toHaveBeenCalled()
  })
})
