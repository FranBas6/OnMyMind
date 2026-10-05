import { describe, expect, it } from 'vitest'

import { confirmsDeletion, deleteSummary } from './account'

const text = (counts?: { lists: number; items: number }) =>
  deleteSummary(counts)
    .map((segment) => (segment.strong ? `**${segment.text}**` : segment.text))
    .join('')

describe('lo que se borra con la cuenta (diseño 18, P9)', () => {
  it('con sus números en negrita', () => {
    expect(text({ lists: 6, items: 214 })).toBe(
      'Se borran tus **6 listas** y las **214 cosas** que hay dentro, con sus fotos, enlaces, precios y avisos, en todos tus dispositivos. No hay vuelta atrás.',
    )
  })

  it('en singular, sin listas, sin cosas o sin nada', () => {
    expect(text({ lists: 1, items: 1 })).toBe(
      'Se borran tu **1 lista** y la **1 cosa** que hay dentro, con sus fotos, enlaces, precios y avisos, en todos tus dispositivos. No hay vuelta atrás.',
    )
    expect(text({ lists: 0, items: 3 })).toBe(
      'Se borran las **3 cosas** que tienes, con sus fotos, enlaces, precios y avisos, en todos tus dispositivos. No hay vuelta atrás.',
    )
    expect(text({ lists: 2, items: 0 })).toBe(
      'Se borran tus **2 listas**, en todos tus dispositivos. No hay vuelta atrás.',
    )
    expect(text({ lists: 0, items: 0 })).toBe(
      'Se borra tu cuenta, en todos tus dispositivos. No hay vuelta atrás.',
    )
  })

  it('mientras se cuentan, sin números', () => {
    expect(text()).toBe(
      'Se borran tus listas y todo lo que hay dentro, con sus fotos, enlaces, precios y avisos, en todos tus dispositivos. No hay vuelta atrás.',
    )
  })

  it('se confirma con «borrar», sin importar mayúsculas ni espacios', () => {
    expect(confirmsDeletion('borrar')).toBe(true)
    expect(confirmsDeletion('  Borrar ')).toBe(true)
    expect(confirmsDeletion('borr')).toBe(false)
    expect(confirmsDeletion('borrar mi cuenta')).toBe(false)
  })
})
