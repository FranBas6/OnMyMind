import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import * as listsApi from '@/features/lists/api'
import * as todayApi from '@/features/today/api'
import { fakeSession, renderRoute } from '@/test/render-route'

// `/today` hace de ruta privada cualquiera: su loader pide Hoy y las listas, aquí vacías.
vi.mock('@/features/lists/api')
vi.mock('@/features/today/api')

beforeEach(() => {
  vi.mocked(listsApi.fetchLists).mockResolvedValue([])
  vi.mocked(listsApi.fetchArchivedLists).mockResolvedValue([])
  vi.mocked(todayApi.fetchToday).mockResolvedValue([])
})

describe('App shell (móvil)', () => {
  it('barra inferior con cuatro destinos y solo el activo marcado', async () => {
    renderRoute('/today', { session: fakeSession() })

    const nav = await screen.findByRole('navigation', { name: 'Principal' })
    const links = within(nav).getAllByRole('link')
    expect(links.map((link) => link.textContent)).toEqual(['Listas', 'Hoy', 'Buscar', 'Perfil'])
    expect(within(nav).getByRole('link', { name: 'Hoy' })).toHaveAttribute('aria-current', 'page')
    expect(within(nav).getByRole('link', { name: 'Listas' })).not.toHaveAttribute('aria-current')
  })

  it('/login no muestra navegación', async () => {
    renderRoute('/login')

    expect(await screen.findByRole('button', { name: 'Entrar' })).toBeInTheDocument()
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument()
  })

  it('el selector de apariencia cambia la clase del documento', async () => {
    const user = userEvent.setup()
    renderRoute('/profile', { session: fakeSession() })

    await user.click(await screen.findByRole('radio', { name: 'Oscuro' }))
    expect(document.documentElement).toHaveClass('dark')
    expect(screen.getByRole('radio', { name: 'Oscuro' })).toHaveAttribute('aria-checked', 'true')

    await user.click(screen.getByRole('radio', { name: 'Claro' }))
    expect(document.documentElement).not.toHaveClass('dark')
  })
})
