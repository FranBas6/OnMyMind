import { describe, expect, it } from 'vitest'

import sqlCases from '../../../supabase/tests/recurrence_cases.test.sql?raw'

import { RECURRENCE_CASES, renderSqlCases } from './recurrence.cases'
import {
  firstOccurrence,
  formatRule,
  nextAfterDone,
  occurrenceFrom,
  parseRule,
  presetHint,
  presetOf,
  presetRule,
  ruleLabel,
  ruleShortLabel,
  type Rule,
} from './recurrence'

/** «2026-10-06 19:00» de reloj. */
function at(text: string): Date {
  const [day = '', time = '00:00'] = text.split(' ')
  const [y, m, d] = day.split('-').map(Number)
  const [h, min] = time.split(':').map(Number)
  return new Date(y ?? 0, (m ?? 1) - 1, d, h, min)
}

/** La regla de un texto, o el test falla. */
function rule(text: string): Rule {
  const parsed = parseRule(text)
  if (!parsed) throw new Error(`no se entiende ${text}`)
  return parsed
}

function show(date: Date | null): string {
  if (!date) return 'nunca'
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${String(date.getFullYear())}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

describe('la repetición, con los mismos casos que SQL (3.6)', () => {
  it.each(RECURRENCE_CASES)('$name', ({ first, rule, from, next }) => {
    const parsed = parseRule(rule)
    expect(parsed).not.toBeNull()
    if (!parsed) return
    expect(show(occurrenceFrom(at(first), parsed, at(from)))).toBe(next)
  })

  it('los casos de SQL son estos (si no, `pnpm db:cases` los vuelve a escribir)', () => {
    expect(sqlCases).toBe(renderSqlCases())
  })
})

describe('la regla escrita (RRULE)', () => {
  it('se lee y se escribe igual', () => {
    for (const text of [
      'FREQ=DAILY',
      'FREQ=DAILY;INTERVAL=3',
      'FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,TH',
      'FREQ=MONTHLY;BYDAY=-1FR',
      'FREQ=MONTHLY;BYMONTHDAY=15',
      'FREQ=YEARLY;INTERVAL=2',
    ]) {
      const rule = parseRule(text)
      expect(rule && formatRule(rule)).toBe(text)
    }
  })

  it('los días van de lunes a domingo, en ese orden', () => {
    const rule = parseRule('FREQ=WEEKLY;BYDAY=FR,TU')
    expect(rule && formatRule(rule)).toBe('FREQ=WEEKLY;BYDAY=TU,FR')
  })

  it('lo de antes de la 3.6 se lee como su regla', () => {
    expect(parseRule('monthly')).toMatchObject({ freq: 'MONTHLY', interval: 1 })
  })

  it('lo que no es del subconjunto no se entiende (no se adivina)', () => {
    for (const text of [
      'FREQ=HOURLY',
      'FREQ=DAILY;INTERVAL=0',
      'FREQ=DAILY;BYDAY=MO',
      'FREQ=WEEKLY;BYDAY=1MO',
      'FREQ=MONTHLY;BYDAY=5MO',
      'FREQ=MONTHLY;BYDAY=MO,TU',
      'FREQ=MONTHLY;BYMONTHDAY=32',
      'FREQ=MONTHLY;BYMONTHDAY=15;BYDAY=1MO',
      'FREQ=WEEKLY;COUNT=3',
      'FREQ=WEEKLY;BYDAY=MO,MO',
      'cada martes',
    ]) {
      expect(parseRule(text), text).toBeNull()
    }
  })
})

describe('la fecha y la regla', () => {
  it('al poner una regla, la fecha salta a la primera vez que la cumple (B6)', () => {
    const viernes9 = at('2026-10-09 00:00')
    expect(show(firstOccurrence(viernes9, rule('FREQ=MONTHLY;BYDAY=1MO')))).toBe('2026-11-02 00:00')
    expect(show(firstOccurrence(viernes9, rule('FREQ=WEEKLY;BYDAY=TU,FR')))).toBe(
      '2026-10-09 00:00',
    )
    expect(show(firstOccurrence(viernes9, rule('FREQ=DAILY;INTERVAL=3')))).toBe('2026-10-09 00:00')
  })

  it('al completar: la siguiente después de su fecha y no antes de mañana', () => {
    const basura = rule('FREQ=WEEKLY;BYDAY=TU,FR')
    const martes = at('2026-10-06 00:00')
    // El martes, la del martes: al viernes.
    expect(show(nextAfterDone(martes, basura, at('2026-10-06 08:40')))).toBe('2026-10-09 00:00')
    // Antes de tiempo (el lunes, la del martes): al viernes, no al martes otra vez.
    expect(show(nextAfterDone(martes, basura, at('2026-10-05 20:00')))).toBe('2026-10-09 00:00')
    // Atrasada (el viernes, la del martes): no vuelve a quedarse para hoy, al martes siguiente.
    expect(show(nextAfterDone(martes, basura, at('2026-10-09 10:00')))).toBe('2026-10-13 00:00')
  })

  it('la mensual del 31 vuelve al 31 aunque la tarea se mueva (su día va escrito)', () => {
    const monthly = presetRule('MONTHLY', at('2026-01-31 00:00'))
    let due = at('2026-01-31 00:00')
    const seen: string[] = []
    for (let i = 0; i < 3; i++) {
      due = nextAfterDone(due, monthly, due) ?? due
      seen.push(show(due))
    }
    expect(seen).toEqual(['2026-02-28 00:00', '2026-03-31 00:00', '2026-04-30 00:00'])
  })
})

describe('los textos (diseño 21, B2–B8)', () => {
  it.each([
    ['FREQ=DAILY', 'Cada día', 'Cada día'],
    ['FREQ=DAILY;INTERVAL=3', 'Cada 3 días', 'Cada 3 días'],
    ['FREQ=WEEKLY', 'Cada semana', 'Cada semana'],
    ['FREQ=WEEKLY;BYDAY=TU', 'Cada martes', 'Cada martes'],
    ['FREQ=WEEKLY;BYDAY=TU,FR', 'Martes y viernes', 'Mar y vie'],
    ['FREQ=WEEKLY;BYDAY=MO,WE,FR', 'Lunes, miércoles y viernes', 'Lun, mié y vie'],
    [
      'FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,TH',
      'Cada 2 semanas, lunes y jueves',
      'Cada 2 sem · lun y jue',
    ],
    ['FREQ=WEEKLY;INTERVAL=2', 'Cada 2 semanas', 'Cada 2 sem'],
    ['FREQ=MONTHLY', 'Cada mes', 'Cada mes'],
    ['FREQ=MONTHLY;BYDAY=1MO', 'Cada mes, el primer lunes', 'Cada mes · el primer lunes'],
    ['FREQ=MONTHLY;BYDAY=-1FR', 'Cada mes, el último viernes', 'Cada mes · el último viernes'],
    [
      'FREQ=MONTHLY;INTERVAL=2;BYMONTHDAY=15',
      'Cada 2 meses, el día 15',
      'Cada 2 meses · el día 15',
    ],
    ['FREQ=YEARLY', 'Cada año', 'Cada año'],
    ['FREQ=YEARLY;INTERVAL=2', 'Cada 2 años', 'Cada 2 años'],
  ])('%s: «%s» y en la fila «%s»', (text, full, short) => {
    expect(ruleLabel(rule(text))).toBe(full)
    expect(ruleShortLabel(rule(text))).toBe(short)
  })

  it('las de siempre, con lo que significan ese día (B2)', () => {
    const viernes9 = at('2026-10-09 00:00')
    expect(presetHint('DAILY', viernes9, viernes9)).toBeNull()
    expect(presetHint('WEEKLY', viernes9, viernes9)).toBe('los viernes')
    expect(presetHint('WEEKLY', at('2026-10-10 00:00'), viernes9)).toBe('los sábados')
    expect(presetHint('MONTHLY', viernes9, viernes9)).toBe('el día 9')
    expect(presetHint('YEARLY', viernes9, viernes9)).toBe('el 9 oct')
  })

  it('una de las de siempre se reconoce; lo demás es personalizada', () => {
    const viernes9 = at('2026-10-09 00:00')
    expect(presetOf(presetRule('WEEKLY', viernes9), viernes9)).toBe('WEEKLY')
    expect(presetOf(presetRule('MONTHLY', viernes9), viernes9)).toBe('MONTHLY')
    expect(presetOf(rule('FREQ=WEEKLY'), viernes9)).toBe('WEEKLY')
    expect(presetOf(rule('FREQ=WEEKLY;BYDAY=TU,FR'), viernes9)).toBeNull()
    expect(presetOf(rule('FREQ=DAILY;INTERVAL=3'), viernes9)).toBeNull()
  })
})
