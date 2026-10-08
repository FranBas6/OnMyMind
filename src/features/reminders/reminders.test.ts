import { describe, expect, it } from 'vitest'

import {
  canHaveReminder,
  deviceName,
  optionWhen,
  reminderRowLabel,
  reminderSheetSubtitle,
  repeatingReminderNote,
  isOptionAvailable,
  reminderAt,
  reminderLabel,
  reminderOptions,
  reminderPhrase,
  reminderShape,
} from './reminders'

// Lunes 5 de octubre de 2026, a las 12:00 (hora del dispositivo).
const now = new Date(2026, 9, 5, 12, 0)
const at = (month: number, day: number, hours = 0, minutes = 0, year = 2026) =>
  new Date(year, month - 1, day, hours, minutes)

const event = (dueAt: Date | null, allDay = false, recurrence: string | null = null) => ({
  kind: 'event' as const,
  dueAt,
  allDay,
  recurrence,
})
const task = (dueAt: Date | null) => ({
  kind: 'task' as const,
  dueAt,
  allDay: true,
  recurrence: null,
})

describe('qué avisos admite cada ítem', () => {
  it('solo tareas y eventos', () => {
    expect(canHaveReminder({ kind: 'task' })).toBe(true)
    expect(canHaveReminder({ kind: 'event' })).toBe(true)
    expect(canHaveReminder({ kind: 'shopping' })).toBe(false)
    expect(canHaveReminder({ kind: 'note' })).toBe(false)
  })

  it('con hora, los desfases de la pantalla 12; sin hora, a las 9:00; sin fecha, ninguno', () => {
    const dentista = event(at(10, 8, 10))
    expect(reminderShape(dentista)).toBe('timed')
    expect(reminderOptions(dentista).map((option) => option.label)).toEqual([
      'A la hora',
      '10 minutos antes',
      '30 minutos antes',
      '1 hora antes',
      '1 día antes',
    ])
    expect(reminderShape(task(at(10, 8)))).toBe('dated')
    expect(reminderShape(event(at(10, 8), true))).toBe('dated')
    expect(reminderOptions(task(at(10, 8))).map((option) => option.label)).toEqual([
      'Ese día a las 9:00',
      'El día antes a las 9:00',
    ])
    expect(reminderShape(task(null))).toBe('undated')
    expect(reminderOptions(task(null))).toEqual([])
  })
})

describe('reminderAt (lo mismo que `reminder_time` en la base)', () => {
  it('antes de la hora, o a las 9:00 de ese día o del anterior', () => {
    expect(reminderAt(event(at(10, 8, 10)), 60, now)).toEqual(at(10, 8, 9))
    expect(reminderAt(event(at(10, 8, 10)), 24 * 60, now)).toEqual(at(10, 7, 10))
    expect(reminderAt(task(at(10, 8)), -540, now)).toEqual(at(10, 8, 9))
    expect(reminderAt(task(at(10, 8)), 900, now)).toEqual(at(10, 7, 9))
    expect(reminderAt(task(null), 60, now)).toBeNull()
  })

  it('en la hora del reloj aunque cambie la hora (el 25 de octubre)', () => {
    expect(reminderAt(task(at(10, 25)), -540, now)).toEqual(at(10, 25, 9))
    expect(reminderAt(event(at(10, 26, 10)), 24 * 60, now)).toEqual(at(10, 25, 10))
  })

  it('lo que se repite, en la siguiente vez cuyo aviso no ha pasado', () => {
    // El yoga, los jueves a las 19:00 desde el 3 de septiembre.
    const yoga = event(at(9, 3, 19), false, 'weekly')
    expect(reminderAt(yoga, 60, now)).toEqual(at(10, 8, 18))
    // El 31 de cada mes, también en los cortos.
    expect(reminderAt(event(at(1, 31, 10), false, 'monthly'), 60, now)).toEqual(at(10, 31, 9))
    // El cumpleaños, el día antes a las 9:00.
    const cumple = event(at(11, 12, 0, 0, 2020), true, 'yearly')
    expect(reminderAt(cumple, 900, now)).toEqual(at(11, 11, 9))
    // Hoy a las 12:30 cada día, 1 h antes: el de hoy ya pasó (11:30), así que mañana.
    const daily = event(at(9, 1, 12, 30), false, 'daily')
    expect(reminderAt(daily, 60, now)).toEqual(at(10, 6, 11, 30))
  })

  it('una opción que ya pasó no se ofrece', () => {
    const enDosHoras = event(at(10, 5, 14))
    expect(isOptionAvailable(enDosHoras, 60, now)).toBe(true)
    expect(isOptionAvailable(enDosHoras, 24 * 60, now)).toBe(false)
    expect(isOptionAvailable(task(at(10, 5)), -540, now)).toBe(false)
    expect(isOptionAvailable(task(at(10, 6)), -540, now)).toBe(true)
  })
})

describe('reminderLabel', () => {
  it('el de su opción, o su día y su hora si es personalizado', () => {
    const dentista = event(at(10, 8, 10))
    expect(reminderLabel({ offsetMinutes: 60, remindAt: at(10, 8, 9) }, dentista, now)).toBe(
      '1 hora antes',
    )
    expect(reminderLabel({ offsetMinutes: null, remindAt: at(10, 12, 17) }, task(null), now)).toBe(
      'Lun 12 oct · 17:00',
    )
    expect(
      reminderLabel({ offsetMinutes: null, remindAt: at(1, 4, 9, 30, 2027) }, task(null), now),
    ).toBe('Lun 4 ene 2027 · 09:30')
  })
})

describe('los textos de la ficha y la hoja (diseño 18)', () => {
  const dentista = { ...event(at(10, 8, 10)), title: 'Dentista' }
  const alquiler = { ...task(at(10, 7)), title: 'Pagar el alquiler' }

  it('la fila: la regla y la hora, o el día y la hora si es personalizado', () => {
    expect(reminderRowLabel({ offsetMinutes: 60, remindAt: at(10, 8, 9) }, dentista, now)).toBe(
      '1 h antes · 09:00',
    )
    expect(reminderRowLabel({ offsetMinutes: -540, remindAt: at(10, 7, 9) }, alquiler, now)).toBe(
      'Ese día · 9:00',
    )
    expect(reminderRowLabel({ offsetMinutes: 900, remindAt: at(10, 6, 9) }, alquiler, now)).toBe(
      'El día antes · 9:00',
    )
    // Un desfase que ya no encaja (el evento pasó a todo el día) dice su momento.
    expect(
      reminderRowLabel(
        { offsetMinutes: 60, remindAt: at(10, 7, 23) },
        { ...dentista, allDay: true },
        now,
      ),
    ).toBe('Mié 7 oct · 23:00')
  })

  it('a la derecha de cada opción, cuándo sonaría; lo que ya pasó, nada', () => {
    expect(optionWhen(dentista, 10, now)).toBe('09:50')
    expect(optionWhen(dentista, 24 * 60, now)).toBe('Mié 7 · 10:00')
    expect(optionWhen(alquiler, -540, now)).toBe('Mié 7 oct')
    expect(optionWhen(alquiler, 900, now)).toBe('Mar 6 oct')
    expect(optionWhen(event(at(10, 5, 14)), 24 * 60, now)).toBeNull()
  })

  it('la línea bajo «Aviso»', () => {
    expect(reminderSheetSubtitle(dentista, now)).toBe('Dentista · jueves 8 oct a las 10:00')
    expect(reminderSheetSubtitle({ ...event(at(10, 5, 14, 30)), title: 'Banco' }, now)).toBe(
      'Banco · hoy a las 14:30',
    )
    expect(reminderSheetSubtitle(alquiler, now)).toBe(
      'Pagar el alquiler · vence el miércoles 7 oct',
    )
    expect(reminderSheetSubtitle({ ...task(at(10, 6)), title: 'Luz' }, now)).toBe(
      'Luz · vence mañana',
    )
    expect(reminderSheetSubtitle({ ...task(null), title: 'Llamar al seguro' }, now)).toBe(
      'Llamar al seguro · sin fecha',
    )
  })

  it('lo que se repite dice el próximo aviso', () => {
    const cumple = event(at(11, 12, 0, 0, 2020), true, 'yearly')
    expect(
      repeatingReminderNote({ offsetMinutes: 900, remindAt: at(11, 11, 9) }, cumple, now),
    ).toBe('Avisa cada año. El próximo, el miércoles 11 nov a las 9:00.')
    expect(
      repeatingReminderNote({ offsetMinutes: 60, remindAt: at(10, 8, 9) }, dentista, now),
    ).toBeNull()
  })

  it('el aviso en una frase', () => {
    expect(reminderPhrase({ offsetMinutes: 60, remindAt: at(10, 8, 9) }, dentista)).toBe(
      '1 h antes',
    )
    expect(reminderPhrase({ offsetMinutes: -540, remindAt: at(10, 7, 9) }, alquiler)).toBe(
      'ese día a las 9:00',
    )
    expect(reminderPhrase({ offsetMinutes: null, remindAt: at(10, 12, 17) }, task(null))).toBe(
      'el lunes 12 oct a las 17:00',
    )
  })

  it('el nombre del dispositivo', () => {
    expect(deviceName('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)', 5)).toBe(
      'este iPhone',
    )
    expect(deviceName('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 5)).toBe('este iPad')
    expect(deviceName('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 0)).toBe('este navegador')
    expect(deviceName('Mozilla/5.0 (Linux; Android 14; Pixel 8) Mobile', 5)).toBe('este móvil')
  })
})
