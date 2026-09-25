import { describe, expect, it } from 'vitest'

import { safeRedirect } from './redirect'

describe('safeRedirect', () => {
  it('acepta rutas internas con búsqueda', () => {
    expect(safeRedirect('/today')).toBe('/today')
    expect(safeRedirect('/lists/abc?item=1')).toBe('/lists/abc?item=1')
  })

  it('sin destino vuelve a Inicio', () => {
    expect(safeRedirect(undefined)).toBe('/')
    expect(safeRedirect('')).toBe('/')
  })

  it.each(['https://evil.com', '//evil.com', '/\\evil.com', 'javascript:alert(1)', 'today'])(
    'rechaza %s (no es una ruta de la app)',
    (target) => {
      expect(safeRedirect(target)).toBe('/')
    },
  )

  it('no vuelve al propio acceso', () => {
    expect(safeRedirect('/login')).toBe('/')
    expect(safeRedirect('/login?redirect=/today')).toBe('/')
    expect(safeRedirect('/auth/callback')).toBe('/')
  })
})
