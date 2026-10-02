import { format } from 'date-fns'
import { Suspense } from 'react'

import { formatCents } from '@/lib/money'

import { chartData, type CurrentPrice } from '../history'
import type { PriceRecord } from '../types'
import { LazyPriceChart } from './LazyPriceChart'

interface PriceHistoryProps {
  records: readonly PriceRecord[]
  current: CurrentPrice
  /** Con varias tiendas, la gráfica es la del precio más bajo y dice de qué tienda era (diseño 19). */
  stores?: boolean
}

/**
 * «Histórico del precio más bajo · 6 meses» con su gráfica (diseño 16, B1, y 19, T1). Para quien no
 * la ve, la misma historia en una frase. Mientras se descarga la gráfica, su hueco, para que el
 * bloque no salte.
 */
export function PriceHistory({ records, current, stores = false }: PriceHistoryProps) {
  // Con una sola tienda no hace falta decir cuál: es la del enlace.
  const data = chartData(
    stores ? records : records.map((record) => ({ ...record, store: null })),
    stores ? current : { ...current, store: null },
  )
  const changes = data.points.filter((point) => point.change)
  return (
    <figure className="mt-3">
      <figcaption className="flex items-baseline justify-between text-[12.5px]">
        <span className="font-semibold text-muted-foreground">Histórico del precio más bajo</span>
        <span className="text-subtle-foreground">6 meses</span>
      </figcaption>
      <div aria-hidden className="mt-1">
        <Suspense fallback={<div className="h-[104px]" />}>
          <LazyPriceChart data={data} currency={current.currency} />
        </Suspense>
      </div>
      <p className="sr-only">
        {changes
          .map(
            (point) =>
              `${formatCents(point.cents, current.currency)} el ${format(new Date(point.since), 'd MMM')}${point.store ? ` en ${point.store}` : ''}${point.source === 'manual' ? ', a mano' : ''}`,
          )
          .join('; ')}
        .
      </p>
    </figure>
  )
}
