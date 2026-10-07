import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'

import type { Item } from '@/features/items'
import { useLists, type List } from '@/features/lists'

import { completionsQueryOptions, daysQueryOptions, todayQueryOptions } from '../queries'
import {
  completionsOnDay,
  groupDay,
  groupToday,
  markedDays,
  monthGrid,
  stripMonth,
  withCompletions,
} from '../today'
import { useCurrentDay } from './useCurrentDay'

/**
 * Las listas en caché por id, también «En mente»: Hoy saca de ellas el nombre, el color, el orden
 * y el tipo, así que un cambio en una lista se ve aquí sin volver a pedir.
 */
function useListsById() {
  const lists = useLists()
  const byId = useMemo(() => {
    const all = lists.data
      ? [...(lists.data.inbox ? [lists.data.inbox] : []), ...lists.data.lists]
      : []
    return new Map(all.map((list) => [list.id, list]))
  }, [lists.data])
  const listOf = (item: Item): List | undefined => byId.get(item.listId)
  return { ready: lists.data !== undefined, byId, listOf }
}

/** Hoy agrupado por listas. La consulta trae los ítems; la agrupación usa las listas en caché. */
export function useToday({ lingering }: { lingering?: ReadonlySet<string> } = {}) {
  const now = useCurrentDay()
  const query = useQuery(todayQueryOptions(now))
  const completions = useQuery(completionsQueryOptions(now))
  const { ready, byId, listOf } = useListsById()

  const lists = [...byId.values()]
  const grouped =
    query.data && ready ? groupToday(query.data, lists, { now, lingering }) : undefined
  // Lo que se repite y se hizo hoy también cuenta en «N hechas hoy» (diseño 21, B12).
  const groups = grouped && {
    ...grouped,
    done: withCompletions(grouped.done, completionsOnDay(completions.data ?? [], lists, now)),
  }

  return { now, query, groups, listOf }
}

/**
 * Otro día en Hoy (2.5): lo pide con la rejilla del mes de su semana (la misma consulta que los
 * puntos de la tira) y lo agrupa con `groupDay`. Con `enabled: false` (hoy) no pide nada.
 */
export function useOtherDay(
  day: Date,
  { enabled, lingering }: { enabled: boolean; lingering?: ReadonlySet<string> },
) {
  const today = useCurrentDay()
  const query = useQuery({ ...daysQueryOptions(stripMonth(day)), enabled })
  const completions = useQuery({ ...completionsQueryOptions(day), enabled })
  const { ready, byId, listOf } = useListsById()

  const lists = [...byId.values()]
  const grouped =
    enabled && query.data && ready
      ? groupDay(query.data, lists, { day, today, lingering })
      : undefined
  // Y en «Hecho ese día» (B13).
  const groups = grouped && {
    ...grouped,
    done: withCompletions(grouped.done, completionsOnDay(completions.data ?? [], lists, day)),
  }

  return { query, groups, listOf }
}

/** Los días con algo en la rejilla de un mes (`2026-09-22`, …): sus puntos en el calendario. */
export function useMarkedDays(month: Date): ReadonlySet<string> {
  const today = useCurrentDay()
  const query = useQuery(daysQueryOptions(month))
  const { ready, byId } = useListsById()
  return query.data && ready
    ? markedDays(query.data, [...byId.values()], { ...monthGrid(month), today })
    : new Set<string>()
}

/** Lo que queda por hacer hoy: el contador de «Hoy» en el sidebar. */
export function useTodayCount(): number | undefined {
  return useToday().groups?.pending
}
