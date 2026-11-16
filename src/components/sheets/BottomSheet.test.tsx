import { act, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { BottomSheet } from './BottomSheet'

/** Un `visualViewport` de mentira, como el del iPhone al sacar el teclado. */
class FakeViewport extends EventTarget {
  height = 844
  offsetTop = 0
  set(height: number, offsetTop = 0) {
    this.height = height
    this.offsetTop = offsetTop
    this.dispatchEvent(new Event('resize'))
  }
}

describe('la hoja inferior con el teclado (bug de Fran, 2026-10-15)', () => {
  const original = window.visualViewport
  afterEach(() => {
    Object.defineProperty(window, 'visualViewport', { configurable: true, value: original })
  })

  it('se apoya encima del teclado, no pasa de lo que se ve y deja el aire de abajo', () => {
    const viewport = new FakeViewport()
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 844 })
    Object.defineProperty(window, 'visualViewport', { configurable: true, value: viewport })
    render(
      <BottomSheet open onOpenChange={() => undefined} title="Detalle">
        <textarea aria-label="Notas" />
      </BottomSheet>,
    )
    const sheet = screen.getByRole('dialog', { name: 'Detalle' })
    // Sin teclado, como siempre: abajo del todo, con su aire y la zona segura.
    expect(sheet.style.bottom).toBe('')
    expect(sheet.style.maxHeight).toBe('')

    act(() => {
      viewport.set(508)
    })
    expect(sheet.style.bottom).toBe('336px')
    expect(sheet.style.maxHeight).toBe('496px')
    expect(sheet.style.paddingBottom).toBe('12px')

    // iOS desplaza la vista para enseñar el campo: la hoja sigue pegada al teclado.
    act(() => {
      viewport.set(508, 120)
    })
    expect(sheet.style.bottom).toBe('216px')

    act(() => {
      viewport.set(844)
    })
    expect(sheet.style.bottom).toBe('')
    expect(sheet.style.paddingBottom).toBe('')
  })
})
