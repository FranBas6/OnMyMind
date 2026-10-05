import { Bell, BellOff, ChevronRight } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { toast } from 'sonner'

import { Switch } from '@/components/Switch'
// Por sus rutas y no por el índice: `reminders` usa piezas de `profile`.
import { PushPrompt, type PushPromptKind } from '@/features/reminders/components/PushPrompt'
import { usePush } from '@/features/reminders/hooks/usePush'
import { askPermission } from '@/features/reminders/push'
import { deviceName } from '@/features/reminders/reminders'
import { cn } from '@/lib/utils'

import { useProfile } from '../hooks/useProfile'
import { useUpdateSettings } from '../hooks/useProfileMutations'

/** La hora del resumen si aún no se ha elegido (diseño 18, P1). */
const DEFAULT_SUMMARY_TIME = '08:00'

/**
 * «Avisos» de Perfil (diseño 18, P1–P5, P12 y D5–D6), entre Captura y App. Un interruptor para
 * este dispositivo, que cambia según su estado: bloqueados (con cómo arreglarlo), sin instalar
 * (con cómo instalar) o un navegador sin avisos. Debajo, «Resumen de Hoy» con su hora, en gris
 * mientras los avisos de aquí estén apagados. La hora se elige con la rueda del sistema en el
 * iPhone y con el campo de hora del navegador en escritorio.
 */
export function NotificationsSection({ isDesktop }: { isDesktop: boolean }) {
  const { state, enable, disable } = usePush()
  const profile = useProfile()
  const updateSettings = useUpdateSettings()
  const [prompt, setPrompt] = useState<PushPromptKind | null>(null)
  const device = deviceName(navigator.userAgent, navigator.maxTouchPoints)
  const ios = device !== 'este navegador'
  const on = state === 'on'
  const summary = profile.data?.settings.dailySummaryTime ?? null
  const pending = enable.isPending || disable.isPending

  const toggle = (next: boolean) => {
    if (!next) {
      disable.mutate()
      return
    }
    enable.mutate(askPermission(), {
      onSuccess: (result) => {
        if (result === 'on') toast(`Avisos activados en ${device}`)
        else if (result === 'denied') setPrompt('denied')
      },
    })
  }

  const label = `Avisos en ${device}`
  const deviceRow =
    state === 'denied' ? (
      <RowButton
        icon={BellOff}
        label={label}
        onClick={() => {
          setPrompt('denied')
        }}
      >
        <span className="font-semibold text-error">Bloqueados</span>
      </RowButton>
    ) : state === 'needs-install' ? (
      <RowButton
        icon={Bell}
        label="Instala la app para recibir avisos"
        onClick={() => {
          setPrompt('install')
        }}
      >
        <span className="font-semibold text-primary">Instalar</span>
      </RowButton>
    ) : state === 'unsupported' ? (
      <div className="flex h-13 items-center justify-between gap-3 px-4 text-[15px]">
        <span className="flex items-center gap-2.5 font-medium">
          <BellOff aria-hidden className="size-4 text-muted-foreground" strokeWidth={2} />
          {label}
        </span>
        <span className="text-muted-foreground">No disponibles</span>
      </div>
    ) : (
      <div className="flex h-13 items-center justify-between gap-3 px-4 text-[15px]">
        <span className="flex items-center gap-2.5 font-medium">
          {on ? (
            <Bell aria-hidden className="size-4 text-primary" strokeWidth={2} />
          ) : (
            <BellOff aria-hidden className="size-4 text-muted-foreground" strokeWidth={2} />
          )}
          {label}
        </span>
        {state !== undefined && (
          <Switch
            checked={on}
            onCheckedChange={(next) => {
              if (!pending) toggle(next)
            }}
            label={label}
          />
        )}
      </div>
    )

  const deviceNote =
    state === 'denied' ? (
      <>
        Están bloqueados en {ios ? 'Ajustes del iPhone' : 'los ajustes del navegador'}.{' '}
        <button
          type="button"
          onClick={() => {
            setPrompt('denied')
          }}
          className="font-semibold text-primary outline-none hover:text-primary-hover focus-visible:underline"
        >
          Cómo activarlos
        </button>
      </>
    ) : state === 'needs-install' ? (
      'En el iPhone, los avisos solo llegan con la app en la pantalla de inicio.'
    ) : state === 'unsupported' ? (
      'Este navegador no puede mostrar avisos. Llegan a donde los tengas activados.'
    ) : state === 'off' ? (
      'Tus avisos siguen guardados. Aquí no sonarán hasta que los actives.'
    ) : null

  return (
    <div className="flex flex-col gap-2">
      <div className="overflow-hidden rounded-2xl border border-border-soft bg-card">
        {deviceRow}
      </div>
      {deviceNote && <Note>{deviceNote}</Note>}

      <div
        className={cn(
          'mt-1 divide-y divide-border-soft overflow-hidden rounded-2xl border border-border-soft bg-card',
          !on && 'text-muted-foreground',
        )}
      >
        <div className="flex h-13 items-center justify-between gap-3 px-4 text-[15px] font-medium">
          Resumen de Hoy
          <Switch
            checked={on && summary !== null}
            disabled={!on}
            onCheckedChange={(next) => {
              updateSettings.mutate({ dailySummaryTime: next ? DEFAULT_SUMMARY_TIME : null })
            }}
            label="Resumen de Hoy"
          />
        </div>
        <label
          className={cn(
            'relative flex h-13 items-center justify-between gap-3 px-4 text-[15px]',
            on && summary !== null ? 'cursor-pointer' : 'opacity-60',
          )}
        >
          <span className="font-medium">Hora del resumen</span>
          {isDesktop ? (
            <input
              type="time"
              step={300}
              aria-label="Hora del resumen"
              disabled={!on || summary === null}
              value={summary ?? DEFAULT_SUMMARY_TIME}
              onChange={(event) => {
                if (event.target.value)
                  updateSettings.mutate({ dailySummaryTime: event.target.value })
              }}
              className="bg-transparent text-right font-semibold outline-none"
            />
          ) : (
            <>
              <span className="flex items-center gap-1.5 font-semibold">
                {summaryLabel(summary ?? DEFAULT_SUMMARY_TIME)}
                <ChevronRight
                  aria-hidden
                  className="size-4 text-subtle-foreground"
                  strokeWidth={2}
                />
              </span>
              {/* La rueda del sistema: el campo nativo va encima de la fila, invisible. */}
              <input
                type="time"
                step={300}
                aria-label="Hora del resumen"
                disabled={!on || summary === null}
                value={summary ?? DEFAULT_SUMMARY_TIME}
                onChange={(event) => {
                  if (event.target.value) {
                    updateSettings.mutate({ dailySummaryTime: event.target.value })
                  }
                }}
                className="absolute inset-0 cursor-pointer opacity-0 disabled:cursor-default"
              />
            </>
          )}
        </label>
      </div>
      <Note>
        {on
          ? 'Una vez al día, con lo que tienes para hoy. Si no hay nada, no llega.'
          : 'El resumen llega cuando los avisos están activados.'}
      </Note>

      <PushPrompt kind={prompt} onKindChange={setPrompt} device={device} isDesktop={isDesktop} />
    </div>
  )
}

/** «8:00» sin el cero delante, como dibuja el diseño. */
function summaryLabel(time: string): string {
  return time.replace(/^0(\d)/, '$1')
}

function Note({ children }: { children: ReactNode }) {
  return <p className="px-1 text-[13px] leading-normal text-muted-foreground">{children}</p>
}

function RowButton({
  icon: Icon,
  label,
  onClick,
  children,
}: {
  icon: typeof Bell
  label: string
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-13 w-full items-center justify-between gap-3 px-4 text-[15px] outline-none hover:bg-fill/50 focus-visible:bg-fill"
    >
      <span className="flex items-center gap-2.5 text-left font-medium">
        <Icon aria-hidden className="size-4 text-muted-foreground" strokeWidth={2} />
        {label}
      </span>
      <span className="flex items-center gap-1.5 whitespace-nowrap">
        {children}
        <ChevronRight aria-hidden className="size-4 text-subtle-foreground" strokeWidth={2} />
      </span>
    </button>
  )
}
