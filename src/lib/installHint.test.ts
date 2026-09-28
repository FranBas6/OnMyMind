import { describe, expect, it } from 'vitest'

import { INSTALL_HINT_AGAIN_MS, isIosSafari, shouldAutoShow } from './installHint'

const IPHONE_SAFARI =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1'
const IPHONE_CHROME =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/129.0 Mobile/15E148 Safari/604.1'
const IPAD_DESKTOP_MODE =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15'
const MAC_SAFARI = IPAD_DESKTOP_MODE

describe('isIosSafari', () => {
  it('Safari del iPhone y del iPad (que se hace pasar por Mac, pero es táctil)', () => {
    expect(isIosSafari(IPHONE_SAFARI, 5)).toBe(true)
    expect(isIosSafari(IPAD_DESKTOP_MODE, 5)).toBe(true)
  })

  it('no en Chrome de iOS ni en el Mac', () => {
    expect(isIosSafari(IPHONE_CHROME, 5)).toBe(false)
    expect(isIosSafari(MAC_SAFARI, 0)).toBe(false)
  })
})

describe('shouldAutoShow', () => {
  const now = new Date(2026, 8, 28, 12)
  const daysAgo = (days: number) => new Date(now.getTime() - days * 86_400_000).toISOString()

  it('la primera vez, sí', () => {
    expect(shouldAutoShow({ shown: 0, dismissedAt: null, never: false }, now)).toBe(true)
  })

  it('«Lo haré después»: otra vez a los siete días, y solo una', () => {
    expect(shouldAutoShow({ shown: 1, dismissedAt: daysAgo(3), never: false }, now)).toBe(false)
    expect(shouldAutoShow({ shown: 1, dismissedAt: daysAgo(7), never: false }, now)).toBe(true)
    expect(shouldAutoShow({ shown: 2, dismissedAt: daysAgo(30), never: false }, now)).toBe(false)
    expect(INSTALL_HINT_AGAIN_MS).toBe(7 * 86_400_000)
  })

  it('«No volver a mostrar»: nunca', () => {
    expect(shouldAutoShow({ shown: 1, dismissedAt: daysAgo(30), never: true }, now)).toBe(false)
  })
})
