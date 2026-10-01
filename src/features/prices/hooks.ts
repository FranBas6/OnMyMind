import { useQuery } from '@tanstack/react-query'

import { queryKeys } from '@/lib/queryKeys'

import { fetchPriceHistory, fetchSavings } from './api'

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
