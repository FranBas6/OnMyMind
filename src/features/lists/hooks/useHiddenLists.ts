import { useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'

import { getUnlocked, subscribeUnlocked, useUnlocked } from '@/features/private'
import { queryKeys } from '@/lib/queryKeys'

import { hiddenListIdsQueryOptions, hiddenListsQueryOptions } from '../queries'

/**
 * Tus listas ocultas (5.8), solo desbloqueado: bloqueado no se piden, y lo pedido se olvida al
 * bloquear (`useForgetHiddenOnLock`).
 */
export function useHiddenLists() {
  const unlocked = useUnlocked()
  return useQuery({ ...hiddenListsQueryOptions, enabled: unlocked !== null })
}

/** Cuáles has ocultado (solo los ids). */
export function useHiddenListIds() {
  return useQuery(hiddenListIdsQueryOptions)
}

/** Los ids de las ocultas que hay en la caché, para quien no es un componente. */
export function hiddenListIds(queryClient: QueryClient): ReadonlySet<string> {
  return new Set(queryClient.getQueryData<string[]>(queryKeys.lists.hiddenIds) ?? [])
}

/**
 * Al bloquear (5.8), se olvida lo de las ocultas: la lista de ellas y lo de dentro que se haya
 * abierto. Así, al volver, hay que desbloquear otra vez. Va una vez, en `ListActionsProvider`.
 */
export function useForgetHiddenOnLock() {
  const queryClient = useQueryClient()
  useEffect(
    () =>
      subscribeUnlocked(() => {
        if (getUnlocked()) return
        queryClient.removeQueries({ queryKey: queryKeys.lists.hidden, exact: true })
        for (const listId of hiddenListIds(queryClient)) {
          queryClient.removeQueries({ queryKey: queryKeys.items.byList(listId) })
        }
      }),
    [queryClient],
  )
}
