import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'

import type { Item } from '@/features/items'
import { useLists, type List } from '@/features/lists'

import { todayQueryOptions } from '../queries'
import { groupToday } from '../today'
import { useCurrentDay } from './useCurrentDay'

/**
 * Hoy agrupado por listas. La consulta trae los ítems; la agrupación usa las listas en caché
 * (nombre, color, orden y tipo), así que un cambio en una lista se ve aquí sin volver a pedir.
 */
export function useToday({ lingering }: { lingering?: ReadonlySet<string> } = {}) {
  const now = useCurrentDay()
  const query = useQuery(todayQueryOptions(now))
  const lists = useLists()

  const byId = useMemo(() => {
    const all = lists.data
      ? [...(lists.data.inbox ? [lists.data.inbox] : []), ...lists.data.lists]
      : []
    return new Map(all.map((list) => [list.id, list]))
  }, [lists.data])
  const listOf = (item: Item): List | undefined => byId.get(item.listId)

  const groups =
    query.data && lists.data
      ? groupToday(query.data, [...byId.values()], { now, lingering })
      : undefined

  return { now, query, groups, listOf }
}

/** Lo que queda por hacer hoy: el contador de «Hoy» en el sidebar. */
export function useTodayCount(): number | undefined {
  return useToday().groups?.pending
}
