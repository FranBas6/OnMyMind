import { AuthApiError, AuthRetryableFetchError } from '@supabase/supabase-js'
import { afterEach, describe, expect, it } from 'vitest'

import {
  clearPendingCode,
  CODE_EXPIRY_SECONDS,
  codeErrorKind,
  loadPendingCode,
  resendCountdownLabel,
  savePendingCode,
  secondsUntil,
} from './emailCode'

const SENT_AT = Date.UTC(2026, 8, 29, 10, 0, 0)

describe('codeErrorKind', () => {
  const expiredOrInvalid = new AuthApiError('Token has expired or is invalid', 403, 'otp_expired')

  it('un `otp_expired` dentro de la vida del código es un código mal escrito', () => {
    expect(codeErrorKind(expiredOrInvalid, SENT_AT, SENT_AT + 30_000)).toBe('wrong')
  })

  it('pasada la vida del código, el mismo error es que caducó', () => {
    const later = SENT_AT + CODE_EXPIRY_SECONDS * 1000
    expect(codeErrorKind(expiredOrInvalid, SENT_AT, later)).toBe('expired')
  })

  it('distingue demasiados intentos, sin conexión y el resto', () => {
    const rateLimited = new AuthApiError('Too many requests', 429, 'over_request_rate_limit')
    expect(codeErrorKind(rateLimited, SENT_AT, SENT_AT)).toBe('tooMany')
    expect(codeErrorKind(new AuthRetryableFetchError('Failed to fetch', 0), SENT_AT, SENT_AT)).toBe(
      'offline',
    )
    expect(codeErrorKind(new Error('boom'), SENT_AT, SENT_AT)).toBe('other')
  })
})

describe('cuenta atrás de reenviar', () => {
  it('redondea hacia arriba y no baja de cero', () => {
    expect(secondsUntil(SENT_AT + 45_500, SENT_AT)).toBe(46)
    expect(secondsUntil(SENT_AT, SENT_AT + 1000)).toBe(0)
  })

  it('habla en segundos hasta el minuto y en minutos por encima', () => {
    expect(resendCountdownLabel(45)).toBe('Volver a enviar en 45 s')
    expect(resendCountdownLabel(60)).toBe('Volver a enviar en 60 s')
    expect(resendCountdownLabel(61)).toBe('Volver a enviar en 2 min')
    expect(resendCountdownLabel(299)).toBe('Volver a enviar en 5 min')
  })
})

describe('código pendiente guardado', () => {
  afterEach(() => {
    localStorage.clear()
  })

  it('se recupera mientras el código vale y se olvida al caducar', () => {
    savePendingCode({ email: 'ana@ejemplo.com', sentAt: SENT_AT, mode: 'signup' })

    expect(loadPendingCode(SENT_AT + 60_000)).toEqual({
      email: 'ana@ejemplo.com',
      sentAt: SENT_AT,
      mode: 'signup',
    })
    expect(loadPendingCode(SENT_AT + CODE_EXPIRY_SECONDS * 1000)).toBeNull()
    expect(localStorage.length).toBe(0)
  })

  it('ignora lo que no tiene la forma esperada y se puede limpiar', () => {
    localStorage.setItem('omm.emailCode', '{"email":1}')
    expect(loadPendingCode(SENT_AT)).toBeNull()

    savePendingCode({ email: 'ana@ejemplo.com', sentAt: SENT_AT })
    clearPendingCode()
    expect(loadPendingCode(SENT_AT)).toBeNull()
  })
})
