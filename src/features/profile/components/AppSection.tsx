import { differenceInCalendarDays, format, isSameYear } from 'date-fns'
import { Check, ChevronRight, WifiOff } from 'lucide-react'

import { useOnline } from '@/hooks/useOnline'
import { usePwa } from '@/hooks/usePwa'
import { formatCaptureAge } from '@/lib/date'
import { cn } from '@/lib/utils'

const dayOf = (date: Date, now: Date) =>
  format(date, isSameYear(date, now) ? 'd MMM' : 'd MMM yyyy')

/** «hoy», «ayer» o «el 28 sep», para «Publicada hoy · la tuya es del 28 sep». */
function publishedOn(date: Date, now: Date): string {
  const days = differenceInCalendarDays(now, date)
  if (days === 0) return 'hoy'
  if (days === 1) return 'ayer'
  return `el ${dayOf(date, now)}`
}

/**
 * «App» de Perfil (diseño 10, I10–I13 y D3–D5), entre Captura y Cuenta. La fila «Versión» dice de
 * cuándo es la tuya y su estado: «Al día» (con la última comprobación), «Buscando…», «Hay una
 * versión nueva · Actualizar» o «Sin conexión». Debajo, «Buscar actualización». En Safari del
 * iPhone sin la app instalada, además, «Instalar en el iPhone», que abre su hoja.
 */
export function AppSection() {
  const pwa = usePwa()
  const online = useOnline()
  const now = new Date()
  const mine = dayOf(pwa.buildTime, now)

  const status = !online
    ? 'offline'
    : pwa.updateAvailable
      ? 'available'
      : pwa.checking
        ? 'checking'
        : 'current'

  const detail = {
    offline: 'Se comprobará al volver la conexión',
    checking: 'Comprobando…',
    available: pwa.newBuildTime
      ? `Publicada ${publishedOn(pwa.newBuildTime, now)} · la tuya es del ${mine}`
      : `La tuya es del ${mine}`,
    current: pwa.checkFailed
      ? 'No se ha podido comprobar. Prueba otra vez en un momento.'
      : pwa.lastCheckedAt
        ? `Última comprobación ${formatCaptureAge(pwa.lastCheckedAt, now)}`
        : 'Aún sin comprobar',
  }[status]

  return (
    <div>
      <div className="overflow-hidden rounded-2xl border border-border-soft bg-card">
        <div
          className={cn(
            'flex min-h-13 items-center justify-between gap-3 px-4 py-2 text-[15px]',
            status === 'available' && 'bg-brand-tint',
          )}
        >
          <span className="flex min-w-0 flex-col gap-0.5">
            <span className="font-medium">
              {status === 'available' ? 'Hay una versión nueva' : `Versión del ${mine}`}
            </span>
            <span className="truncate text-[12.5px] text-subtle-foreground">{detail}</span>
          </span>
          {status === 'available' ? (
            <button
              type="button"
              onClick={pwa.applyUpdate}
              className="shrink-0 rounded-lg px-1 font-semibold text-primary outline-none hover:text-primary-hover focus-visible:ring-[3px] focus-visible:ring-ring/50"
            >
              Actualizar
            </button>
          ) : status === 'current' && (pwa.checkFailed || !pwa.lastCheckedAt) ? null : (
            <span
              className={cn(
                'flex shrink-0 items-center gap-1.5 font-medium whitespace-nowrap',
                status === 'current' ? 'text-success' : 'text-muted-foreground',
              )}
            >
              {status === 'current' && <Check aria-hidden className="size-4" strokeWidth={2.4} />}
              {status === 'offline' && <WifiOff aria-hidden className="size-4" strokeWidth={2.2} />}
              {{ current: 'Al día', checking: 'Buscando…', offline: 'Sin conexión' }[status]}
            </span>
          )}
        </div>
        {pwa.canInstall && (
          <button
            type="button"
            onClick={pwa.openInstall}
            className="flex min-h-13 w-full items-center justify-between gap-3 border-t border-border-soft px-4 py-2 text-left text-[15px] outline-none hover:bg-fill focus-visible:bg-fill"
          >
            <span className="flex flex-col gap-0.5">
              <span className="font-medium">Instalar en el iPhone</span>
              <span className="text-[12.5px] text-subtle-foreground">
                Un icono en tu pantalla de inicio
              </span>
            </span>
            <ChevronRight aria-hidden className="size-4 shrink-0 text-subtle-foreground" />
          </button>
        )}
      </div>
      <button
        type="button"
        disabled={!online || pwa.checking}
        onClick={pwa.checkForUpdate}
        className="mt-2.5 rounded-lg px-1 text-[13px] font-semibold text-primary outline-none hover:text-primary-hover focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:text-subtle-foreground"
      >
        {pwa.checking ? 'Buscando actualización…' : 'Buscar actualización'}
      </button>
    </div>
  )
}
