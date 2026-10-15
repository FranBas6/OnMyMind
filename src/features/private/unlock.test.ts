import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { getUnlocked, lastLockReason, lock, unlock, UNLOCK_MS, withoutAutoLock } from './unlock'
import { generateVaultKey } from './vault'

function hide() {
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' })
  document.dispatchEvent(new Event('visibilitychange'))
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' })
}

describe('lo desbloqueado (unlock.ts)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    lock()
    vi.useRealTimers()
  })

  it('dura 5 minutos y se bloquea solo', async () => {
    unlock(await generateVaultKey(), 'caja-1')
    expect(getUnlocked()?.keyId).toBe('caja-1')
    vi.advanceTimersByTime(UNLOCK_MS - 1000)
    expect(getUnlocked()).not.toBeNull()
    vi.advanceTimersByTime(1000)
    expect(getUnlocked()).toBeNull()
    // «Se han bloqueado · Pasaron 5 minutos» (diseño 27, D3d).
    expect(lastLockReason()).toBe('timeout')
  })

  it('al salir de la app se bloquea', async () => {
    unlock(await generateVaultKey(), 'caja-1')
    hide()
    expect(getUnlocked()).toBeNull()
    expect(lastLockReason()).toBe('left')
    unlock(await generateVaultKey(), 'caja-1')
    lock()
    expect(lastLockReason()).toBe('manual')
  })

  it('mientras se usa Face ID, el aviso del sistema no cuenta como salir', async () => {
    const key = await generateVaultKey()
    unlock(key, 'caja-1')
    await withoutAutoLock(() => {
      hide()
      return Promise.resolve()
    })
    expect(getUnlocked()?.key).toBe(key)
    hide()
    expect(getUnlocked()).toBeNull()
  })
})
