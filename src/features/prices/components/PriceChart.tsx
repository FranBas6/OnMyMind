import { format, isSameDay } from 'date-fns'
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

import { formatCents } from '@/lib/money'

import type { ChartPoint, PriceChartData } from '../history'

interface PriceChartProps {
  data: PriceChartData
  currency: string
}

/**
 * La gráfica del histórico (diseño 16, B1, B17 y D4), con Recharts. En escalón, porque el precio no
 * cambia entre una vez y otra; un punto por cambio; las marcas de mes abajo y sin eje de importes,
 * para no parecer un panel. Tocar un punto abre una etiqueta oscura con el precio, la fecha y de
 * dónde salió. Va en su propio archivo para cargarlo solo cuando hace falta (`LazyPriceChart`).
 */
export function PriceChart({ data, currency }: PriceChartProps) {
  const values = data.points.map((point) => point.cents)
  const low = Math.min(...values)
  const high = Math.max(...values)
  // Un poco de aire arriba y abajo para que los puntos no toquen el borde.
  const pad = Math.max((high - low) * 0.25, high * 0.02, 1)

  return (
    <ResponsiveContainer width="100%" height={104}>
      <LineChart data={data.points} margin={{ top: 10, right: 6, bottom: 0, left: 6 }}>
        <XAxis
          dataKey="at"
          type="number"
          scale="time"
          domain={data.domain}
          ticks={data.ticks.map((tick) => tick.at)}
          tickFormatter={(at: number) => data.ticks.find((tick) => tick.at === at)?.label ?? ''}
          tickLine={false}
          axisLine={{ stroke: 'var(--color-border-soft)' }}
          tick={{ fontSize: 11, fill: 'var(--color-subtle-foreground)' }}
          tickMargin={10}
          height={30}
        />
        <YAxis hide domain={[low - pad, high + pad]} />
        <Tooltip
          cursor={false}
          isAnimationActive={false}
          content={({ active, payload }) => {
            const point = payload[0]?.payload as ChartPoint | undefined
            return active && point ? <PointLabel point={point} currency={currency} /> : null
          }}
        />
        <Line
          type="stepAfter"
          dataKey="cents"
          stroke="var(--color-primary)"
          strokeWidth={2.5}
          isAnimationActive={false}
          dot={(props: { cx?: number; cy?: number; index?: number; payload?: ChartPoint }) => (
            <PriceDot key={props.index} cx={props.cx} cy={props.cy} show={props.payload?.change} />
          )}
          activeDot={{
            r: 6,
            fill: 'var(--color-primary)',
            stroke: 'var(--color-card)',
            strokeWidth: 2,
          }}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}

/** El punto de un cambio: un aro índigo sobre la tarjeta. Los de los bordes no se dibujan. */
function PriceDot({ cx, cy, show }: { cx?: number; cy?: number; show?: boolean }) {
  if (!show || cx === undefined || cy === undefined) return <g />
  return (
    <circle
      cx={cx}
      cy={cy}
      r={4.5}
      fill="var(--color-card)"
      stroke="var(--color-primary)"
      strokeWidth={2}
    />
  )
}

/** «295 € · 21 jun» y «Puesto a mano» (diseño 16, B17): la etiqueta del punto tocado. */
function PointLabel({ point, currency }: { point: ChartPoint; currency: string }) {
  const since = new Date(point.since)
  return (
    <div className="rounded-[12px] bg-toast px-3 py-2 text-toast-foreground shadow-popover">
      <p className="text-[13px]">
        <span className="font-display font-extrabold">{formatCents(point.cents, currency)}</span>
        {' · '}
        {isSameDay(since, new Date()) ? 'hoy' : format(since, 'd MMM')}
      </p>
      <p className="mt-0.5 text-xs opacity-80">
        {/* Con varias tiendas, dice de cuál era (diseño 19, T20): «MediaMarkt · de la web». */}
        {point.store
          ? `${point.store} · ${point.source === 'manual' ? 'a mano' : 'de la web'}`
          : point.source === 'manual'
            ? 'Puesto a mano'
            : 'De la web'}
      </p>
    </div>
  )
}
