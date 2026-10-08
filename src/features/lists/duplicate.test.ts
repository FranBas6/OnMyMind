import { describe, expect, it } from 'vitest'

import { copiedSummary, copyName, duplicatedMessage, notCopiedSummary } from './duplicate'

describe('copyName', () => {
  it('una tuya: «(2)», o el siguiente libre (C2)', () => {
    expect(copyName('Maleta de viaje', ['Maleta de viaje', 'Casa'])).toBe('Maleta de viaje (2)')
    expect(copyName('Maleta de viaje', ['Maleta de viaje', 'maleta de viaje (2)'])).toBe(
      'Maleta de viaje (3)',
    )
    // La copia de una copia sigue contando.
    expect(copyName('Maleta de viaje (2)', ['Maleta de viaje', 'Maleta de viaje (2)'])).toBe(
      'Maleta de viaje (3)',
    )
  })

  it('una compartida contigo: «Compras de Fran» (C5)', () => {
    expect(copyName('Compras', ['Casa'], 'Fran')).toBe('Compras de Fran')
    expect(copyName('Compras', ['Compras de Fran'], 'Fran')).toBe('Compras de Fran (2)')
  })

  it('sin pasarse de 80, cortando el nombre y no el número', () => {
    const long = 'x'.repeat(80)
    const copy = copyName(long, [long])
    expect(copy).toHaveLength(80)
    expect(copy.endsWith(' (2)')).toBe(true)
  })
})

describe('textos', () => {
  it('qué se copia y qué no', () => {
    expect(copiedSummary(24)).toBe(
      '24 cosas, todas pendientes, con sus notas, tipos, sublistas, fotos, enlaces, tiendas, precios y repeticiones.',
    )
    expect(copiedSummary(1)).toMatch(/^1 cosa, pendiente, con sus notas/)
    expect(copiedSummary(0)).toBe('La lista, vacía: su nombre, su color y su icono.')
    expect(notCopiedSummary(false)).toBe('Fechas, avisos y personas con quien se comparte.')
    expect(notCopiedSummary(true)).toBe('Fechas, avisos y personas: la copia es solo tuya.')
  })

  it('el aviso (C3)', () => {
    expect(duplicatedMessage(24)).toBe('Copia creada · 24 cosas pendientes')
    expect(duplicatedMessage(1)).toBe('Copia creada · 1 cosa pendiente')
    expect(duplicatedMessage(0)).toBe('Copia creada')
  })
})
