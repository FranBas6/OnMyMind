import { useQuery } from '@tanstack/react-query'

import { queryKeys } from '@/lib/query/queryKeys'

import { fetchListPayments } from '../api'
import type { Payment } from '../types'

const NO_PAYMENTS: readonly Payment[] = []

/**
 * Lo pagado en una lista (6.4): una consulta para el historial de cada ficha y para «Marta pagó el
 * 1 nov» en sus filas. Solo si la lista tiene algún pago que se repite (`enabled`).
 */
export function useListPayments(listId: string, enabled: boolean): readonly Payment[] {
  const query = useQuery({
    queryKey: queryKeys.payments(listId),
    queryFn: () => fetchListPayments(listId),
    enabled,
    staleTime: 60 * 1000,
  })
  return query.data ?? NO_PAYMENTS
}

/** Los pagos de una cosa, lo último primero. */
export function paymentsOf(payments: readonly Payment[], itemId: string): Payment[] {
  return payments.filter((payment) => payment.itemId === itemId)
}
