import { useCallback, useSyncExternalStore } from 'react'

/** `true` mientras la media query se cumpla; se actualiza al cambiar el tamaño de la ventana. */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const mediaQueryList = window.matchMedia(query)
      mediaQueryList.addEventListener('change', onChange)
      return () => {
        mediaQueryList.removeEventListener('change', onChange)
      }
    },
    [query],
  )

  return useSyncExternalStore(subscribe, () => window.matchMedia(query).matches)
}
