import { describe, expect, it } from 'vitest'

import { parseNaturalDate } from '@/lib/naturalDate'

import { readsWrittenDates, writtenDateFields, writtenDateLabel } from './writtenDate'

/** Miércoles 7 de octubre de 2026 a las 12:00. */
const NOW = new Date(2026, 9, 7, 12, 0)

function parsed(text: string) {
  const result = parseNaturalDate(text, NOW)
  if (!result) throw new Error(`no se entiende «${text}»`)
  return result
}

describe('qué se guarda de una fecha escrita (3.5)', () => {
  it('un evento, con su hora o de todo el día', () => {
    expect(writtenDateFields(parsed('Cena con Marta el viernes 21h'), 'event')).toEqual({
      due: { at: new Date(2026, 9, 9, 21, 0), allDay: false },
      reminderOffsetMinutes: null,
    })
    expect(writtenDateFields(parsed('Feria el viernes'), 'event')).toEqual({
      due: { at: new Date(2026, 9, 9), allDay: true },
      reminderOffsetMinutes: null,
    })
  })

  it('una tarea, su día; y si se dijo hora, el aviso a esa hora (decisión de Fran)', () => {
    expect(writtenDateFields(parsed('Llamar al seguro mañana'), 'task')).toEqual({
      due: { at: new Date(2026, 9, 8), allDay: true },
      reminderOffsetMinutes: null,
    })
    expect(writtenDateFields(parsed('Llamar al seguro mañana 10h'), 'task')).toEqual({
      due: { at: new Date(2026, 9, 8), allDay: true },
      reminderOffsetMinutes: -600,
    })
    expect(writtenDateFields(parsed('Tender en 2 horas'), 'task')).toEqual({
      due: { at: new Date(2026, 9, 7), allDay: true },
      reminderOffsetMinutes: -14 * 60,
    })
  })

  it('compras, notas y sublistas no llevan fecha', () => {
    expect(writtenDateFields(parsed('Leche mañana'), 'shopping')).toBeNull()
    expect(writtenDateFields(parsed('Leche mañana'), 'note')).toBeNull()
    expect(
      ['task', 'event', 'shopping', 'note', 'sublist'].map((kind) =>
        readsWrittenDates(kind as 'task'),
      ),
    ).toEqual([true, true, false, false, false])
  })
})

describe('lo que dice la pastilla (diseño 21, A1–A3)', () => {
  const label = (text: string, kind: 'task' | 'event') => {
    const written = writtenDateFields(parsed(text), kind)
    return written && writtenDateLabel(written, kind, NOW)
  }

  it('el evento: el día y la hora', () => {
    expect(label('Cena con Marta el viernes 21h', 'event')).toEqual({
      day: 'Vie 9 oct · 21:00',
      reminder: null,
    })
    expect(label('Feria el viernes', 'event')).toEqual({ day: 'Vie 9 oct', reminder: null })
    expect(label('Feria 3 dic 2027', 'event')?.day).toBe('Vie 3 dic 2027')
  })

  it('la tarea: cuándo vence y, aparte, el aviso', () => {
    expect(label('Llamar al seguro mañana', 'task')).toEqual({
      day: 'Vence jue 8 oct',
      reminder: null,
    })
    expect(label('Llamar al seguro mañana 10h', 'task')).toEqual({
      day: 'Vence jue 8',
      reminder: 'Aviso 10:00',
    })
    expect(label('Llamar al seguro mañana a las 9:05', 'task')?.reminder).toBe('Aviso 9:05')
  })
})
