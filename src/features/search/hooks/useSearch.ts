import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'

import type { Item } from '@/features/items'
import { useArchivedLists, useLists, type List } from '@/features/lists'

import { allItemsQueryOptions } from '../queries'
import { searchItems, searchLists, type SearchFilter } from '../search'

interface UseSearchOptions {
  query: string
  filter: SearchFilter
  lingering?: ReadonlySet<string>
}

/**
 * Busca sobre la caché de todos los ítems y sobre los nombres de las listas. Las listas (activas,
 * «En mente» y archivadas) dan también el nombre, el color, el orden de las secciones y la
 * píldora «Archivada» de los ítems.
 */
export function useSearch({ query, filter, lingering }: UseSearchOptions) {
  const items = useQuery(allItemsQueryOptions)
  const lists = useLists()
  const archived = useArchivedLists()

  const byId = useMemo(() => {
    const all: List[] = [
      ...(lists.data?.inbox ? [lists.data.inbox] : []),
      ...(lists.data?.lists ?? []),
      ...(archived.data ?? []),
    ]
    return new Map(all.map((list) => [list.id, list]))
  }, [lists.data, archived.data])
  const listOf = (item: Item): List | undefined => byId.get(item.listId)

  const outcome =
    items.data && lists.data
      ? searchItems(items.data, [...byId.values()], query, { filter, lingering })
      : undefined
  // Las listas no tienen estado: solo salen con «Todo».
  const listMatches = filter === 'all' ? searchLists([...byId.values()], query) : []

  return { items, outcome, listMatches, listOf }
}
