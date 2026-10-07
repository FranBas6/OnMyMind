import '@testing-library/jest-dom/vitest'

import { cleanup } from '@testing-library/react'
import { afterEach, vi } from 'vitest'

import type * as SharingApi from '@/features/sharing/api'
import { configureDateLocale } from '@/lib/date'

configureDateLocale()

afterEach(() => {
  cleanup()
})

// Los avisos (2.6) se piden en cualquier pantalla con filas: por defecto, ninguno y sin red.
// Funciones normales y no `vi.fn`, para que `vi.resetAllMocks()` no las deje sin respuesta; un
// test que necesite avisos hace su propio `vi.mock` de este módulo.
vi.mock('@/features/reminders/api', () => ({
  fetchReminders: () => Promise.resolve([]),
  saveReminder: () => Promise.resolve(),
  deleteReminder: () => Promise.resolve(),
  savePushSubscription: () => Promise.resolve(),
  deletePushSubscription: () => Promise.resolve(),
}))

// Quién está en las listas compartidas (3.3) se pide en cualquier pantalla con listas o filas: por
// defecto, nadie comparte nada. El canal en directo (3.4) no se abre: lo que llega por él se prueba
// en `live.test.ts`. Lo demás de compartir, de verdad (un test lo simula a su manera).
vi.mock('@/features/sharing/api', async (importOriginal) => ({
  ...(await importOriginal<typeof SharingApi>()),
  fetchSharedPeople: () => Promise.resolve(new Map()),
  fetchDeparture: () => Promise.resolve(null),
  subscribeToLiveChanges: () => () => undefined,
}))

// La limpieza de fotos (2.8) va a la red un rato después de borrar o cambiar una foto: en los
// tests, nada.
vi.mock('@/features/items/photoCleanup', () => ({
  CLEANUP_DELAY_MS: 30_000,
  removePhotos: () => Promise.resolve(),
  removeOrphanPhotos: () => Promise.resolve(0),
  removeAllPhotos: () => Promise.resolve(),
  schedulePhotoCleanup: () => undefined,
  cleanupPhotosDaily: () => undefined,
}))

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

// Ni ResizeObserver (lo usa el `ResponsiveContainer` de Recharts, en la gráfica de precios).
class NoopResizeObserver {
  observe = vi.fn()
  unobserve = vi.fn()
  disconnect = vi.fn()
}
window.ResizeObserver = NoopResizeObserver
