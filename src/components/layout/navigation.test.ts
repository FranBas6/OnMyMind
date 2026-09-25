import { describe, expect, it } from 'vitest'

import { isDestinationActive } from './navigation'

describe('isDestinationActive', () => {
  it('«Listas» está activo en Inicio y en el detalle de una lista', () => {
    expect(isDestinationActive('/', '/')).toBe(true)
    expect(isDestinationActive('/', '/lists/abc')).toBe(true)
    expect(isDestinationActive('/', '/today')).toBe(false)
  })

  it('el resto, en su ruta exacta o lo que cuelgue de ella', () => {
    expect(isDestinationActive('/today', '/today')).toBe(true)
    expect(isDestinationActive('/search', '/search')).toBe(true)
    expect(isDestinationActive('/profile', '/profile/x')).toBe(true)
    expect(isDestinationActive('/search', '/searchable')).toBe(false)
  })
})
