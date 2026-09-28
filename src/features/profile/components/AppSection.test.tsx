import { onlineManager } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { PwaContext, type PwaApi } from '@/hooks/usePwa'

import { AppSection } from './AppSection'

const now = new Date()
const minutesAgo = (minutes: number) => new Date(now.getTime() - minutes * 60_000)

function pwa(overrides: Partial<PwaApi> = {}): PwaApi {
  return {
    buildTime: new Date(2026, 8, 28, 9),
    updateAvailable: false,
    newBuildTime: null,
    checking: false,
    lastCheckedAt: minutesAgo(2),
    checkFailed: false,
    checkForUpdate: vi.fn(),
    applyUpdate: vi.fn(),
    canInstall: false,
    installOpen: false,
    openInstall: vi.fn(),
    closeInstall: vi.fn(),
    ...overrides,
  }
}

function renderWith(api: PwaApi) {
  render(
    <PwaContext value={api}>
      <AppSection />
    </PwaContext>,
  )
  return api
}

describe('Perfil · App', () => {
  afterEach(() => {
    onlineManager.setOnline(true)
  })

  it('al día: la fecha de tu versión, cuándo se comprobó y «Buscar actualización»', async () => {
    const user = userEvent.setup()
    const api = renderWith(pwa())

    expect(screen.getByText('Versión del 28 sep')).toBeInTheDocument()
    expect(screen.getByText('Última comprobación hace 2 min')).toBeInTheDocument()
    expect(screen.getByText('Al día')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Buscar actualización' }))
    expect(api.checkForUpdate).toHaveBeenCalled()
    // Fuera de Safari del iPhone no hay fila de instalar.
    expect(screen.queryByText('Instalar en el iPhone')).not.toBeInTheDocument()
  })

  it('si no se pudo comprobar, lo dice y no presume de «Al día»', () => {
    renderWith(pwa({ checkFailed: true }))
    expect(
      screen.getByText('No se ha podido comprobar. Prueba otra vez en un momento.'),
    ).toBeInTheDocument()
    expect(screen.queryByText('Al día')).not.toBeInTheDocument()
  })

  it('buscando', () => {
    renderWith(pwa({ checking: true }))
    expect(screen.getByText('Comprobando…')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Buscando actualización…' })).toBeDisabled()
  })

  it('con versión nueva: de cuándo es y «Actualizar»', async () => {
    const user = userEvent.setup()
    const api = renderWith(pwa({ updateAvailable: true, newBuildTime: now }))

    expect(screen.getByText('Hay una versión nueva')).toBeInTheDocument()
    expect(screen.getByText('Publicada hoy · la tuya es del 28 sep')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Actualizar' }))
    expect(api.applyUpdate).toHaveBeenCalled()
  })

  it('sin conexión: lo dice y no deja buscar', () => {
    onlineManager.setOnline(false)
    renderWith(pwa())
    expect(screen.getByText('Se comprobará al volver la conexión')).toBeInTheDocument()
    expect(screen.getByText('Sin conexión')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Buscar actualización' })).toBeDisabled()
  })

  it('en Safari del iPhone sin instalar, «Instalar en el iPhone» abre la hoja', async () => {
    const user = userEvent.setup()
    const api = renderWith(pwa({ canInstall: true }))
    await user.click(screen.getByRole('button', { name: /Instalar en el iPhone/ }))
    expect(api.openInstall).toHaveBeenCalled()
  })
})
