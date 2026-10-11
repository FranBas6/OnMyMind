import { onlineManager } from '@tanstack/react-query'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { List } from '@/features/lists'
import * as listsApi from '@/features/lists/api'
import * as pricesApi from '@/features/prices/api'
import * as profileApi from '@/features/profile/api'
import { queryKeys } from '@/lib/queryKeys'
import { pretendDevice } from '@/test/device'
import { fakeSession, renderRoute, testProfile } from '@/test/render-route'

vi.mock('@/features/lists/api')
vi.mock('@/features/profile/api')
vi.mock('@/features/prices/api')

const session = fakeSession()
const TOKEN = 'r8Fq2xK7mPz3Lq9sVb4Nc1Hd6Tw0Yu5E'
const NEW_TOKEN = 'Kd7m1pQ4zX8cV2bN6mL0sA3fG9hJ5kR7'
/** En los tests, Supabase es el local (`vite.config.ts`). */
const feedUrl = (token: string) =>
  `webcal://127.0.0.1:54321/functions/v1/calendar-feed/${token}.ics`

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

function renderProfile(token: string | null) {
  vi.mocked(listsApi.fetchLists).mockResolvedValue([inbox])
  vi.mocked(listsApi.fetchArchivedLists).mockResolvedValue([])
  vi.mocked(listsApi.fetchRecentCaptures).mockResolvedValue([])
  vi.mocked(pricesApi.fetchSavings).mockResolvedValue(0)
  const profile = testProfile(session.user.id)
  vi.mocked(profileApi.fetchProfile).mockResolvedValue(profile)
  vi.mocked(profileApi.fetchCalendarToken).mockResolvedValue(token)
  vi.mocked(profileApi.createCalendarToken).mockResolvedValue(TOKEN)
  vi.mocked(profileApi.rotateCalendarToken).mockResolvedValue(NEW_TOKEN)
  return renderRoute('/profile', {
    session,
    seed: (queryClient) => {
      queryClient.setQueryData(queryKeys.lists.all, [inbox])
      queryClient.setQueryData(queryKeys.lists.archived, [])
      queryClient.setQueryData(queryKeys.profile(), profile)
    },
  })
}

const openSheet = async (user: ReturnType<typeof userEvent.setup>) => {
  const section = await screen.findByRole('region', { name: 'Calendario' })
  await user.click(within(section).getByRole('button', { name: /Calendario del iPhone/ }))
  return screen.findByRole('dialog', { name: 'Calendario del iPhone' })
}

describe('Perfil · Calendario del iPhone (3.7, diseño 21)', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    onlineManager.setOnline(true)
    // Apple sin la hoja «Instalar en el iPhone», que en Safari del iPhone sale sola.
    pretendDevice('mac')
  })
  afterEach(() => {
    onlineManager.setOnline(true)
    vi.restoreAllMocks()
  })

  it('la fila dice «Enlace activo» y la hoja enseña el enlace para suscribirse y copiarlo (C1–C3)', async () => {
    const user = userEvent.setup()
    const writeText = vi.fn(() => Promise.resolve())
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } })
    renderProfile(TOKEN)

    const section = await screen.findByRole('region', { name: 'Calendario' })
    expect(await within(section).findByText('Enlace activo')).toBeInTheDocument()
    expect(
      within(section).getByText('Tus eventos en el Calendario, solo para ver.'),
    ).toBeInTheDocument()

    const sheet = await openSheet(user)
    expect(within(sheet).getByText(/Son solo para ver: se cambian aquí/)).toBeInTheDocument()
    expect(
      within(sheet).getByText('Las tareas, las compras ni lo de «En mente».'),
    ).toBeInTheDocument()
    expect(
      within(sheet).getByRole('link', { name: 'Suscribirse en el Calendario' }),
    ).toHaveAttribute('href', feedUrl(TOKEN))
    expect(within(sheet).getByText(feedUrl(TOKEN))).toBeInTheDocument()
    expect(profileApi.createCalendarToken).not.toHaveBeenCalled()

    await user.click(within(sheet).getByRole('button', { name: 'Copiar enlace' }))
    expect(writeText).toHaveBeenCalledWith(feedUrl(TOKEN))
    expect(await within(sheet).findByRole('button', { name: 'Copiado' })).toBeInTheDocument()
  })

  it('sin enlace, tocar la fila lo crea', async () => {
    const user = userEvent.setup()
    renderProfile(null)

    const section = await screen.findByRole('region', { name: 'Calendario' })
    await waitFor(() => {
      expect(profileApi.fetchCalendarToken).toHaveBeenCalled()
    })
    expect(within(section).queryByText('Enlace activo')).not.toBeInTheDocument()

    const sheet = await openSheet(user)
    expect(profileApi.createCalendarToken).toHaveBeenCalledOnce()
    expect(await within(sheet).findByText(feedUrl(TOKEN))).toBeInTheDocument()
    expect(await within(section).findByText('Enlace activo')).toBeInTheDocument()
  })

  it('«Cambiar enlace» pide confirmación en el sitio y deja el nuevo resaltado (C4, C5)', async () => {
    const user = userEvent.setup()
    renderProfile(TOKEN)
    const sheet = await openSheet(user)

    await user.click(within(sheet).getByRole('button', { name: 'Cambiar enlace' }))
    const confirm = within(sheet).getByRole('group', { name: /¿Cambiar el enlace\?/ })
    await user.click(within(confirm).getByRole('button', { name: 'Cancelar' }))
    expect(profileApi.rotateCalendarToken).not.toHaveBeenCalled()

    await user.click(within(sheet).getByRole('button', { name: 'Cambiar enlace' }))
    await user.click(within(sheet).getByRole('button', { name: 'Cambiar' }))
    expect(profileApi.rotateCalendarToken).toHaveBeenCalledOnce()
    expect(await within(sheet).findByText(feedUrl(NEW_TOKEN))).toBeInTheDocument()
    expect(within(sheet).getByText(/Enlace nuevo\. El anterior ya no funciona/)).toBeInTheDocument()
    expect(within(sheet).queryByRole('button', { name: 'Cambiar enlace' })).not.toBeInTheDocument()
  })

  it('sin conexión, suscribirse y cambiar se apagan; copiar no (C6)', async () => {
    const user = userEvent.setup()
    const writeText = vi.fn(() => Promise.resolve())
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } })
    renderProfile(TOKEN)
    expect(await screen.findByText('Enlace activo')).toBeInTheDocument()
    onlineManager.setOnline(false)

    const sheet = await openSheet(user)
    expect(
      within(sheet).getByText('Para suscribirte o cambiar el enlace hace falta conexión.'),
    ).toBeInTheDocument()
    const subscribe = within(sheet).getByText('Suscribirse en el Calendario').closest('a')
    expect(subscribe).toHaveAttribute('aria-disabled', 'true')
    expect(subscribe).not.toHaveAttribute('href')
    expect(within(sheet).getByRole('button', { name: 'Cambiar enlace' })).toBeDisabled()

    await user.click(within(sheet).getByRole('button', { name: 'Copiar enlace' }))
    expect(writeText).toHaveBeenCalledWith(feedUrl(TOKEN))
  })
})

describe('Perfil · el calendario fuera de Apple (4.2, diseño 23)', () => {
  const httpsUrl = (token: string) =>
    `http://127.0.0.1:54321/functions/v1/calendar-feed/${token}.ics`
  const openOther = async (user: ReturnType<typeof userEvent.setup>) => {
    const section = await screen.findByRole('region', { name: 'Calendario' })
    await user.click(within(section).getByRole('button', { name: /Añadir a tu calendario/ }))
    return screen.findByRole('dialog', { name: 'Añadir a tu calendario' })
  }
  const howTo = (sheet: HTMLElement) =>
    within(sheet)
      .getAllByRole('term')
      .map((term) => term.textContent)

  beforeEach(() => {
    vi.resetAllMocks()
    onlineManager.setOnline(true)
  })
  afterEach(() => {
    onlineManager.setOnline(true)
    vi.restoreAllMocks()
  })

  it('en Android: «Añadir a tu calendario», copia el https:// y dice cómo, Google primero (A1–A3)', async () => {
    pretendDevice('android')
    const user = userEvent.setup()
    const writeText = vi.fn(() => Promise.resolve())
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } })
    renderProfile(TOKEN)

    const section = await screen.findByRole('region', { name: 'Calendario' })
    expect(
      within(section).getByText(
        'Tus eventos en Google Calendar, Outlook u otro calendario, solo para ver.',
      ),
    ).toBeInTheDocument()
    expect(within(section).queryByText(/iPhone/)).not.toBeInTheDocument()

    const sheet = await openOther(user)
    expect(within(sheet).queryByRole('link')).not.toBeInTheDocument()
    expect(within(sheet).queryByText(/Suscribirse en el Calendario/)).not.toBeInTheDocument()
    expect(within(sheet).getByText(/El calendario los pone al día solo/)).toBeInTheDocument()
    expect(await within(sheet).findByText(httpsUrl(TOKEN))).toBeInTheDocument()
    expect(howTo(sheet)).toEqual(['Google Calendar', 'Outlook'])
    expect(
      within(sheet).getByText('Otros calendarios › Desde URL, y pega el enlace.'),
    ).toBeInTheDocument()

    await user.click(within(sheet).getByRole('button', { name: 'Copiar enlace' }))
    expect(writeText).toHaveBeenCalledWith(httpsUrl(TOKEN))
    expect(await within(sheet).findByRole('button', { name: 'Enlace copiado' })).toBeInTheDocument()
  })

  it('en Windows: Outlook primero; cambiarlo pide añadir el nuevo (E1)', async () => {
    pretendDevice('windows')
    const user = userEvent.setup()
    renderProfile(TOKEN)
    const sheet = await openOther(user)
    expect(howTo(sheet)).toEqual(['Outlook', 'Google Calendar'])

    await user.click(within(sheet).getByRole('button', { name: 'Cambiar enlace' }))
    expect(
      within(sheet).getByRole('group', {
        name: /tu calendario dejará de ponerse al día hasta que añadas el nuevo/,
      }),
    ).toBeInTheDocument()
    await user.click(within(sheet).getByRole('button', { name: 'Cambiar' }))
    expect(await within(sheet).findByText(httpsUrl(NEW_TOKEN))).toBeInTheDocument()
    expect(
      within(sheet).getByText(/cópialo y añádelo otra vez a tu calendario/),
    ).toBeInTheDocument()
  })

  it('sin conexión, copiar sigue; cambiar no', async () => {
    pretendDevice('android')
    const user = userEvent.setup()
    renderProfile(TOKEN)
    expect(await screen.findByText('Enlace activo')).toBeInTheDocument()
    onlineManager.setOnline(false)

    const sheet = await openOther(user)
    expect(
      within(sheet).getByText('Para cambiar el enlace hace falta conexión.'),
    ).toBeInTheDocument()
    expect(within(sheet).getByRole('button', { name: 'Copiar enlace' })).toBeEnabled()
    expect(within(sheet).getByRole('button', { name: 'Cambiar enlace' })).toBeDisabled()
  })
})
