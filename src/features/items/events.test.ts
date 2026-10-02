import { describe, expect, it } from 'vitest'

import {
  dayLabel,
  eventWhen,
  followingLabel,
  groupEvents,
  longDay,
  monthLabel,
  parseTime,
  pastLabel,
  recurrenceHint,
  shortDay,
  isEarlierToday,
  isPastEvent,
  isRecurrence,
  nextOccurrence,
  occurrence,
  occursOn,
} from './events'

// Martes 22 de septiembre de 2026, a mediodía (hora del dispositivo).
const now = new Date(2026, 8, 22, 12, 0)
const at = (month: number, day: number, hours = 0, minutes = 0, year = 2026) =>
  new Date(year, month - 1, day, hours, minutes)

function event(
  title: string,
  dueAt: Date | null,
  { allDay = false, recurrence = null as string | null, position = 1000 } = {},
) {
  return { title, dueAt, allDay, recurrence, position }
}

describe('isPastEvent', () => {
  it('uno de hoy no pasa hasta medianoche, aunque ya sea su hora', () => {
    expect(isPastEvent(event('Dentista', at(9, 22, 10)), now)).toBe(false)
    expect(isPastEvent(event('Dentista', at(9, 22, 10)), at(9, 23, 0, 1))).toBe(true)
  })

  it('el de ayer ya pasó; el de mañana, no', () => {
    expect(isPastEvent(event('Concierto', at(9, 21, 21)), now)).toBe(true)
    expect(isPastEvent(event('Revisión', at(9, 23, 9)), now)).toBe(false)
  })

  it('uno que se repite y uno sin fecha nunca pasan', () => {
    expect(isPastEvent(event('Cena', at(1, 5, 19, 30), { recurrence: 'monthly' }), now)).toBe(false)
    expect(isPastEvent(event('Algún día', null), now)).toBe(false)
  })
})

describe('isEarlierToday', () => {
  it('atenúa uno de hoy cuya hora ya pasó, no el de todo el día ni el de más tarde', () => {
    expect(isEarlierToday(event('Dentista', at(9, 22, 10)), now)).toBe(true)
    expect(isEarlierToday(event('Cena', at(9, 22, 19, 30)), now)).toBe(false)
    expect(isEarlierToday(event('Cumple', at(9, 22), { allDay: true }), now)).toBe(false)
  })

  it('también la vez de hoy de uno que se repite', () => {
    expect(isEarlierToday(event('Café', at(9, 1, 8), { recurrence: 'daily' }), now)).toBe(true)
  })
})

describe('nextOccurrence', () => {
  it('cada día, semana, mes y año, a la misma hora', () => {
    expect(nextOccurrence(at(9, 1, 8), 'daily', now)).toEqual(at(9, 22, 8))
    // Martes 8: los martes.
    expect(nextOccurrence(at(9, 8, 18), 'weekly', now)).toEqual(at(9, 22, 18))
    expect(nextOccurrence(at(9, 10, 18), 'weekly', now)).toEqual(at(9, 24, 18))
    expect(nextOccurrence(at(1, 5, 19, 30), 'monthly', now)).toEqual(at(10, 5, 19, 30))
    expect(nextOccurrence(at(3, 14, 0, 0, 1990), 'yearly', now)).toEqual(at(3, 14, 0, 0, 2027))
  })

  it('la vez de hoy cuenta aunque su hora ya haya pasado (sigue hoy hasta medianoche)', () => {
    expect(nextOccurrence(at(8, 22, 10), 'monthly', now)).toEqual(at(9, 22, 10))
  })

  it('con el cambio de hora sigue a la misma hora del reloj', () => {
    // El 25 de octubre se atrasa la hora en España: la cena de los martes sigue a las 19:30.
    const next = nextOccurrence(at(10, 20, 19, 30), 'weekly', at(10, 26))
    expect([next.getDate(), next.getHours(), next.getMinutes()]).toEqual([27, 19, 30])
  })

  it('si aún no ha empezado, es la primera', () => {
    expect(nextOccurrence(at(12, 24, 21), 'yearly', now)).toEqual(at(12, 24, 21))
  })

  it('el 31 de cada mes es el último día en los meses cortos, y vuelve a ser 31', () => {
    const first = at(1, 31, 9)
    expect(nextOccurrence(first, 'monthly', at(9, 2))).toEqual(at(9, 30, 9))
    expect(nextOccurrence(first, 'monthly', at(10, 1))).toEqual(at(10, 31, 9))
  })

  it('el 29 de febrero pasa al 28 los años que no son bisiestos', () => {
    const first = at(2, 29, 0, 0, 2024)
    expect(nextOccurrence(first, 'yearly', at(1, 10, 0, 0, 2027))).toEqual(at(2, 28, 0, 0, 2027))
    expect(nextOccurrence(first, 'yearly', at(3, 1, 0, 0, 2027))).toEqual(at(2, 29, 0, 0, 2028))
  })
})

describe('occurrence y occursOn', () => {
  it('la fecha de un evento, la siguiente de uno que se repite o ninguna', () => {
    expect(occurrence(event('Dentista', at(9, 25, 10)), now)).toEqual(at(9, 25, 10))
    expect(occurrence(event('Cena', at(1, 5, 19, 30), { recurrence: 'monthly' }), now)).toEqual(
      at(10, 5, 19, 30),
    )
    expect(occurrence(event('Algún día', null), now)).toBeNull()
  })

  it('si toca un día, también lo que se repite, pero no antes de empezar', () => {
    const cena = event('Cena', at(1, 5, 19, 30), { recurrence: 'monthly' })
    expect(occursOn(cena, at(10, 5))).toBe(true)
    expect(occursOn(cena, at(10, 6))).toBe(false)
    expect(occursOn(cena, at(12, 5, 0, 0, 2025))).toBe(false)
    expect(occursOn(event('Dentista', at(9, 25, 10)), at(9, 25, 23, 59))).toBe(true)
    expect(occursOn(event('Algún día', null), now)).toBe(false)
  })

  it('reconoce solo las repeticiones que hay', () => {
    expect(isRecurrence('weekly')).toBe(true)
    expect(isRecurrence('custom')).toBe(false)
    expect(isRecurrence(null)).toBe(false)
  })
})

describe('dayLabel', () => {
  it('como en la pantalla 10 (con los días de 2026)', () => {
    expect(dayLabel(at(9, 22, 10), now)).toBe('Hoy · Martes 22')
    expect(dayLabel(at(9, 23), now)).toBe('Mañana · Miércoles 23')
    expect(dayLabel(at(9, 25), now)).toBe('Viernes 25')
    expect(dayLabel(at(10, 4), now)).toBe('Domingo 4 oct')
    expect(dayLabel(at(1, 9, 0, 0, 2027), now)).toBe('Sábado 9 ene 2027')
  })
})

describe('groupEvents', () => {
  it('«Sin fecha» arriba y cada día por orden; dentro, el de todo el día y luego por hora', () => {
    const groups = groupEvents(
      [
        event('Revisión del coche', at(9, 25, 9)),
        event('Cena con Marta', at(8, 22, 19, 30), { recurrence: 'monthly' }),
        event('Dentista', at(9, 22, 10)),
        event('Cumple de Pablo', at(10, 4), { allDay: true, recurrence: 'yearly' }),
        event('Mudanza', null, { position: 2000 }),
        event('Comprar regalo', null, { position: 1000 }),
        event('Fiesta del barrio', at(9, 22), { allDay: true }),
      ],
      now,
    )
    expect(groups.map((group) => [group.label, group.items.map((item) => item.title)])).toEqual([
      ['Sin fecha', ['Comprar regalo', 'Mudanza']],
      ['Hoy · Martes 22', ['Fiesta del barrio', 'Dentista', 'Cena con Marta']],
      ['Viernes 25', ['Revisión del coche']],
      ['Domingo 4 oct', ['Cumple de Pablo']],
    ])
    expect(groups[1]?.key).toBe('2026-09-22')
  })

  it('sin eventos, sin grupos', () => {
    expect(groupEvents([], now)).toEqual([])
  })
})

describe('grupos por mes y «Pasados»', () => {
  it('pasadas cuatro semanas, por meses; con otro año, el año', () => {
    const groups = groupEvents(
      [
        event('Boda de Lucía y Pablo', at(11, 15), { allDay: true }),
        event('Cena de Navidad', at(12, 19, 21)),
        event('Cumpleaños de papá', at(1, 14, 0, 0, 2027), { allDay: true }),
        event('Teatro', at(10, 4, 20, 30)),
      ],
      now,
    )
    expect(groups.map((group) => [group.label, group.byMonth])).toEqual([
      ['Domingo 4 oct', false],
      ['Noviembre', true],
      ['Diciembre', true],
      ['Enero 2027', true],
    ])
  })

  it('en «Pasados», lo más reciente arriba; lo de hace más de seis días, por meses', () => {
    const groups = groupEvents(
      [event('Concierto', at(9, 12, 21, 30)), event('Dentista', at(9, 22, 10))],
      now,
      { newestFirst: true },
    )
    expect(groups.map((group) => group.label)).toEqual(['Hoy · Martes 22', 'Septiembre'])
    expect(monthLabel(at(9, 12), now)).toBe('Septiembre')
  })
})

describe('textos de la fila y de la ficha', () => {
  it('el día corto: «Hoy», «Mañana», «Jue 24», «Mar 6 oct»', () => {
    expect(shortDay(at(9, 22), now)).toBe('Hoy')
    expect(shortDay(at(9, 23), now)).toBe('Mañana')
    expect(shortDay(at(9, 24), now)).toBe('Jue 24')
    expect(shortDay(at(10, 6), now)).toBe('Mar 6 oct')
    expect(shortDay(at(1, 5, 0, 0, 2027), now)).toBe('Mar 5 ene 2027')
  })

  it('en una lista mixta: el día y la hora, solo el día o «Sin fecha»', () => {
    expect(eventWhen(event('Reunión', at(9, 24, 11)), now)).toBe('Jue 24 · 11:00')
    expect(eventWhen(event('Cierre', at(9, 30), { allDay: true }), now)).toBe('Mié 30')
    expect(eventWhen(event('Afterwork', null), now)).toBe('Sin fecha')
    expect(eventWhen(event('Comité', at(8, 6, 9), { recurrence: 'monthly' }), now)).toBe(
      'Mar 6 oct · 09:00',
    )
  })

  it('la ficha: el día largo, la siguiente vez y lo que ya pasó', () => {
    expect(longDay(at(9, 25), now)).toBe('Viernes 25 sep')
    expect(longDay(at(1, 4, 0, 0, 2027), now)).toBe('Lunes 4 ene 2027')
    expect(followingLabel(event('Cena', at(9, 25, 21), { recurrence: 'monthly' }), now)).toBe(
      'Siguiente: domingo 25 oct',
    )
    expect(
      followingLabel(event('Cumple', at(9, 23), { allDay: true, recurrence: 'yearly' }), now),
    ).toBe('Siguiente: 23 sep de 2027')
    expect(followingLabel(event('Dentista', at(9, 25, 10)), now)).toBeNull()
    expect(pastLabel(event('Concierto', at(9, 12, 21, 30)), now)).toBe(
      'Fue el sábado 12 a las 21:30.',
    )
    expect(pastLabel(event('Feria', at(8, 2), { allDay: true }), now)).toBe(
      'Fue el domingo 2 de agosto.',
    )
  })

  it('lo que significa cada repetición para ese día', () => {
    const day = at(9, 24)
    expect(recurrenceHint('daily', day)).toBeNull()
    expect(recurrenceHint('weekly', day)).toBe('los jueves')
    expect(recurrenceHint('weekly', at(9, 26))).toBe('los sábados')
    expect(recurrenceHint('monthly', day)).toBe('el día 24')
    expect(recurrenceHint('yearly', day)).toBe('el 24 de septiembre')
  })
})

describe('parseTime', () => {
  it('acepta «21», «2130», «21:30», «9.30» y «9h»', () => {
    expect(parseTime('21')).toEqual({ hours: 21, minutes: 0 })
    expect(parseTime('2130')).toEqual({ hours: 21, minutes: 30 })
    expect(parseTime(' 21:30 ')).toEqual({ hours: 21, minutes: 30 })
    expect(parseTime('930')).toEqual({ hours: 9, minutes: 30 })
    expect(parseTime('9.30')).toEqual({ hours: 9, minutes: 30 })
    expect(parseTime('9h')).toEqual({ hours: 9, minutes: 0 })
  })

  it('lo que no es una hora, no', () => {
    for (const text of ['', '25', '21:75', 'mañana', '12345']) expect(parseTime(text)).toBeNull()
  })
})
