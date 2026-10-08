import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { AppSection } from '@/features/profile/components/AppSection'
import { usePwa } from '@/hooks/usePwa'

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

/** Lo justo para ver el instalador del navegador desde fuera. */
function InstallProbe({ onOutcome }: { onOutcome: (outcome: string | null) => void }) {
  const { canPromptInstall, promptInstall } = usePwa()
  return (
    <button
      type="button"
      onClick={() => {
        void promptInstall().then(onOutcome)
      }}
    >
      {canPromptInstall ? 'Se puede instalar' : 'No se puede instalar'}
    </button>
  )
}

describe('el instalador del navegador (4.2)', () => {
  it('se guarda al llegar, se abre al tocar y se suelta al instalar', async () => {
    const user = userEvent.setup()
    const onOutcome = vi.fn()
    render(
      <PwaProvider>
        <InstallProbe onOutcome={onOutcome} />
      </PwaProvider>,
    )
    expect(screen.getByRole('button')).toHaveTextContent('No se puede instalar')

    const prompt = vi.fn(() => Promise.resolve())
    const event = Object.assign(new Event('beforeinstallprompt', { cancelable: true }), {
      prompt,
      userChoice: Promise.resolve({ outcome: 'accepted' as const }),
    })
    act(() => {
      window.dispatchEvent(event)
    })
    // Sin la barra que Chrome saca solo.
    expect(event.defaultPrevented).toBe(true)
    expect(screen.getByRole('button')).toHaveTextContent('Se puede instalar')

    await user.click(screen.getByRole('button'))
    expect(prompt).toHaveBeenCalledOnce()
    await waitFor(() => {
      expect(onOutcome).toHaveBeenCalledWith('accepted')
    })
    expect(screen.getByRole('button')).toHaveTextContent('No se puede instalar')
  })

  it('instalada desde el menú del navegador, deja de ofrecerse', () => {
    render(
      <PwaProvider>
        <InstallProbe onOutcome={vi.fn()} />
      </PwaProvider>,
    )
    act(() => {
      window.dispatchEvent(new Event('beforeinstallprompt', { cancelable: true }))
    })
    expect(screen.getByRole('button')).toHaveTextContent('Se puede instalar')
    act(() => {
      window.dispatchEvent(new Event('appinstalled'))
    })
    expect(screen.getByRole('button')).toHaveTextContent('No se puede instalar')
  })
})
