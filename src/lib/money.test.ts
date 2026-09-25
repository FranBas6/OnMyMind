import { describe, expect, it } from 'vitest'

import { formatCents } from './money'

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
