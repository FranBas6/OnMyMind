import { useQuery } from '@tanstack/react-query'

import { archivedListsQueryOptions } from '../queries'

export function useArchivedLists() {
  return useQuery(archivedListsQueryOptions)
}
