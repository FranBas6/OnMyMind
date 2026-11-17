import { describe, expect, it } from 'vitest'

import { enterInBullet, withBullets } from './bullets'
import { noteBody, noteText, splitNoteText } from './noteText'

describe('splitNoteText: la primera línea es el título', () => {
  it('una línea es solo el título', () => {
    expect(splitNoteText('Código del portal de Marta: 4821')).toEqual({
      title: 'Código del portal de Marta: 4821',
      notes: null,
    })
  })

  it('el resto va a las notas, con sus viñetas y saltos', () => {
    expect(splitNoteText('Qué ver en Lisboa\n• Castillo\n\n• Belém\n')).toEqual({
      title: 'Qué ver en Lisboa',
      notes: '• Castillo\n\n• Belém',
    })
  })

  it('las líneas en blanco del principio no cuentan', () => {
    expect(splitNoteText('\n  \nVuelo\nK7Q2MX')).toEqual({ title: 'Vuelo', notes: 'K7Q2MX' })
  })

  it('sin nada escrito, no hay nota', () => {
    expect(splitNoteText('')).toBeNull()
    expect(splitNoteText('  \n\n ')).toBeNull()
  })

  it('una primera línea que no cabe se corta en una palabra y lo demás empieza las notas', () => {
    const long = `${'palabra '.repeat(40)}final`
    const split = splitNoteText(`${long}\nsegunda`)
    expect(split?.title.length).toBeLessThanOrEqual(300)
    expect(split?.title.endsWith('palabra')).toBe(true)
    expect(split?.notes?.endsWith('final\nsegunda')).toBe(true)
  })
})

describe('noteText y noteBody: el texto entero, como se escribe', () => {
  it('junta la primera línea y el resto', () => {
    expect(noteText({ title: 'Vuelo a Lisboa', notes: 'K7Q2MX\nT4' })).toBe(
      'Vuelo a Lisboa\nK7Q2MX\nT4',
    )
    expect(noteText({ title: 'Libro que dijo Lucía', notes: null })).toBe('Libro que dijo Lucía')
  })

  it('ida y vuelta: partir y juntar deja el mismo texto', () => {
    const text = 'Ideas para el cumple de Ana\n• Cena en el italiano\n• Libro de fotos'
    const split = splitNoteText(text)
    expect(split && noteText(split)).toBe(text)
  })

  it('lo compartido antes de la 5.4 no repite la primera línea (4.7)', () => {
    expect(noteBody({ title: 'Receta', notes: 'Receta\n2 huevos' })).toBe('2 huevos')
    // El título se guardaba con los espacios juntados; las notas, tal cual.
    expect(noteBody({ title: 'Receta rica', notes: 'Receta   rica\n2 huevos' })).toBe('2 huevos')
    const line = 'x'.repeat(320)
    expect(noteBody({ title: line.slice(0, 300), notes: line })).toBe('x'.repeat(20))
  })

  it('una segunda línea que empieza como la primera no se toca', () => {
    expect(noteBody({ title: 'Comprar', notes: 'Comprar pan' })).toBe('Comprar pan')
  })
})

describe('viñetas', () => {
  it('«- » y «* » al principio de una línea pasan a «• »', () => {
    expect(withBullets('Lista\n- uno\n  * dos\n-3 grados')).toBe('Lista\n• uno\n  • dos\n-3 grados')
  })

  it('Intro en una viñeta sigue con otra', () => {
    const value = 'Lisboa\n• Castillo'
    expect(enterInBullet({ value, start: value.length, end: value.length })).toEqual({
      value: 'Lisboa\n• Castillo\n• ',
      start: value.length + 3,
      end: value.length + 3,
    })
  })

  it('Intro en una viñeta vacía la termina', () => {
    const value = 'Lisboa\n• Castillo\n• '
    expect(enterInBullet({ value, start: value.length, end: value.length })).toEqual({
      value: 'Lisboa\n• Castillo\n',
      start: 18,
      end: 18,
    })
  })

  it('fuera de una viñeta, Intro hace lo de siempre', () => {
    const value = 'Lisboa\nCastillo'
    expect(enterInBullet({ value, start: value.length, end: value.length })).toBeNull()
    expect(enterInBullet({ value: '• uno', start: 0, end: 0 })).toBeNull()
  })
})
