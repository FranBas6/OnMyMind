import { describe, expect, it } from 'vitest'

import { centsToInput, formatCents, parsePriceInput, priceChange } from './money'

// Intl separa cifra y símbolo con un espacio duro (U+00A0): «627» y «€» nunca se parten en dos
// líneas. Por eso los textos esperados usan \u00a0.
describe('formatCents', () => {
  it('euros enteros sin decimales, como en el diseño', () => {
    expect(formatCents(62700)).toBe('627\u00a0€')
  })

  it('con céntimos, dos decimales con coma', () => {
    expect(formatCents(999)).toBe('9,99\u00a0€')
  })

  it('separador de miles español', () => {
    expect(formatCents(1234500)).toBe('12.345\u00a0€')
  })
})

describe('formatCents en otras monedas', () => {
  it('dólares como los escribe es-ES', () => {
    expect(formatCents(4900, 'USD')).toBe('49 US$')
  })
})

describe('parsePriceInput', () => {
  it.each([
    ['9,99', 999],
    ['9.99', 999],
    ['99', 9900],
    ['12 €', 1200],
    ['1.299,50', 129950],
    ['1.299', 129900],
    [' 0,5 ', 50],
  ])('«%s» → %i céntimos', (text, cents) => {
    expect(parsePriceInput(text)).toBe(cents)
  })

  it('vacío es quitar el precio', () => {
    expect(parsePriceInput('')).toBeNull()
    expect(parsePriceInput('  ')).toBeNull()
  })

  it('lo que no se entiende no es un precio (B4)', () => {
    for (const text of ['9,99,5', 'nueve', '0', '1,2,3', '12.3456', '-5', '1,299.50.1']) {
      expect(parsePriceInput(text)).toBeUndefined()
    }
  })
})

describe('centsToInput', () => {
  it('lo que se ve al volver a editar', () => {
    expect(centsToInput(999)).toBe('9,99')
    expect(centsToInput(9900)).toBe('99')
    expect(centsToInput(950)).toBe('9,50')
  })
})

describe('priceChange', () => {
  it('compara con el precio anterior, en porcentaje entero', () => {
    expect(priceChange(30200, 27900)).toEqual({ direction: 'down', percent: 8 })
    expect(priceChange(9600, 9900)).toEqual({ direction: 'up', percent: 3 })
  })

  it('un cambio pequeño dice al menos 1 %; sin anterior o igual, nada', () => {
    expect(priceChange(100000, 99999)).toEqual({ direction: 'down', percent: 1 })
    expect(priceChange(null, 999)).toBeNull()
    expect(priceChange(999, 999)).toBeNull()
    expect(priceChange(999, null)).toBeNull()
  })
})
