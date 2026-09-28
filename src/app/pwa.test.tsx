import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { AppSection } from '@/features/profile/components/AppSection'

import { PwaProvider } from './pwa'

/** Perfil · App con el `PwaProvider` de verdad; en jsdom no hay service worker. */
function renderApp() {
  render(
    <PwaProvider>
      <AppSection />
    </PwaProvider>,
  )
}

const respond = (body: unknown, ok = true) =>
  vi
    .spyOn(globalThis, 'fetch')
    .mockResolvedValue({ ok, json: () => Promise.resolve(body) } as Response)

describe('buscar actualización sin service worker', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('si la versión publicada es más nueva, la ofrece', async () => {
    const user = userEvent.setup()
    respond({ builtAt: new Date(Date.now() + 60_000).toISOString() })
    renderApp()

    await user.click(screen.getByRole('button', { name: 'Buscar actualización' }))
    expect(screen.getByRole('button', { name: 'Buscando actualización…' })).toBeDisabled()

    expect(await screen.findByText('Hay una versión nueva')).toBeInTheDocument()
    expect(fetch).toHaveBeenCalledWith('/version.json', { cache: 'no-store' })
  })

  it('si es la misma, «Al día»', async () => {
    const user = userEvent.setup()
    respond({ builtAt: __APP_BUILD_TIME__ })
    renderApp()

    await user.click(screen.getByRole('button', { name: 'Buscar actualización' }))
    expect(await screen.findByText('Al día')).toBeInTheDocument()
    expect(screen.getByText(/Última comprobación/)).toBeInTheDocument()
  })

  it('si no contesta, lo dice', async () => {
    const user = userEvent.setup()
    respond({}, false)
    renderApp()

    await user.click(screen.getByRole('button', { name: 'Buscar actualización' }))
    await waitFor(() => {
      expect(screen.getByText(/No se ha podido comprobar/)).toBeInTheDocument()
    })
  })
})
