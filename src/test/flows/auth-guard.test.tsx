import { screen, waitFor } from '@testing-library/react'
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

describe('Guarda de sesión', () => {
  it('sin sesión, una ruta privada lleva a /login recordando a dónde ibas', async () => {
    const { router } = renderRoute('/today')

    expect(await screen.findByRole('button', { name: 'Entrar' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/login')
    expect(router.state.location.search).toEqual({ redirect: '/today' })
    expect(screen.queryByRole('heading', { name: 'Hoy' })).not.toBeInTheDocument()
  })

  it('con sesión, la ruta privada se muestra', async () => {
    renderRoute('/today', { session: fakeSession() })

    expect(await screen.findByRole('heading', { name: 'Hoy' })).toBeInTheDocument()
  })

  it('con sesión, /login lleva directamente a la ruta guardada', async () => {
    const { router } = renderRoute('/login?redirect=%2Ftoday', { session: fakeSession() })

    expect(await screen.findByRole('heading', { name: 'Hoy' })).toBeInTheDocument()
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/today')
    })
  })
})
