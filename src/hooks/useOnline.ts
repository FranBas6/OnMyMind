import { onlineManager } from '@tanstack/react-query'
import { useSyncExternalStore } from 'react'

/**
 * Si hay red, según TanStack Query (que escucha los eventos `online` / `offline`). Es el mismo
 * criterio que decide si una mutación se envía o espera.
 */
export function useOnline(): boolean {
  return useSyncExternalStore(
    (onChange) => onlineManager.subscribe(onChange),
    () => onlineManager.isOnline(),
    () => true,
  )
}
