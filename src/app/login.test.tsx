import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import { renderRoute } from '@/test/render-route'

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
})
