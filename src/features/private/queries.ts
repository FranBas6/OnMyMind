import { queryOptions } from '@tanstack/react-query'

import { queryKeys } from '@/lib/queryKeys'

import { fetchPrivateVault } from './api'

/**
 * Tu caja y tus llaves (5.6). Van cifradas, así que se guardan con la caché: sin red se
 * desbloquea igual, porque la clave se comprueba en el aparato (diseño 26, C3e).
 */
export function privateVaultQueryOptions() {
  return queryOptions({ queryKey: queryKeys.privateVault, queryFn: fetchPrivateVault })
}
