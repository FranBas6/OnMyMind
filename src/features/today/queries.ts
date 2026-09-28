import { queryOptions } from '@tanstack/react-query'

import { queryKeys } from '@/lib/queryKeys'

import { fetchToday } from './api'
import { dayKey } from './today'

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
