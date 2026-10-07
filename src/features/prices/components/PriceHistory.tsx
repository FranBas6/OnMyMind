import { format } from 'date-fns'
import { Suspense } from 'react'

import { formatCents } from '@/lib/money'

import { chartData, type CurrentPrice } from '../history'
import type { PriceRecord, PriceSource } from '../types'
import { LazyPriceChart } from './LazyPriceChart'

interface PriceHistoryProps {
  records: readonly PriceRecord[]
  current: CurrentPrice
  /** Con varias tiendas, la gráfica es la del precio más bajo y dice de qué tienda era (diseño 19). */
  stores?: boolean
}

/**
 * «Histórico de precios · 6 meses» con su gráfica (diseño 16, B1); con varias tiendas, «Histórico del
 * precio más bajo» (19, T1). Para quien no
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
        <span className="font-semibold text-muted-foreground">
          {stores ? 'Histórico del precio más bajo' : 'Histórico de precios'}
        </span>
        <span className="text-subtle-foreground">6 meses</span>
      </figcaption>
      <div aria-hidden className="mt-1">
        <Suspense fallback={<div className="h-[104px]" />}>
          <LazyPriceChart data={data} currency={current.currency} />
        </Suspense>
      </div>
      <Legend sources={new Set(changes.map((point) => point.source))} />
      <p className="sr-only">
        {changes
          .map(
            (point) =>
              `${formatCents(point.cents, current.currency)} el ${format(new Date(point.since), 'd MMM')}${point.store ? ` en ${point.store}` : ''}${point.source === 'manual' ? ', a mano' : point.source === 'auto' ? ', comprobado solo' : ''}`,
          )
          .join('; ')}
        .
      </p>
    </figure>
  )
}

const LEGEND: { source: PriceSource; label: string }[] = [
  { source: 'auto', label: 'Solo, cada mañana' },
  { source: 'web', label: 'Al actualizar' },
  { source: 'manual', label: 'A mano' },
]

/**
 * Qué es cada marca (diseño 22, P1): punto lleno, aro y rombo. Solo las que hay en la gráfica, y
 * solo si hay más de una o alguna de las que se miran solas (sin ellas, como antes de la 3.8).
 */
function Legend({ sources }: { sources: ReadonlySet<PriceSource> }) {
  if (sources.size === 0 || (sources.size === 1 && !sources.has('auto'))) return null
  return (
    <p aria-hidden className="mt-1 flex flex-wrap gap-x-3.5 gap-y-1 text-xs text-muted-foreground">
      {LEGEND.filter((entry) => sources.has(entry.source)).map((entry) => (
        <span key={entry.source} className="inline-flex items-center gap-1.5">
          <Mark source={entry.source} />
          {entry.label}
        </span>
      ))}
    </p>
  )
}

function Mark({ source }: { source: PriceSource }) {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" className="shrink-0">
      {source === 'manual' ? (
        <rect
          x="2.2"
          y="2.2"
          width="5.6"
          height="5.6"
          transform="rotate(45 5 5)"
          className="fill-card stroke-muted-foreground"
          strokeWidth="1.6"
        />
      ) : (
        <circle
          cx="5"
          cy="5"
          r={source === 'auto' ? 3.5 : 3.2}
          className={source === 'auto' ? 'fill-primary stroke-primary' : 'fill-card stroke-primary'}
          strokeWidth="1.6"
        />
      )}
    </svg>
  )
}
