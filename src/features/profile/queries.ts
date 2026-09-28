import { queryOptions } from '@tanstack/react-query'

import { queryKeys } from '@/lib/queryKeys'

import { fetchProfile } from './api'

/** Tu perfil. Al cerrar sesión se vacía toda la caché, así que la clave no lleva el id. */
export function profileQueryOptions(userId: string) {
  return queryOptions({
    queryKey: queryKeys.profile(),
    queryFn: () => fetchProfile(userId),
  })
}
