import { describe, expect, it } from 'vitest'

import { VAPID_PUBLIC_KEY as APP_VAPID_PUBLIC_KEY } from '@/features/reminders/vapid'

import { isGoneStatus, VAPID_PUBLIC_KEY, vapidJwk } from './push'

describe('el envío', () => {
  it('una suscripción que ya no existe (404 o 410) se borra; otros errores, no', () => {
    expect(isGoneStatus(410)).toBe(true)
    expect(isGoneStatus(404)).toBe(true)
    expect(isGoneStatus(429)).toBe(false)
    expect(isGoneStatus(500)).toBe(false)
  })

  it('la clave pública es la de la app', () => {
    expect(VAPID_PUBLIC_KEY).toBe(APP_VAPID_PUBLIC_KEY)
  })

  it('el par VAPID en JWK firma y verifica con WebCrypto', async () => {
    // Un par cualquiera, en el formato de web-push (el de la app es secreto).
    const pair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, [
      'sign',
      'verify',
    ])
    const raw = new Uint8Array(await crypto.subtle.exportKey('raw', pair.publicKey))
    const jwk = await crypto.subtle.exportKey('jwk', pair.privateKey)
    const encode = (bytes: Uint8Array) =>
      btoa(String.fromCharCode(...bytes))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '')
    const keys = vapidJwk(encode(raw), jwk.d ?? '')

    const algorithm = { name: 'ECDSA', namedCurve: 'P-256' }
    const signing = await crypto.subtle.importKey('jwk', keys.privateKey, algorithm, false, [
      'sign',
    ])
    const verifying = await crypto.subtle.importKey('jwk', keys.publicKey, algorithm, true, [
      'verify',
    ])
    const data = new TextEncoder().encode('OnMyMind')
    const signature = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, signing, data)
    expect(
      await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, verifying, signature, data),
    ).toBe(true)
  })

  it('una clave que no es P-256 se rechaza', () => {
    expect(() => vapidJwk('AAAA', 'AAAA')).toThrow('pública')
    expect(() => vapidJwk(VAPID_PUBLIC_KEY, 'AAAA')).toThrow('privada')
  })
})
