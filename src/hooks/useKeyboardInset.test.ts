import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { useKeyboardInset } from './useKeyboardInset'

/** Un `visualViewport` de mentira: EventTarget con el alto y el desplazamiento que se le pidan. */
class FakeViewport extends EventTarget {
  height = 844
  offsetTop = 0
  set(height: number, offsetTop = 0) {
    this.height = height
    this.offsetTop = offsetTop
    this.dispatchEvent(new Event('resize'))
  }
}

describe('useKeyboardInset', () => {
  const original = window.visualViewport

  afterEach(() => {
    Object.defineProperty(window, 'visualViewport', { configurable: true, value: original })
  })

  function setup() {
    const viewport = new FakeViewport()
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 844 })
    Object.defineProperty(window, 'visualViewport', { configurable: true, value: viewport })
    return { viewport, result: renderHook(() => useKeyboardInset()).result }
  }

  it('sin teclado, 0', () => {
    expect(setup().result.current).toBe(0)
  })

  it('con el teclado abierto, lo que tapa (y sigue al abrir y cerrar)', () => {
    const { viewport, result } = setup()
    act(() => {
      viewport.set(508)
    })
    expect(result.current).toBe(336)
    act(() => {
      viewport.set(844)
    })
    expect(result.current).toBe(0)
  })

  it('si iOS desplaza la vista, cuenta el desplazamiento', () => {
    const { viewport, result } = setup()
    act(() => {
      viewport.set(508, 120)
    })
    expect(result.current).toBe(216)
  })
})
