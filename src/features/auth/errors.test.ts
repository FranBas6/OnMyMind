import { AuthApiError, AuthRetryableFetchError } from '@supabase/supabase-js'
import { describe, expect, it } from 'vitest'

import { AuthFailure, authErrorMessage } from './errors'

describe('authErrorMessage', () => {
  it('credenciales incorrectas, sin decir cuál de las dos falla', () => {
    const error = new AuthApiError('Invalid login credentials', 400, 'invalid_credentials')
    expect(authErrorMessage(error)).toBe('Ese email o esa contraseña no son. Prueba otra vez.')
  })

  it('email ya registrado', () => {
    const error = new AuthApiError('User already registered', 422, 'user_already_exists')
    expect(authErrorMessage(error)).toBe('Ya hay una cuenta con ese email. Entra con ella.')
  })

  it('sin conexión', () => {
    const error = new AuthRetryableFetchError('Failed to fetch', 0)
    expect(authErrorMessage(error)).toBe('No hay conexión. Prueba otra vez cuando vuelva.')
  })

  it('un AuthFailure ya viene traducido', () => {
    expect(
      authErrorMessage(new AuthFailure('Te falta confirmar el email. Revisa tu correo.')),
    ).toBe('Te falta confirmar el email. Revisa tu correo.')
  })

  it('código desconocido o error que no es de Supabase: mensaje genérico, nunca el inglés', () => {
    const unknown = new AuthApiError('Something weird', 500, 'unexpected_failure')
    expect(authErrorMessage(unknown)).toBe('Algo ha fallado. Prueba otra vez.')
    expect(authErrorMessage(new Error('boom'))).toBe('Algo ha fallado. Prueba otra vez.')
  })
})
