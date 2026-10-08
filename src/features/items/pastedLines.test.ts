import { describe, expect, it } from 'vitest'

import {
  linesToSave,
  PASTED_LINES_MAX,
  pastedLines,
  pastedLinesHeading,
  pastedLinesSaved,
  pastedRows,
} from './pastedLines'

const titles = (text: string) => pastedLines(text)?.lines.map((line) => line.title)

describe('pastedLines', () => {
  it('una lista de WhatsApp: una cosa por línea, sin viñetas ni vacías (B1)', () => {
    expect(titles('- Leche\n- Huevos x12\n\n- Pan de molde\n')).toEqual([
      'Leche',
      'Huevos x12',
      'Pan de molde',
    ])
    expect(titles('• Pilas AA\r\n•Bombillas E27\r\n· Cinta americana')).toEqual([
      'Pilas AA',
      'Bombillas E27',
      'Cinta americana',
    ])
  })

  it('quita números y casillas; «[x] » entra hecha', () => {
    expect(
      pastedLines('1. Leche\n2) Tomates\n- [ ] Aceite\n- [x] Detergente\n✅ Sal')?.lines,
    ).toEqual([
      { title: 'Leche', done: false },
      { title: 'Tomates', done: false },
      { title: 'Aceite', done: false },
      { title: 'Detergente', done: true },
      { title: 'Sal', done: true },
    ])
  })

  it('no confunde con viñetas lo que no lo es', () => {
    expect(titles('1.5 kg de arroz\n*Leche* entera\n-20 % en todo')).toEqual([
      '1.5 kg de arroz',
      '*Leche* entera',
      '-20 % en todo',
    ])
  })

  it('se ofrece con tres líneas, o con dos si llevan viñeta (B7)', () => {
    expect(pastedLines('Comprar pilas AA\n')).toBeNull()
    expect(pastedLines('Comprar pilas AA')).toBeNull()
    expect(pastedLines('Hola,\nmañana te llamo')).toBeNull()
    expect(titles('- Pilas\n- Bombillas')).toEqual(['Pilas', 'Bombillas'])
    expect(titles('Pilas\nBombillas\nCinta')).toEqual(['Pilas', 'Bombillas', 'Cinta'])
    // Las vacías no cuentan.
    expect(pastedLines('Pilas\n\n\nBombillas\n')).toBeNull()
  })

  it('sin repetidas seguidas', () => {
    expect(titles('Leche\nleche\nPan\nLeche')).toEqual(['Leche', 'Pan', 'Leche'])
  })

  it('como mucho 50, y dice cuántas no caben', () => {
    const many = Array.from({ length: 62 }, (_, index) => `Cosa ${String(index + 1)}`).join('\n')
    const result = pastedLines(many)
    expect(result?.lines).toHaveLength(PASTED_LINES_MAX)
    expect(result?.lines.at(-1)?.title).toBe('Cosa 50')
    expect(result?.overflow).toBe(12)
  })

  it('cada línea, como mucho del largo de un título', () => {
    const long = 'x'.repeat(400)
    expect(pastedLines(`${long}\nb\nc`)?.lines[0]?.title).toHaveLength(300)
  })
})

describe('textos', () => {
  it('cabecera y aviso', () => {
    expect(pastedLinesHeading(7)).toBe('7 cosas, una por línea')
    expect(pastedLinesHeading(1)).toBe('1 cosa, una por línea')
    expect(pastedLinesSaved(6, 'Compras')).toBe('6 cosas en Compras')
    expect(pastedLinesSaved(1, 'Casa')).toBe('1 cosa en Casa')
  })
})

describe('linesToSave', () => {
  const rows = () => {
    const list = pastedLines(
      'Llamar al fontanero mañana 10h\nBajar el reciclaje\n[x] Regar\nmañana',
    )
    if (!list) throw new Error('sin líneas')
    return pastedRows(list)
  }

  it('en tareas, la fecha de cada línea; sin las quitadas', () => {
    const [first, second, third, fourth] = rows()
    if (!first || !second || !third || !fourth) throw new Error('faltan líneas')
    const saved = linesToSave([first, { ...second, removed: true }, third, fourth], 'task')
    expect(saved.map((line) => [line.title, line.done, line.written !== null])).toEqual([
      ['Llamar al fontanero', false, true],
      ['Regar', true, false],
      // Una línea que solo era la fecha se queda como está.
      ['mañana', false, false],
    ])
    expect(saved[0]?.written?.reminderOffsetMinutes).toBe(-600)
  })

  it('deshecha la fecha, el texto tal cual; en compras no se leen', () => {
    const [first] = rows()
    if (!first) throw new Error('falta la línea')
    expect(linesToSave([{ ...first, dateUndone: true }], 'task')[0]).toEqual({
      title: 'Llamar al fontanero mañana 10h',
      done: false,
      written: null,
    })
    expect(linesToSave([first], 'shopping')[0]?.written).toBeNull()
  })
})
