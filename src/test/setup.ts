import '@testing-library/jest-dom/vitest'

import { cleanup } from '@testing-library/react'
import { afterEach, vi } from 'vitest'

import { configureDateLocale } from '@/lib/date'

configureDateLocale()

afterEach(() => {
  cleanup()
})

// jsdom no implementa matchMedia (lo usan next-themes y sonner).
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
})

// jsdom tampoco implementa scrollTo (lo usa la restauración de scroll del router).
Object.defineProperty(window, 'scrollTo', { writable: true, value: vi.fn() })

// Ni `elementFromPoint` (lo usa input-otp para no chocar con los gestores de contraseñas).
Object.defineProperty(document, 'elementFromPoint', { writable: true, value: vi.fn(() => null) })

// Ni la captura de puntero (la usa vaul al arrastrar las hojas).
Element.prototype.setPointerCapture = vi.fn()
Element.prototype.releasePointerCapture = vi.fn()
Element.prototype.hasPointerCapture = vi.fn(() => false)
