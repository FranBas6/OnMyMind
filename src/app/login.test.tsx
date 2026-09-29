import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { supabase } from '@/lib/supabase/client'
import { renderRoute } from '@/test/render-route'

afterEach(() => {
  vi.restoreAllMocks()
})

/** Sustituye la salida a Google: en jsdom no hay a dónde navegar. */
function mockGoogleRedirect() {
  return vi.spyOn(supabase.auth, 'signInWithOAuth').mockResolvedValue({
    data: { provider: 'google', url: 'https://accounts.google.com/' },
    error: null,
  })
}

describe('Pantalla de acceso', () => {
  it('por defecto es «Entrar» y enlaza a «Crear cuenta» conservando a dónde ibas', async () => {
    const user = userEvent.setup()
    const { router } = renderRoute('/login?redirect=%2Ftoday')

    expect(await screen.findByRole('button', { name: 'Entrar' })).toBeInTheDocument()
    await user.click(screen.getByRole('link', { name: 'Crear cuenta' }))

    expect(await screen.findByRole('button', { name: 'Crear cuenta' })).toBeInTheDocument()
    expect(router.state.location.search).toEqual({ redirect: '/today', mode: 'signup' })
  })

  it('«Crear cuenta» muestra la pista y, al fallar, el error ocupa su hueco', async () => {
    const user = userEvent.setup()
    renderRoute('/login?mode=signup')

    expect(await screen.findByText('Mínimo 8 caracteres.')).toBeInTheDocument()
    await user.type(screen.getByLabelText('Email'), 'ana@ejemplo.com')
    await user.type(screen.getByLabelText('Contraseña'), '12345')
    await user.click(screen.getByRole('button', { name: 'Crear cuenta' }))

    expect(
      await screen.findByText('La contraseña necesita al menos 8 caracteres.'),
    ).toBeInTheDocument()
    expect(screen.queryByText('Mínimo 8 caracteres.')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Contraseña')).toHaveAttribute('aria-invalid', 'true')
  })

  it('«Entrar» avisa del email mal escrito sin llamar al servidor', async () => {
    const user = userEvent.setup()
    renderRoute('/login')

    await user.type(await screen.findByLabelText('Email'), 'ana@ejemplo')
    await user.type(screen.getByLabelText('Contraseña'), 'lo-que-sea')
    await user.click(screen.getByRole('button', { name: 'Entrar' }))

    expect(await screen.findByText('Escribe un email válido.')).toBeInTheDocument()
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Entrar' })).toBeEnabled()
    })
  })

  it('«Continuar con Google» va tras el «o» y sale a Google con la vuelta a /auth/callback', async () => {
    const user = userEvent.setup()
    const signInWithOAuth = mockGoogleRedirect()
    renderRoute('/login?redirect=%2Ftoday')

    const buttons = await screen.findAllByRole('button', { name: /Entrar|Google/ })
    expect(buttons.map((button) => button.textContent)).toEqual(['Entrar', 'Continuar con Google'])
    expect(screen.getByText('o')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Continuar con Google' }))

    expect(signInWithOAuth).toHaveBeenCalledWith({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback?redirect=%2Ftoday`,
        queryParams: { prompt: 'select_account' },
      },
    })
    // Resuelta la llamada, el navegador ya se va: el botón se queda esperando.
    expect(await screen.findByRole('button', { name: 'Abriendo Google…' })).toBeDisabled()
  })

  it('al volver con «atrás» desde Google, el botón deja de esperar', async () => {
    const user = userEvent.setup()
    mockGoogleRedirect()
    renderRoute('/login')

    await user.click(await screen.findByRole('button', { name: 'Continuar con Google' }))
    await screen.findByRole('button', { name: 'Abriendo Google…' })

    window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }))

    expect(await screen.findByRole('button', { name: 'Continuar con Google' })).toBeEnabled()
  })

  it('sin conexión no sale a Google: lo dice encima de «Entrar»', async () => {
    const user = userEvent.setup()
    const signInWithOAuth = mockGoogleRedirect()
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)
    renderRoute('/login')

    await user.click(await screen.findByRole('button', { name: 'Continuar con Google' }))

    expect(
      await screen.findByText('No hay conexión. Prueba otra vez cuando vuelva.'),
    ).toBeInTheDocument()
    expect(signInWithOAuth).not.toHaveBeenCalled()
  })

  it('si Google vuelve sin sesión, el acceso lo dice hasta el siguiente intento', async () => {
    const user = userEvent.setup()
    renderRoute('/login?error=google')

    const message = 'No se ha podido entrar con Google. Prueba otra vez.'
    expect(await screen.findByText(message)).toBeInTheDocument()

    await user.type(screen.getByLabelText('Email'), 'ana@ejemplo')
    await user.type(screen.getByLabelText('Contraseña'), 'lo-que-sea')
    await user.click(screen.getByRole('button', { name: 'Entrar' }))

    await waitFor(() => {
      expect(screen.queryByText(message)).not.toBeInTheDocument()
    })
  })

  it('«Crear cuenta» pone Google primero, con su pista, y vuelve a esa variante', async () => {
    const user = userEvent.setup()
    const signInWithOAuth = mockGoogleRedirect()
    renderRoute('/login?mode=signup')

    const buttons = await screen.findAllByRole('button', { name: /Crear cuenta|Google/ })
    expect(buttons.map((button) => button.textContent)).toEqual([
      'Continuar con Google',
      'Crear cuenta',
    ])
    expect(screen.getByText('Se crea la cuenta sola, con tu nombre y tu foto.')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Continuar con Google' }))

    expect(signInWithOAuth).toHaveBeenCalledWith(
      expect.objectContaining({
        options: expect.objectContaining({
          redirectTo: `${window.location.origin}/auth/callback?mode=signup`,
        }) as unknown,
      }),
    )
  })
})

describe('Vuelta de Google (/auth/callback)', () => {
  it('muestra «Entrando…» mientras se canjea el código', async () => {
    // supabase-js no avisa hasta terminar el canje: aquí no avisa nunca.
    vi.spyOn(supabase.auth, 'onAuthStateChange').mockReturnValue({
      data: { subscription: { id: 'test', callback: vi.fn(), unsubscribe: vi.fn() } },
    })
    renderRoute('/auth/callback?code=abc')

    expect(await screen.findByRole('heading', { name: 'Entrando…' })).toBeInTheDocument()
    expect(screen.getByText('Ya casi. Estamos trayendo tus listas.')).toBeInTheDocument()
  })

  it('un código que no dio sesión (otro navegador, caducado) cuenta como error de Google', async () => {
    const { router } = renderRoute('/auth/callback?code=abc')

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/login')
    })
    expect(router.state.location.search).toEqual({ error: 'google' })
  })

  it('sin sesión y con error, vuelve al acceso con el aviso y conserva a dónde ibas', async () => {
    const { router } = renderRoute(
      '/auth/callback?redirect=%2Ftoday&mode=signup&error=access_denied&error_description=x',
    )

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/login')
    })
    expect(router.state.location.search).toEqual({
      redirect: '/today',
      mode: 'signup',
      error: 'google',
    })
    expect(
      await screen.findByText('No se ha podido entrar con Google. Prueba otra vez.'),
    ).toBeInTheDocument()
  })

  it('sin sesión ni nada en la URL, vuelve al acceso sin aviso', async () => {
    const { router } = renderRoute('/auth/callback')

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/login')
    })
    expect(router.state.location.search).toEqual({})
  })
})
