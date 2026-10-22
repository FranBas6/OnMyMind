import { format } from 'date-fns'
import { queryOptions } from '@tanstack/react-query'

import { fetchCompletions } from '@/features/items'
import { queryKeys } from '@/lib/queryKeys'

import { fetchDays, fetchToday } from './api'
import { dayKey, monthGrid, todayBounds } from './today'

/**
 * Hoy del día de `now`. Con `staleTime` corto (10 s en vez de 30): es la pantalla a la que se
 * vuelve a menudo y lo que se complete en otro dispositivo debe verse pronto. Lo que se hace en
 * este ya lo actualizan las mutaciones de ítems, que además la invalidan al terminar.
 */
export function todayQueryOptions(now: Date) {
  return queryOptions({
    queryKey: queryKeys.items.today(dayKey(now)),
    queryFn: () => fetchToday(now),
    staleTime: 10_000,
  })
}

/**
 * Lo de la rejilla de un mes (`monthGrid`): otro día de Hoy y los puntos del calendario. Lo tocan
 * las mismas mutaciones que Hoy (`daysAll`).
 */
export function daysQueryOptions(month: Date) {
  const { start, end } = monthGrid(month)
  return queryOptions({
    queryKey: queryKeys.items.days(format(month, 'yyyy-MM')),
    queryFn: () => fetchDays(start, end),
    staleTime: 10_000,
  })
}

/**
 * Las veces hechas de las tareas que se repiten en un día (3.6): «Hecho hoy» y «Hecho ese
 * día». Cuelga de `['items']`, así que se vuelve a pedir con cualquier cambio de ítems.
 */
export function completionsQueryOptions(day: Date) {
  const { start, end } = todayBounds(day)
  return queryOptions({
    queryKey: queryKeys.items.completions(dayKey(start), dayKey(end)),
    queryFn: () => fetchCompletions(start, end),
    staleTime: 10_000,
  })
}
