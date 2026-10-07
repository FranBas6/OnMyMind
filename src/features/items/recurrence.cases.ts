/**
 * Los casos de la repetición que se prueban en los dos sitios donde se calcula (3.6): en
 * TypeScript (`recurrence.test.ts`) y en SQL (`supabase/tests/recurrence_cases.test.sql`, que se
 * genera de aquí con `pnpm db:cases`). Si un lado cambia, el otro tiene que dar lo mismo.
 *
 * Las fechas son de reloj, en la zona de Madrid: «2026-10-06 19:00». `from` es desde cuándo se
 * busca (incluido) y `next`, la primera vez que toca.
 */
export interface RecurrenceCase {
  name: string
  first: string
  rule: string
  from: string
  next: string
}

export const RECURRENCE_CASES: readonly RecurrenceCase[] = [
  // Las de siempre.
  {
    name: 'cada día',
    first: '2026-10-01 08:00',
    rule: 'FREQ=DAILY',
    from: '2026-10-07 00:00',
    next: '2026-10-07 08:00',
  },
  {
    name: 'cada día, ya pasada la hora',
    first: '2026-10-01 08:00',
    rule: 'FREQ=DAILY',
    from: '2026-10-07 09:00',
    next: '2026-10-08 08:00',
  },
  {
    name: 'cada semana',
    first: '2026-10-02 19:00',
    rule: 'FREQ=WEEKLY',
    from: '2026-10-07 00:00',
    next: '2026-10-09 19:00',
  },
  {
    name: 'cada mes',
    first: '2026-01-15 10:00',
    rule: 'FREQ=MONTHLY',
    from: '2026-10-07 00:00',
    next: '2026-10-15 10:00',
  },
  {
    name: 'cada año',
    first: '2020-03-04 00:00',
    rule: 'FREQ=YEARLY',
    from: '2026-10-07 00:00',
    next: '2027-03-04 00:00',
  },
  {
    name: 'aún no ha empezado: la primera',
    first: '2026-12-01 10:00',
    rule: 'FREQ=WEEKLY',
    from: '2026-10-07 00:00',
    next: '2026-12-01 10:00',
  },
  {
    name: 'lo de antes (weekly) se lee igual',
    first: '2026-10-02 19:00',
    rule: 'weekly',
    from: '2026-10-07 00:00',
    next: '2026-10-09 19:00',
  },
  // Cada N.
  {
    name: 'cada 3 días',
    first: '2026-10-03 00:00',
    rule: 'FREQ=DAILY;INTERVAL=3',
    from: '2026-10-07 00:00',
    next: '2026-10-09 00:00',
  },
  {
    name: 'cada 2 semanas, en la semana que no toca',
    first: '2026-09-28 10:00',
    rule: 'FREQ=WEEKLY;INTERVAL=2',
    from: '2026-10-06 00:00',
    next: '2026-10-12 10:00',
  },
  {
    name: 'cada 3 meses',
    first: '2026-01-31 09:00',
    rule: 'FREQ=MONTHLY;INTERVAL=3',
    from: '2026-03-01 00:00',
    next: '2026-04-30 09:00',
  },
  {
    name: 'cada 2 años',
    first: '2024-05-10 00:00',
    rule: 'FREQ=YEARLY;INTERVAL=2',
    from: '2026-06-01 00:00',
    next: '2028-05-10 00:00',
  },
  // Días de la semana.
  {
    name: 'martes y viernes, un miércoles',
    first: '2026-10-06 00:00',
    rule: 'FREQ=WEEKLY;BYDAY=TU,FR',
    from: '2026-10-07 00:00',
    next: '2026-10-09 00:00',
  },
  {
    name: 'martes y viernes, un sábado',
    first: '2026-10-06 00:00',
    rule: 'FREQ=WEEKLY;BYDAY=TU,FR',
    from: '2026-10-10 00:00',
    next: '2026-10-13 00:00',
  },
  {
    name: 'cada 2 semanas, lunes y jueves',
    first: '2026-10-12 10:00',
    rule: 'FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,TH',
    from: '2026-10-16 00:00',
    next: '2026-10-26 10:00',
  },
  {
    name: 'el domingo es el último de la semana',
    first: '2026-10-05 00:00',
    rule: 'FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,SU',
    from: '2026-10-06 00:00',
    next: '2026-10-11 00:00',
  },
  // Un día del mes.
  {
    name: 'el día 15',
    first: '2026-09-15 00:00',
    rule: 'FREQ=MONTHLY;BYMONTHDAY=15',
    from: '2026-10-07 00:00',
    next: '2026-10-15 00:00',
  },
  {
    name: 'el día 31, en un mes de 30',
    first: '2026-08-31 00:00',
    rule: 'FREQ=MONTHLY;BYMONTHDAY=31',
    from: '2026-09-01 00:00',
    next: '2026-09-30 00:00',
  },
  {
    name: 'el día 31 vuelve a ser 31',
    first: '2026-08-31 00:00',
    rule: 'FREQ=MONTHLY;BYMONTHDAY=31',
    from: '2026-10-01 00:00',
    next: '2026-10-31 00:00',
  },
  {
    name: 'el día 30 en febrero',
    first: '2026-01-30 00:00',
    rule: 'FREQ=MONTHLY;BYMONTHDAY=30',
    from: '2026-02-01 00:00',
    next: '2026-02-28 00:00',
  },
  {
    name: 'el primer lunes',
    first: '2026-11-02 00:00',
    rule: 'FREQ=MONTHLY;BYDAY=1MO',
    from: '2026-11-03 00:00',
    next: '2026-12-07 00:00',
  },
  {
    name: 'el segundo martes',
    first: '2026-10-13 18:00',
    rule: 'FREQ=MONTHLY;BYDAY=2TU',
    from: '2026-10-14 00:00',
    next: '2026-11-10 18:00',
  },
  {
    name: 'el cuarto jueves',
    first: '2026-10-22 00:00',
    rule: 'FREQ=MONTHLY;BYDAY=4TH',
    from: '2026-10-23 00:00',
    next: '2026-11-26 00:00',
  },
  {
    name: 'el último viernes',
    first: '2026-10-30 00:00',
    rule: 'FREQ=MONTHLY;BYDAY=-1FR',
    from: '2026-10-31 00:00',
    next: '2026-11-27 00:00',
  },
  {
    name: 'el último domingo, cada 2 meses',
    first: '2026-08-30 00:00',
    rule: 'FREQ=MONTHLY;INTERVAL=2;BYDAY=-1SU',
    from: '2026-09-01 00:00',
    next: '2026-10-25 00:00',
  },
  // Bisiestos y cambio de hora.
  {
    name: 'el 29 de febrero, un año que no es bisiesto',
    first: '2024-02-29 00:00',
    rule: 'FREQ=YEARLY',
    from: '2025-01-01 00:00',
    next: '2025-02-28 00:00',
  },
  {
    name: 'el 29 de febrero vuelve en bisiesto',
    first: '2024-02-29 00:00',
    rule: 'FREQ=YEARLY',
    from: '2028-01-01 00:00',
    next: '2028-02-29 00:00',
  },
  {
    name: 'a las 10 también tras atrasar la hora',
    first: '2026-10-19 10:00',
    rule: 'FREQ=WEEKLY',
    from: '2026-10-20 00:00',
    next: '2026-10-26 10:00',
  },
  {
    name: 'a las 9 el día que se adelanta la hora',
    first: '2026-03-28 09:00',
    rule: 'FREQ=DAILY',
    from: '2026-03-29 00:00',
    next: '2026-03-29 09:00',
  },
  // Fin de año.
  {
    name: 'el último viernes de diciembre al de enero',
    first: '2026-12-25 00:00',
    rule: 'FREQ=MONTHLY;BYDAY=-1FR',
    from: '2026-12-26 00:00',
    next: '2027-01-29 00:00',
  },
  {
    name: 'semanas que cruzan el año',
    first: '2026-12-28 00:00',
    rule: 'FREQ=WEEKLY;BYDAY=MO,FR',
    from: '2026-12-29 00:00',
    next: '2027-01-01 00:00',
  },
]

/** El archivo de pgTAP con los mismos casos (`pnpm db:test`). */
export function renderSqlCases(): string {
  const rows = RECURRENCE_CASES.map(
    (c) =>
      `select is(to_char(public.next_occurrence('${c.first}'::timestamp at time zone 'Europe/Madrid', '${c.rule}', 'Europe/Madrid', '${c.from}'::timestamp at time zone 'Europe/Madrid') at time zone 'Europe/Madrid', 'YYYY-MM-DD HH24:MI'), '${c.next}', '${c.name.replace(/'/g, "''")}');`,
  )
  return [
    '-- Generado de src/features/items/recurrence.cases.ts con `pnpm db:cases`. No se edita a mano.',
    '-- La repetición se calcula igual en TypeScript y en SQL (3.6). `pnpm db:test`.',
    '',
    'begin;',
    'create extension if not exists pgtap with schema extensions;',
    'set search_path = public, extensions;',
    'select no_plan();',
    '',
    ...rows,
    '',
    'select * from finish(true);',
    'rollback;',
    '',
  ].join('\n')
}
