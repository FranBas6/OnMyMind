import { useQuery } from '@tanstack/react-query'
import { useCallback } from 'react'
import { toast } from 'sonner'

import { useCurrentUser } from '@/features/profile/hooks/useProfile'
import { errorMessage } from '@/lib/errors'
import { durableMutation, useDurableMutation, WAITS_FOR_NETWORK } from '@/lib/mutations'
import { queryKeys } from '@/lib/queryKeys'

import {
  fetchPriceAlerts,
  fetchPriceDrops,
  fetchPriceHistory,
  fetchSavings,
  setPriceAlert,
} from './api'

/**
 * El histórico de una compra. Va en la clave con el precio de ahora: al cambiar, se vuelve a
 * pedir, y mientras tanto `chartData` ya pinta el precio nuevo al final de la línea.
 */
export function usePriceHistory(itemId: string, priceCents: number | null, enabled: boolean) {
  return useQuery({
    queryKey: [...queryKeys.prices(itemId), priceCents],
    queryFn: () => fetchPriceHistory(itemId),
    enabled,
    placeholderData: (previous) => previous,
    staleTime: 5 * 60 * 1000,
  })
}

/** «Ahorrado» (diseño 16, C1): se pide al abrir Perfil. */
export function useSavings() {
  return useQuery({ queryKey: queryKeys.savings, queryFn: fetchSavings, staleTime: 60 * 1000 })
}

/** Las compras en las que pediste «Avisarme si baja» (3.8). */
export function usePriceAlerts() {
  return useQuery({ queryKey: queryKeys.priceAlerts, queryFn: fetchPriceAlerts })
}

/** Si pediste el aviso de esta compra. */
export function usePriceAlert(itemId: string): boolean {
  return usePriceAlerts().data?.includes(itemId) ?? false
}

interface PriceAlertChange {
  itemId: string
  userId: string
  on: boolean
}

/**
 * «Avisarme si baja»: se ve al momento y, sin red, espera en la cola (2.10), también con la app
 * cerrada. Si el servidor dice que no, vuelve atrás.
 */
const setPriceAlertMutation = durableMutation(['prices', 'alert'], (queryClient) => ({
  ...WAITS_FOR_NETWORK,
  mutationFn: ({ itemId, userId, on }: PriceAlertChange) => setPriceAlert(itemId, userId, on),
  onMutate: async ({ itemId, on }: PriceAlertChange) => {
    await queryClient.cancelQueries({ queryKey: queryKeys.priceAlerts })
    const previous = queryClient.getQueryData<string[]>(queryKeys.priceAlerts)
    queryClient.setQueryData<string[]>(queryKeys.priceAlerts, (ids = []) =>
      on ? [...new Set([...ids, itemId])] : ids.filter((id) => id !== itemId),
    )
    return { previous }
  },
  onError: (
    error: Error,
    _change: PriceAlertChange,
    context: { previous: string[] | undefined } | undefined,
  ) => {
    queryClient.setQueryData(queryKeys.priceAlerts, context?.previous)
    toast.error(`No se ha podido guardar el aviso. ${errorMessage(error)}`)
  },
  onSettled: () => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.priceAlerts })
  },
}))

/** Las mutaciones de precios que se registran en el QueryClient (2.10). */
export const priceMutations = [setPriceAlertMutation]

export function useSetPriceAlert() {
  const user = useCurrentUser()
  const { mutate } = useDurableMutation(setPriceAlertMutation)
  return useCallback(
    (itemId: string, on: boolean) => {
      mutate({ itemId, userId: user.id, on })
    },
    [mutate, user.id],
  )
}

/** «Bajaron esta mañana» (diseño 22, N3): se pide cada vez que se abre la hoja. */
export function usePriceDrops(enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.priceDrops,
    queryFn: fetchPriceDrops,
    enabled,
    staleTime: 0,
  })
}
