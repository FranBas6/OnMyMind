import { AuthApiError } from '@supabase/supabase-js'
import { onlineManager } from '@tanstack/react-query'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { CODE_EXPIRY_SECONDS } from '@/features/auth/emailCode'
import { supabase } from '@/lib/supabase/client'
import { renderRoute } from '@/test/render-route'

const EMAIL = 'ana@ejemplo.com'

function mockSendCode() {
  return vi
    .spyOn(supabase.auth, 'signInWithOtp')
    .mockResolvedValue({ data: { user: null, session: null }, error: null })
}

function mockVerify(error: AuthApiError | null = null) {
  return vi
    .spyOn(supabase.auth, 'verifyOtp')
    .mockResolvedValue({ data: { user: null, session: null }, error })
}

/** Un código ya pedido hace `secondsAgo`: el acceso abre directo en sus casillas. */
function pendingCode(secondsAgo: number) {
  localStorage.setItem(
    'omm.emailCode',
    JSON.stringify({ email: EMAIL, sentAt: Date.now() - secondsAgo * 1000 }),
  )
}

const codeInput = () => screen.getByLabelText('Código de seis dígitos')

beforeEach(() => {
  localStorage.clear()
})

afterEach(() => {
  vi.restoreAllMocks()
  onlineManager.setOnline(true)
})

describe('Código por email', () => {
  it('desde Entrar reutiliza el email, lo manda y pasa a «Revisa tu email»', async () => {
    const user = userEvent.setup()
    const sendCode = mockSendCode()
    renderRoute('/login')

    await user.type(await screen.findByLabelText('Email'), EMAIL)
    await user.click(screen.getByRole('button', { name: 'Entrar con un código por email' }))

    expect(await screen.findByRole('heading', { name: 'Entrar con un código' })).toBeInTheDocument()
    expect(screen.getByLabelText('Email')).toHaveValue(EMAIL)
    await user.click(screen.getByRole('button', { name: 'Enviarme un código' }))

    expect(sendCode).toHaveBeenCalledWith({ email: EMAIL, options: { shouldCreateUser: true } })
    expect(await screen.findByRole('heading', { name: 'Revisa tu email' })).toBeInTheDocument()
    expect(screen.getByText(EMAIL)).toBeInTheDocument()
    expect(screen.getByText(/^Volver a enviar en (60|59) s$/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Entrar' })).toBeDisabled()
  })

  it('el paso 1 avisa del email mal escrito sin mandar nada, y «Volver» regresa a Entrar', async () => {
    const user = userEvent.setup()
    const sendCode = mockSendCode()
    renderRoute('/login')

    await user.click(await screen.findByRole('button', { name: 'Entrar con un código por email' }))
    await user.type(screen.getByLabelText('Email'), 'ana@ejemplo')
    await user.click(screen.getByRole('button', { name: 'Enviarme un código' }))

    expect(await screen.findByText('Escribe un email válido.')).toBeInTheDocument()
    expect(sendCode).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: 'Volver' }))
    expect(await screen.findByRole('button', { name: 'Entrar' })).toBeInTheDocument()
  })

  it('con la sexta cifra comprueba solo y, si vale, enseña «Entrando…»', async () => {
    const user = userEvent.setup()
    const verify = mockVerify()
    pendingCode(10)
    renderRoute('/login')

    await user.type(await screen.findByLabelText('Código de seis dígitos'), '482917')

    expect(verify).toHaveBeenCalledWith({ email: EMAIL, token: '482917', type: 'email' })
    expect(await screen.findByText('Comprobando el código.')).toBeInTheDocument()
    expect(localStorage.getItem('omm.emailCode')).toBeNull()
  })

  it('un código mal escrito lo dice bajo las casillas hasta que se corrige', async () => {
    const user = userEvent.setup()
    mockVerify(new AuthApiError('Token has expired or is invalid', 403, 'otp_expired'))
    pendingCode(10)
    renderRoute('/login')

    await user.type(await screen.findByLabelText('Código de seis dígitos'), '482913')

    expect(await screen.findByText('Ese código no es. Revísalo o pide otro.')).toBeInTheDocument()
    expect(codeInput()).toHaveAttribute('aria-invalid', 'true')

    await user.type(codeInput(), '{Backspace}')
    expect(screen.queryByText('Ese código no es. Revísalo o pide otro.')).not.toBeInTheDocument()
  })

  it('un código caducado vacía las casillas y manda otro solo', async () => {
    const user = userEvent.setup()
    const sendCode = mockSendCode()
    mockVerify(new AuthApiError('Token has expired or is invalid', 403, 'otp_expired'))
    pendingCode(CODE_EXPIRY_SECONDS - 5)
    renderRoute('/login')

    // El código caduca mientras se escribe: se simula adelantando el reloj una vez abierto.
    const input = await screen.findByLabelText('Código de seis dígitos')
    const realNow = Date.now()
    vi.spyOn(Date, 'now').mockReturnValue(realNow + 10_000)
    await user.type(input, '482917')

    expect(
      await screen.findByText('Ese código ya no vale. Te hemos enviado otro.'),
    ).toBeInTheDocument()
    expect(sendCode).toHaveBeenCalledWith({ email: EMAIL, options: { shouldCreateUser: true } })
    expect(codeInput()).toHaveValue('')
  })

  it('tras demasiados intentos bloquea las casillas y el reenvío durante 5 minutos', async () => {
    const user = userEvent.setup()
    mockVerify(new AuthApiError('Too many requests', 429, 'over_request_rate_limit'))
    pendingCode(10)
    renderRoute('/login')

    await user.type(await screen.findByLabelText('Código de seis dígitos'), '482917')

    expect(
      await screen.findByText('Demasiados intentos. Espera 5 minutos o entra con tu contraseña.'),
    ).toBeInTheDocument()
    expect(codeInput()).toBeDisabled()
    expect(screen.getByText('Volver a enviar en 5 min')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Entrar' })).toBeDisabled()
  })

  it('sin conexión espera a que vuelva para comprobarlo', async () => {
    const user = userEvent.setup()
    const verify = mockVerify()
    pendingCode(10)
    renderRoute('/login')
    onlineManager.setOnline(false)

    await user.type(await screen.findByLabelText('Código de seis dígitos'), '482917')

    expect(
      await screen.findByText('Sin conexión. El código se comprobará cuando vuelva.'),
    ).toBeInTheDocument()
    expect(verify).not.toHaveBeenCalled()

    onlineManager.setOnline(true)
    await waitFor(() => {
      expect(verify).toHaveBeenCalledTimes(1)
    })
  })

  it('pasado el minuto se puede volver a enviar, y «Usar otro email» vuelve al paso 1', async () => {
    const user = userEvent.setup()
    const sendCode = mockSendCode()
    pendingCode(61)
    renderRoute('/login')

    await user.click(await screen.findByRole('button', { name: 'Volver a enviar' }))
    expect(sendCode).toHaveBeenCalledTimes(1)
    expect(await screen.findByText(/^Volver a enviar en (60|59) s$/)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Usar otro email' }))
    expect(await screen.findByRole('heading', { name: 'Entrar con un código' })).toBeInTheDocument()
    expect(screen.getByLabelText('Email')).toHaveValue(EMAIL)
    expect(localStorage.getItem('omm.emailCode')).toBeNull()
  })

  it('crear cuenta con contraseña pendiente de confirmar pasa a «Confirma tu email»', async () => {
    const user = userEvent.setup()
    vi.spyOn(supabase.auth, 'signUp').mockResolvedValue({
      data: { user: { identities: [{}] }, session: null },
      error: null,
    } as never)
    renderRoute('/login?mode=signup')

    await user.type(await screen.findByLabelText('Email'), EMAIL)
    await user.type(screen.getByLabelText('Contraseña'), 'una-clave-larga')
    await user.click(screen.getByRole('button', { name: 'Crear cuenta' }))

    expect(await screen.findByRole('heading', { name: 'Confirma tu email' })).toBeInTheDocument()
    expect(screen.getByText(/Tu cuenta está casi lista/)).toBeInTheDocument()
    expect(screen.getByText(EMAIL)).toBeInTheDocument()
    expect(screen.getByLabelText('Código de seis dígitos')).toBeInTheDocument()
  })

  it('crear cuenta con un email ya registrado lo dice en vez de esperar un código', async () => {
    const user = userEvent.setup()
    vi.spyOn(supabase.auth, 'signUp').mockResolvedValue({
      data: { user: { identities: [] }, session: null },
      error: null,
    } as never)
    renderRoute('/login?mode=signup')

    await user.type(await screen.findByLabelText('Email'), EMAIL)
    await user.type(screen.getByLabelText('Contraseña'), 'una-clave-larga')
    await user.click(screen.getByRole('button', { name: 'Crear cuenta' }))

    expect(
      await screen.findByText('Ya hay una cuenta con ese email. Entra con ella.'),
    ).toBeInTheDocument()
  })

  it('desde Crear cuenta, el paso 1 lo dice en su título', async () => {
    const user = userEvent.setup()
    renderRoute('/login?mode=signup')

    await user.click(
      await screen.findByRole('button', { name: 'Crear cuenta con un código por email' }),
    )
    expect(
      await screen.findByRole('heading', { name: 'Crear cuenta con un código' }),
    ).toBeInTheDocument()
  })
})
