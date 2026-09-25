import { useQuery } from '@tanstack/react-query'

import { fetchDisplayName } from '../api'

/** Provisional hasta la feature de perfil (1.13), que tendrá `useProfile` con la clave `['profile']`. */
export function useDisplayName(userId: string) {
  return useQuery({
    queryKey: ['profile', userId, 'display_name'],
    queryFn: () => fetchDisplayName(userId),
  })
}
