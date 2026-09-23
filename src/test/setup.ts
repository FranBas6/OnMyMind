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
