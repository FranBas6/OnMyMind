import { describe, expect, it } from 'vitest'

import { notesExcerpt } from './notes'

describe('el principio de las notas en la fila', () => {
  it('en una línea, sin saltos ni espacios de más', () => {
    expect(notesExcerpt('  Medir el hueco\n\ndel frigo   antes ')).toBe(
      'Medir el hueco del frigo antes',
    )
  })

  it('sin notas, nada', () => {
    expect(notesExcerpt(null)).toBeNull()
    expect(notesExcerpt(' \n ')).toBeNull()
  })

  it('de un texto largo, solo el principio', () => {
    expect(notesExcerpt('a'.repeat(500))).toHaveLength(200)
  })
})
