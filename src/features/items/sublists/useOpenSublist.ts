import { useNavigate } from '@tanstack/react-router'
import { useCallback } from 'react'

/**
 * Entrar en una sublista (`/lists/:listId/:sublistId`, diseño 12). Con `rename`, la pantalla abre
 * el nombre enfocado: el valor es la hora, distinto cada vez, para que «Renombrar» funcione también
 * estando ya dentro.
 */
export function useOpenSublist(listId: string) {
  const navigate = useNavigate()
  return useCallback(
    (sublistId: string, options?: { rename?: boolean }) => {
      void navigate({
        to: '/lists/$listId/$sublistId',
        params: { listId, sublistId },
        search: options?.rename ? { rename: Date.now() } : {},
      })
    },
    [listId, navigate],
  )
}
