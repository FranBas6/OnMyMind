import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { CLEAR_CLIPBOARD_MS, copySecret } from './clipboard'

describe('copiar de una nota protegida (clipboard.ts, C8c)', () => {
  let written: string[]
  let allowed: boolean

  beforeEach(() => {
    vi.useFakeTimers()
    written = []
    allowed = true
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: (text: string) => {
          if (!allowed) return Promise.reject(new Error('NotAllowedError'))
          written.push(text)
          return Promise.resolve()
        },
      },
    })
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('a los 30 s se borra del portapapeles', async () => {
    expect(await copySecret('tq8M-29xk-Lp4r')).toBe(true)
    expect(written).toEqual(['tq8M-29xk-Lp4r'])
    await vi.advanceTimersByTimeAsync(CLEAR_CLIPBOARD_MS - 1)
    expect(written).toEqual(['tq8M-29xk-Lp4r'])
    await vi.advanceTimersByTimeAsync(1)
    expect(written).toEqual(['tq8M-29xk-Lp4r', ''])
  })

  it('si el navegador pide un gesto (Safari), se borra en el siguiente toque', async () => {
    await copySecret('4512')
    allowed = false
    await vi.advanceTimersByTimeAsync(CLEAR_CLIPBOARD_MS)
    expect(written).toEqual(['4512'])
    allowed = true
    document.body.dispatchEvent(new Event('pointerdown', { bubbles: true }))
    await vi.advanceTimersByTimeAsync(0)
    expect(written).toEqual(['4512', ''])
  })
})
