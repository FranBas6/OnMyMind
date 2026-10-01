import { lazy } from 'react'

/**
 * La gráfica, cargada solo cuando se pinta por primera vez (`React.lazy`): Vite deja Recharts en
 * su propio archivo y el navegador no lo pide hasta abrir una compra con histórico.
 */
export const LazyPriceChart = lazy(() =>
  import('./PriceChart').then((module) => ({ default: module.PriceChart })),
)
