import { describe, expect, it } from 'vitest'

import { lineValue } from './lineValue'

describe('lo que se copia de una línea (lineValue.ts, 5.7)', () => {
  it('con «Etiqueta: valor», solo el valor', () => {
    expect(lineValue('Contraseña: 123456')).toEqual({ label: 'Contraseña', value: '123456' })
    expect(lineValue('Usuario:@francisco')).toEqual({ label: 'Usuario', value: '@francisco' })
    expect(lineValue('• Clave del wifi: tq8M-29xk-Lp4r ')).toEqual({
      label: 'Clave del wifi',
      value: 'tq8M-29xk-Lp4r',
    })
    expect(lineValue('Web: https://instagram.com')).toEqual({
      label: 'Web',
      value: 'https://instagram.com',
    })
  })

  it('sin etiqueta, la línea entera; vacía, nada', () => {
    expect(lineValue('La del router está en la pegatina de abajo.')).toEqual({
      label: null,
      value: 'La del router está en la pegatina de abajo.',
    })
    expect(lineValue('https://instagram.com/francisco')).toEqual({
      label: null,
      value: 'https://instagram.com/francisco',
    })
    expect(lineValue('- 4512')).toEqual({ label: null, value: '4512' })
    expect(lineValue('   ')).toBeNull()
  })
})
