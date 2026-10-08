import { onlineManager } from '@tanstack/react-query'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import * as authApi from '@/features/auth/api'
import * as itemsApi from '@/features/items/api'
import type { List } from '@/features/lists'
import * as listsApi from '@/features/lists/api'
import * as pricesApi from '@/features/prices/api'
import * as profileApi from '@/features/profile/api'
import * as download from '@/lib/download'
import { queryKeys } from '@/lib/queryKeys'
import { fakeSession, renderRoute, testProfile } from '@/test/render-route'

vi.mock('@/features/auth/api')
vi.mock('@/features/items/api')
vi.mock('@/features/lists/api')
vi.mock('@/features/profile/api')
vi.mock('@/features/prices/api')
vi.mock('@/lib/download')

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
    isOwner: true,
    ...overrides,
  }
}

const inbox = list('i', 'En mente', { kind: 'inbox', color: 'indigo', position: 1000 })
const casa = list('casa', 'Casa')
const trabajo = list('trabajo', 'Trabajo', { color: 'pink', position: 3000 })
const regalos = list('regalos', 'Regalos', { archivedAt: new Date(2026, 8, 1) })

function renderProfile() {
  let signedIn = true
  vi.mocked(authApi.signOut).mockImplementation(() => {
    signedIn = false
    return Promise.resolve()
  })
  vi.mocked(listsApi.fetchLists).mockResolvedValue([inbox, casa, trabajo])
  vi.mocked(listsApi.fetchArchivedLists).mockResolvedValue([regalos])
  vi.mocked(listsApi.fetchRecentCaptures).mockResolvedValue([])
  vi.mocked(pricesApi.fetchSavings).mockResolvedValue(0)
  const profile = testProfile(session.user.id)
  vi.mocked(profileApi.fetchProfile).mockResolvedValue(profile)
  vi.mocked(profileApi.fetchAccountCounts).mockResolvedValue({ lists: 6, items: 214 })
  return renderRoute('/profile', {
    session,
    getSession: () => Promise.resolve(signedIn ? session : null),
    seed: (queryClient) => {
      queryClient.setQueryData(queryKeys.lists.all, [inbox, casa, trabajo])
      queryClient.setQueryData(queryKeys.lists.archived, [regalos])
      queryClient.setQueryData(queryKeys.profile(), profile)
    },
  })
}

const region = (name: string) => screen.findByRole('region', { name })
const sheet = (name: string) => screen.findByRole('dialog', { name })

describe('Perfil · Datos y Cuenta (2.8, diseño 18)', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    window.sessionStorage.clear()
    onlineManager.setOnline(true)
  })
  afterEach(() => {
    onlineManager.setOnline(true)
  })

  it('exportar en JSON: todo, en un archivo con el día', async () => {
    const user = userEvent.setup()
    vi.mocked(profileApi.fetchExport).mockResolvedValue({
      app: 'OnMyMind',
      format: 2,
      exported_at: '2026-10-05T10:00:00.000Z',
      profile: null,
      lists: [],
      items: [],
      item_links: [],
      item_images: [],
      item_prices: [],
      reminders: [],
      item_completions: [],
    })
    renderProfile()

    await user.click(
      await within(await region('Datos')).findByRole('button', { name: /Exportar mis datos/ }),
    )
    const dialog = await sheet('Exportar mis datos')
    expect(within(dialog).getByRole('radio', { name: /JSON · todo/ })).toBeChecked()
    expect(within(dialog).getByText(/Las fotos van como enlaces/)).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: 'Exportar' }))

    await waitFor(() => {
      expect(download.downloadFile).toHaveBeenCalledWith(
        expect.stringMatching(/^onmymind-\d{4}-\d{2}-\d{2}\.json$/),
        expect.stringContaining('"app": "OnMyMind"'),
        'application/json',
      )
    })
    expect(profileApi.fetchExport).toHaveBeenCalledWith(session.user.id)
    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'Exportar mis datos' })).not.toBeInTheDocument()
    })
  })

  it('exportar en CSV: se elige la lista (también las archivadas) y se descarga la suya', async () => {
    const user = userEvent.setup()
    vi.mocked(itemsApi.fetchItems).mockResolvedValue([])
    renderProfile()

    await user.click(
      await within(await region('Datos')).findByRole('button', { name: /Exportar mis datos/ }),
    )
    const dialog = await sheet('Exportar mis datos')
    await user.click(within(dialog).getByRole('radio', { name: /CSV · una lista/ }))
    const lists = within(dialog).getByRole('radiogroup', { name: 'Qué lista' })
    expect(
      within(lists)
        .getAllByRole('radio')
        .map((radio) => radio.textContent),
    ).toEqual(['En mente', 'Casa', 'Trabajo', 'Regalos · archivada'])
    expect(within(lists).getByRole('radio', { name: 'Casa' })).toBeChecked()
    await user.click(within(lists).getByRole('radio', { name: 'Trabajo' }))
    await user.click(within(dialog).getByRole('button', { name: 'Exportar Trabajo' }))

    await waitFor(() => {
      expect(download.downloadFile).toHaveBeenCalledWith(
        expect.stringMatching(/^onmymind-trabajo-\d{4}-\d{2}-\d{2}\.csv$/),
        expect.stringContaining('Título;Sublista;Tipo'),
        'text/csv;charset=utf-8',
      )
    })
    expect(itemsApi.fetchItems).toHaveBeenCalledWith('trabajo')
  })

  it('si exportar falla, lo dice y deja volver a probar', async () => {
    const user = userEvent.setup()
    vi.mocked(profileApi.fetchExport).mockRejectedValue(new Error('500'))
    renderProfile()

    await user.click(
      await within(await region('Datos')).findByRole('button', { name: /Exportar mis datos/ }),
    )
    const dialog = await sheet('Exportar mis datos')
    await user.click(within(dialog).getByRole('button', { name: 'Exportar' }))
    expect(
      await within(dialog).findByText('No se ha podido exportar. Prueba otra vez en un momento.'),
    ).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'Exportar' })).toBeEnabled()
    expect(download.downloadFile).not.toHaveBeenCalled()
  })

  it('borrar la cuenta: dice cuánto, pide «borrar» y vuelve al acceso con el aviso', async () => {
    const user = userEvent.setup()
    vi.mocked(profileApi.deleteAccount).mockResolvedValue()
    const { router } = renderProfile()

    await user.click(
      await within(await region('Cuenta')).findByRole('button', { name: 'Borrar la cuenta' }),
    )
    const dialog = await sheet('¿Borrar tu cuenta?')
    expect(
      await within(dialog).findByText((_, element) =>
        element?.tagName === 'P'
          ? element.textContent.startsWith('Se borran tus 6 listas y las 214 cosas que hay dentro')
          : false,
      ),
    ).toBeInTheDocument()
    const confirm = within(dialog).getByRole('button', { name: 'Borrar mi cuenta' })
    expect(confirm).toBeDisabled()
    await user.type(within(dialog).getByLabelText('Escribe «borrar» para confirmar'), 'borr')
    expect(confirm).toBeDisabled()
    await user.type(within(dialog).getByLabelText('Escribe «borrar» para confirmar'), 'ar')
    expect(confirm).toBeEnabled()
    await user.click(confirm)

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/login')
    })
    expect(profileApi.deleteAccount).toHaveBeenCalled()
    expect(authApi.signOut).toHaveBeenCalled()
    expect(
      await screen.findByText('Tu cuenta y todo lo que tenía se han borrado.'),
    ).toBeInTheDocument()
  })

  it('si borrar falla, la cuenta sigue y se puede volver a probar', async () => {
    const user = userEvent.setup()
    vi.mocked(profileApi.deleteAccount).mockRejectedValue(new Error('500'))
    const { router } = renderProfile()

    await user.click(
      await within(await region('Cuenta')).findByRole('button', { name: 'Borrar la cuenta' }),
    )
    const dialog = await sheet('¿Borrar tu cuenta?')
    await user.type(within(dialog).getByLabelText('Escribe «borrar» para confirmar'), 'Borrar')
    await user.click(within(dialog).getByRole('button', { name: 'Borrar mi cuenta' }))
    expect(
      await within(dialog).findByText(
        'No se ha podido borrar la cuenta. Prueba otra vez en un momento.',
      ),
    ).toBeInTheDocument()
    expect(authApi.signOut).not.toHaveBeenCalled()
    expect(router.state.location.pathname).toBe('/profile')
  })

  it('«exporta tus datos» lleva de la confirmación a exportar', async () => {
    const user = userEvent.setup()
    renderProfile()

    await user.click(
      await within(await region('Cuenta')).findByRole('button', { name: 'Borrar la cuenta' }),
    )
    const dialog = await sheet('¿Borrar tu cuenta?')
    await user.click(within(dialog).getByRole('button', { name: 'exporta tus datos' }))
    expect(await sheet('Exportar mis datos')).toBeInTheDocument()
    expect(screen.queryByRole('dialog', { name: '¿Borrar tu cuenta?' })).not.toBeInTheDocument()
  })

  it('sin conexión, exportar y borrar la cuenta dicen «Necesita conexión» (P11)', async () => {
    renderProfile()
    onlineManager.setOnline(false)

    const exportRow = await within(await region('Datos')).findByRole('button', {
      name: /Exportar mis datos/,
    })
    await waitFor(() => {
      expect(exportRow).toBeDisabled()
    })
    expect(exportRow).toHaveTextContent('Necesita conexión')
    const deleteRow = within(await region('Cuenta')).getByRole('button', {
      name: /Borrar la cuenta/,
    })
    expect(deleteRow).toBeDisabled()
    expect(deleteRow).toHaveTextContent('Necesita conexión')
  })
})
