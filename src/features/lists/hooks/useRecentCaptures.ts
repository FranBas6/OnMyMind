import { useQuery } from '@tanstack/react-query'

import { recentCapturesQueryOptions } from '../queries'

/**
 * Últimas capturas de una lista. `enabled` permite no pedirlas cuando no se van a pintar (en
 * móvil la tarjeta de «En mente» no las enseña): una consulta desactivada no hace petición.
 */
export function useRecentCaptures(listId: string, enabled: boolean) {
  return useQuery({ ...recentCapturesQueryOptions(listId), enabled })
}
