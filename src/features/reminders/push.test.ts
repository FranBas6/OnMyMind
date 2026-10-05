import { describe, expect, it } from 'vitest'

import { derivePushState, isIos, keyBytes } from './push'
import { VAPID_PUBLIC_KEY } from './vapid'

const base = { ios: false, standalone: false, supported: true, subscribed: false } as const

describe('cómo está un dispositivo', () => {
  it('en el iPhone, primero hay que instalar la app', () => {
    expect(derivePushState({ ...base, ios: true, permission: 'default' })).toBe('needs-install')
    expect(derivePushState({ ...base, ios: true, standalone: true, permission: 'default' })).toBe(
      'off',
    )
  })

  it('sin soporte, denegado, por activar y activado', () => {
    expect(derivePushState({ ...base, supported: false, permission: 'default' })).toBe(
      'unsupported',
    )
    expect(derivePushState({ ...base, permission: null })).toBe('unsupported')
    expect(derivePushState({ ...base, permission: 'denied' })).toBe('denied')
    expect(derivePushState({ ...base, permission: 'default' })).toBe('off')
    // Con permiso pero sin suscripción (se borró), se puede volver a activar.
    expect(derivePushState({ ...base, permission: 'granted' })).toBe('off')
    expect(derivePushState({ ...base, permission: 'granted', subscribed: true })).toBe('on')
  })

  it('reconoce el iPhone y el iPad (que dice ser un Mac con pantalla táctil)', () => {
    const iphone = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit Safari'
    const ipad = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit Safari'
    expect(isIos(iphone, 5)).toBe(true)
    expect(isIos(ipad, 5)).toBe(true)
    expect(isIos(ipad, 0)).toBe(false)
  })
})

describe('la clave pública VAPID', () => {
  it('son 65 bytes de un punto P-256 sin comprimir', () => {
    const bytes = keyBytes(VAPID_PUBLIC_KEY)
    expect(bytes).toHaveLength(65)
    expect(bytes[0]).toBe(4)
  })
})
