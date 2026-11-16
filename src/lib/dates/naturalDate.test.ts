import { describe, expect, it } from 'vitest'

import { parseNaturalDate } from './naturalDate'

/** Miércoles 7 de octubre de 2026 a las 12:00 (hora local). */
const NOW = new Date(2026, 9, 7, 12, 0)

/** Un día de octubre de 2026 (u otro mes), a esa hora. */
const oct = (day: number, hours = 0, minutes = 0) => new Date(2026, 9, day, hours, minutes)

function parse(text: string, now = NOW) {
  return parseNaturalDate(text, now)
}

describe('fechas escritas: el día (3.5)', () => {
  it.each([
    ['Llamar al seguro hoy', 'Llamar al seguro', oct(7)],
    ['Llamar al seguro mañana', 'Llamar al seguro', oct(8)],
    ['Llamar al seguro manana', 'Llamar al seguro', oct(8)],
    ['Llamar al seguro pasado mañana', 'Llamar al seguro', oct(9)],
    ['Cena con Marta el viernes', 'Cena con Marta', oct(9)],
    ['Cena con Marta viernes', 'Cena con Marta', oct(9)],
    ['Dentista el próximo lunes', 'Dentista', oct(12)],
    ['Dentista el lunes que viene', 'Dentista', oct(12)],
    ['Reunión este jueves', 'Reunión', oct(8)],
    ['Partido el sábado', 'Partido', oct(10)],
    ['Partido el sabado', 'Partido', oct(10)],
    ['Pagar el alquiler el día 15', 'Pagar el alquiler', oct(15)],
    ['Pagar el alquiler el 15', 'Pagar el alquiler', oct(15)],
    ['Revisión 20 oct', 'Revisión', oct(20)],
    ['Revisión 20 de octubre', 'Revisión', oct(20)],
    ['Revisión el 20 de octubre', 'Revisión', oct(20)],
    ['Revisión 20 oct.', 'Revisión', oct(20)],
    ['ITV 3 de diciembre', 'ITV', new Date(2026, 11, 3)],
    ['ITV 3 dic 2027', 'ITV', new Date(2027, 11, 3)],
    ['ITV 3 de diciembre de 2027', 'ITV', new Date(2027, 11, 3)],
    ['Vacunas 20/10', 'Vacunas', oct(20)],
    ['Vacunas 20/10/2027', 'Vacunas', new Date(2027, 9, 20)],
    ['Vacunas 20/10/27', 'Vacunas', new Date(2027, 9, 20)],
    ['Renovar DNI en 3 días', 'Renovar DNI', oct(10)],
    ['Renovar DNI en 2 semanas', 'Renovar DNI', oct(21)],
    ['Renovar DNI en un mes', 'Renovar DNI', new Date(2026, 10, 7)],
    ['Renovar DNI dentro de 1 semana', 'Renovar DNI', oct(14)],
  ])('«%s» es «%s» ese día, todo el día', (text, title, date) => {
    expect(parse(text)).toEqual(expect.objectContaining({ title, date, hasTime: false }))
  })

  it('la fecha delante: el título empieza con mayúscula', () => {
    expect(parse('Mañana llamar al seguro')).toMatchObject({
      title: 'Llamar al seguro',
      date: oct(8),
    })
    expect(parse('mañana llamar al seguro')?.title).toBe('llamar al seguro')
  })

  it('dice qué trozos entendió, como estaban escritos', () => {
    expect(parse('Cena con Marta el Viernes a las 21:30')?.fragments).toEqual([
      'el Viernes',
      'a las 21:30',
    ])
  })
})

describe('fechas escritas: la hora', () => {
  it.each([
    ['Cena con Marta el viernes 21h', 'Cena con Marta', oct(9, 21)],
    ['Cena con Marta el viernes a las 21h', 'Cena con Marta', oct(9, 21)],
    ['Cena con Marta el viernes a las 21', 'Cena con Marta', oct(9, 21)],
    ['Cena con Marta el viernes a las 21:30', 'Cena con Marta', oct(9, 21, 30)],
    ['Cena con Marta el viernes 21:30', 'Cena con Marta', oct(9, 21, 30)],
    ['Cena con Marta el viernes 21 h', 'Cena con Marta', oct(9, 21)],
    ['Llamar al seguro mañana 10h', 'Llamar al seguro', oct(8, 10)],
    ['Llamar al seguro mañana a las 10 de la mañana', 'Llamar al seguro', oct(8, 10)],
    ['Llamar al seguro mañana por la mañana', 'Llamar al seguro', oct(8, 9)],
    ['Llamar al seguro mañana por la tarde', 'Llamar al seguro', oct(8, 17)],
    ['Llamar al seguro mañana a mediodía', 'Llamar al seguro', oct(8, 12)],
    ['Café con Ana el lunes 8 de la tarde', 'Café con Ana', oct(12, 20)],
    ['Café con Ana el lunes a las 5', 'Café con Ana', oct(12, 17)],
    ['Café con Ana el lunes a la 1', 'Café con Ana', oct(12, 13)],
    ['Café con Ana el lunes a las 7', 'Café con Ana', oct(12, 7)],
    ['Café con Ana el lunes a las 5 de la mañana', 'Café con Ana', oct(12, 5)],
    ['Vuelo el lunes 6 de la madrugada', 'Vuelo', oct(12, 6)],
    ['Concierto el sábado a las 11 de la noche', 'Concierto', oct(10, 23)],
    ['Pagar el alquiler el 15 a las 9', 'Pagar el alquiler', oct(15, 9)],
    ['Pagar el alquiler el 15 9h', 'Pagar el alquiler', oct(15, 9)],
    ['Revisión 20 oct 10:15', 'Revisión', oct(20, 10, 15)],
  ])('«%s» es «%s» a esa hora', (text, title, date) => {
    expect(parse(text)).toEqual(expect.objectContaining({ title, date, hasTime: true }))
  })

  it('una hora sola: hoy si aún no ha pasado; si no, mañana', () => {
    expect(parse('Llamar a Juan 18h')).toMatchObject({ title: 'Llamar a Juan', date: oct(7, 18) })
    expect(parse('Llamar a Juan a las 9h')).toMatchObject({ date: oct(8, 9) })
    expect(parse('Llamar a Juan 12:00')).toMatchObject({ date: oct(8, 12) })
  })

  it('esta tarde y esta noche son hoy', () => {
    expect(parse('Película esta noche')).toMatchObject({ title: 'Película', date: oct(7, 21) })
    expect(parse('Recoger el paquete esta tarde')).toMatchObject({ date: oct(7, 17) })
  })

  it('en un rato: desde ahora', () => {
    expect(parse('Sacar la ropa en 2 horas')).toMatchObject({
      title: 'Sacar la ropa',
      date: oct(7, 14),
      hasTime: true,
    })
    expect(parse('Sacar la ropa en media hora')?.date).toEqual(oct(7, 12, 30))
    expect(parse('Sacar la ropa en 20 minutos')?.date).toEqual(oct(7, 12, 20))
    expect(parse('Sacar la ropa en una hora')?.date).toEqual(oct(7, 13))
  })
})

describe('fechas escritas: los casos difíciles', () => {
  it('«el lunes» dicho un lunes es el de la semana que viene', () => {
    const monday = new Date(2026, 9, 12, 9, 0)
    expect(parse('Dentista el lunes', monday)?.date).toEqual(oct(19))
    expect(parse('Dentista hoy', monday)?.date).toEqual(oct(12))
  })

  it('un día del mes que ya pasó es el del mes que viene; hoy cuenta', () => {
    expect(parse('Pagar el día 7')?.date).toEqual(oct(7))
    expect(parse('Pagar el día 3')?.date).toEqual(new Date(2026, 10, 3))
  })

  it('un día que no tiene el mes salta al siguiente que lo tenga', () => {
    const nov = new Date(2026, 10, 15, 10, 0)
    expect(parse('Pagar el día 31', nov)?.date).toEqual(new Date(2026, 11, 31))
  })

  it('una fecha sin año que ya pasó es la del año que viene', () => {
    expect(parse('Cumpleaños de Lucía 3 de marzo')?.date).toEqual(new Date(2027, 2, 3))
    expect(parse('Cumpleaños de Lucía 7 oct')?.date).toEqual(oct(7))
  })

  it('fin de mes y de año', () => {
    const lastDay = new Date(2026, 11, 31, 20, 0)
    expect(parse('Brindar mañana', lastDay)?.date).toEqual(new Date(2027, 0, 1))
    expect(parse('Brindar el viernes', lastDay)?.date).toEqual(new Date(2027, 0, 1))
    expect(parse('Gimnasio en 1 mes', new Date(2026, 0, 31, 9))?.date).toEqual(
      new Date(2026, 1, 28),
    )
  })

  it('el cambio de hora: mañana a las 10 son las 10 de la pared', () => {
    // En España, la noche del 24 al 25 de octubre de 2026 se atrasa la hora.
    const saturday = new Date(2026, 9, 24, 22, 0)
    expect(parse('Desayuno mañana 10h', saturday)?.date).toEqual(new Date(2026, 9, 25, 10, 0))
    expect(parse('Desayuno mañana', saturday)?.date).toEqual(new Date(2026, 9, 25))
    // «En 3 horas» son tres horas de reloj, aunque en medio se repita una.
    const before = new Date(2026, 9, 25, 0, 30)
    const later = parse('Tomar la pastilla en 3 horas', before)?.date
    expect(later && later.getTime() - before.getTime()).toBe(3 * 3600_000)
  })

  it('las fechas que no existen no se entienden: se quedan en el título', () => {
    expect(parse('Cena 31 de septiembre')).toBeNull()
    expect(parse('Cena 30/02')).toBeNull()
    expect(parse('Reloj 25h')).toBeNull()
    expect(parse('Cena el viernes a las 25')).toMatchObject({
      title: 'Cena a las 25',
      hasTime: false,
    })
  })

  it('dos días o dos horas: no se adivina', () => {
    expect(parse('Cambiar la cita del lunes al martes')).toBeNull()
    expect(parse('Turno de 10h a 14h')).toBeNull()
    expect(parse('Mover lo de hoy a mañana')).toBeNull()
  })

  it('solo una fecha, sin nada más: no queda título y no se interpreta', () => {
    expect(parse('mañana')).toBeNull()
    expect(parse('el viernes a las 21h')).toBeNull()
  })

  it('números que no son fechas ni horas', () => {
    expect(parse('Comprar 2 kg de arroz')).toBeNull()
    expect(parse('Pilas AA 4 unidades')).toBeNull()
    expect(parse('Ver el 2 de la saga')).toBeNull()
    expect(parse('Leer el capítulo 3')).toBeNull()
    expect(parse('Pagar 18,30 €')).toBeNull()
    expect(parse('Partido 3-1')).toBeNull()
    expect(parse('Pedir 2x1 hoy')?.title).toBe('Pedir 2x1')
  })

  it('«cada martes y viernes»: se repite, desde mañana (3.6; diseño 21, A4)', () => {
    // Hoy es miércoles 7: la primera, el viernes 9.
    expect(parse('Sacar la basura cada martes y viernes')).toMatchObject({
      title: 'Sacar la basura',
      date: oct(9),
      hasTime: false,
      repeat: { freq: 'WEEKLY', interval: 1, weekdays: ['TU', 'FR'] },
    })
    // Escrito un miércoles, «cada miércoles» empieza el que viene (A8: escrito el martes 6, «desde
    // el 13»).
    expect(parse('Yoga cada miércoles a las 19h')).toMatchObject({
      title: 'Yoga',
      date: oct(14, 19),
      hasTime: true,
      repeat: { weekdays: ['WE'] },
    })
    expect(parse('Gimnasio todos los lunes, miércoles y viernes')?.repeat?.weekdays).toEqual([
      'MO',
      'WE',
      'FR',
    ])
  })

  it('cada día y cada N días, desde mañana', () => {
    expect(parse('Tomar la pastilla cada día a las 9')).toMatchObject({
      title: 'Tomar la pastilla',
      date: oct(8, 9),
      repeat: { freq: 'DAILY', interval: 1 },
    })
    expect(parse('Regar cada 3 días')).toMatchObject({
      title: 'Regar',
      date: oct(8),
      repeat: { freq: 'DAILY', interval: 3 },
    })
    expect(parse('Vitaminas todos los días')?.repeat?.freq).toBe('DAILY')
  })

  it('«cada semana» o «cada mes» a secas no dicen qué día: no se entiende nada', () => {
    expect(parse('Pagar el alquiler cada mes')).toBeNull()
    expect(parse('Limpiar cada 2 semanas el viernes')).toBeNull()
    expect(parse('Revisión cada año')).toBeNull()
  })

  it('una repetición con otro día: no se adivina', () => {
    expect(parse('Yoga cada martes mañana')).toBeNull()
    expect(parse('Yoga cada martes en 2 horas')).toBeNull()
  })

  it('lo que no se repite no lleva repetición', () => {
    expect(parse('Cena el viernes')?.repeat).toBeNull()
  })

  it('dice dónde está cada trozo, para marcarlo en el texto', () => {
    const text = 'Cena con Marta el viernes a las 21h'
    const result = parse(text)
    expect(result?.ranges.map(({ start, end }) => text.slice(start, end))).toEqual([
      'el viernes',
      'a las 21h',
    ])
  })

  it('palabras que contienen un día no son un día', () => {
    expect(parse('Comprar hoyas')).toBeNull()
    expect(parse('Lunesito de Ana')).toBeNull()
    expect(parse('Desayuno de la mañana')).toBeNull()
  })

  it('lo que queda colgando al quitar la fecha se va', () => {
    expect(parse('Entregar el informe para el viernes')?.title).toBe('Entregar el informe')
    expect(parse('Entregar el informe, mañana')?.title).toBe('Entregar el informe')
    expect(parse('Llamar a mamá a las 18h')?.title).toBe('Llamar a mamá')
    expect(parse('Cita en el dentista mañana a las 10')?.title).toBe('Cita en el dentista')
  })

  it('mayúsculas y tildes dan igual', () => {
    expect(parse('Cena MAÑANA A LAS 21H')).toMatchObject({ title: 'Cena', date: oct(8, 21) })
    expect(parse('Reunión el MIERCOLES')?.date).toEqual(oct(14))
    expect(parse('Reunión el miércoles')?.date).toEqual(oct(14))
  })
})
