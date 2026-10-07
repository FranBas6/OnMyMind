import { Link } from '@tanstack/react-router'
import { Bell, Pause, Users } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

import { Switch } from '@/components/Switch'
import { morningChange, usePriceAlert, usePriceHistory, useSetPriceAlert } from '@/features/prices'
import { useProfile, useUpdateSettings } from '@/features/profile'
import { PushPrompt, type PushPromptKind } from '@/features/reminders/components/PushPrompt'
import { usePush } from '@/features/reminders/hooks/usePush'
import { deviceName } from '@/features/reminders/reminders'
import { namesOf } from '@/features/sharing/copy'
import { useListSharing } from '@/features/sharing/hooks/useSharing'
import { cn } from '@/lib/utils'

import { alertTracking, hasStores } from '../stores'
import type { Item } from '../types'

/**
 * «Avisarme si baja» (diseño 22, A1–A7, T2, T3 y D1–D3), bajo el bloque de precio: solo en compras
 * que se miran solas, para no prometer nada en las demás. Es de cada uno: en una lista compartida,
 * el otro elige el suyo. Debajo, una línea según el caso, de la más a la menos importante:
 * - ya no se puede seguir: en pausa, sin perder la elección (T3);
 * - callado desde Perfil: el general está apagado y tocarlo lo vuelve a encender (A6);
 * - recién encendido con el general apagado, que se enciende también (A3);
 * - este dispositivo no puede sonar (A5);
 * - bajó o subió esta mañana (P2, P3), con varias tiendas (T2) o compartida (A7).
 */
export function PriceAlertCard({ item, isDesktop }: { item: Item; isDesktop: boolean }) {
  const on = usePriceAlert(item.id)
  const setAlert = useSetPriceAlert()
  const profile = useProfile()
  const updateSettings = useUpdateSettings()
  const { state: push } = usePush()
  const sharing = useListSharing(item.listId)
  const [justEnabled, setJustEnabled] = useState(false)
  const [prompt, setPrompt] = useState<PushPromptKind | null>(null)
  // Si bajó o subió sola esta mañana: el mismo histórico que pide el bloque de precio.
  const history = usePriceHistory(item.id, item.priceCents, item.previousPriceCents !== null)
  const morning = history.data
    ? (morningChange(history.data, item.currency)?.direction ?? null)
    : null
  const tracking = alertTracking(item)
  const general = profile.data?.settings.priceDropAlerts ?? false
  const device = deviceName(navigator.userAgent, navigator.maxTouchPoints)

  if (!tracking || item.status !== 'pending') return null

  const stopped = tracking === 'stopped'
  const silenced = on && !general
  // Lo que falta en este dispositivo para que suene: la hoja de activar de 18 (A4).
  const pushPrompt: PushPromptKind | null =
    push === 'off'
      ? 'activate'
      : push === 'denied'
        ? 'denied'
        : push === 'needs-install'
          ? 'install'
          : null

  const enableGeneral = () => {
    updateSettings.mutate({ priceDropAlerts: true })
    setJustEnabled(true)
    toast('Bajadas de precio activadas', {
      action: {
        label: 'Deshacer',
        onClick: () => {
          updateSettings.mutate({ priceDropAlerts: false })
          setJustEnabled(false)
        },
      },
    })
  }

  const toggle = (next: boolean) => {
    // Callado desde Perfil: tocarlo vuelve a encender el general, sin apagar el de la compra (A6).
    if (silenced) {
      enableGeneral()
      return
    }
    setAlert(item.id, next)
    if (!next) {
      setJustEnabled(false)
      return
    }
    if (!general) enableGeneral()
    if (pushPrompt) setPrompt(pushPrompt)
  }

  const note = stopped ? (
    'En pausa mientras no se pueda seguir. Tu elección se guarda.'
  ) : silenced ? (
    'Callado: «Bajadas de precio» está apagado en Perfil. Si lo tocas, se vuelve a encender.'
  ) : on && justEnabled ? (
    <span className="text-primary">
      También hemos encendido «Bajadas de precio» en Perfil, que estaba apagado.{' '}
      <Link
        to="/profile"
        className="font-semibold outline-none hover:text-primary-hover focus-visible:underline"
      >
        Ver en Perfil
      </Link>
    </span>
  ) : on && pushPrompt ? (
    <>
      No sonará en {device} hasta que actives los avisos.{' '}
      <button
        type="button"
        onClick={() => {
          setPrompt(pushPrompt)
        }}
        className="font-semibold text-primary outline-none hover:text-primary-hover focus-visible:underline"
      >
        Activar
      </button>
    </>
  ) : on && morning === 'down' ? (
    'Te avisamos esta mañana a las 9:00.'
  ) : on && morning === 'up' ? (
    'Las subidas no avisan.'
  ) : on && hasStores(item) ? (
    'Te avisamos si baja la más barata.'
  ) : on && sharing.others.length > 0 ? (
    <span className="flex items-start gap-1.5">
      <Users aria-hidden className="mt-0.5 size-3.5 shrink-0" strokeWidth={2.2} />
      Solo para ti. {namesOf(sharing.others)}{' '}
      {sharing.others.length === 1 ? 'elige el suyo' : 'eligen el suyo'}.
    </span>
  ) : null

  const dimmed = stopped || silenced
  const Icon = stopped ? Pause : Bell

  return (
    <div className="flex flex-col gap-2">
      <div
        className={cn(
          'flex h-13 items-center justify-between gap-3 rounded-[20px] border px-4 text-[15px]',
          on && justEnabled && !dimmed
            ? 'border-brand-tint bg-brand-tint'
            : 'border-border-soft bg-background',
        )}
      >
        <span
          className={cn('flex items-center gap-2.5 font-medium', dimmed && 'text-muted-foreground')}
        >
          <Icon
            aria-hidden
            className={cn('size-4', on && !dimmed ? 'text-primary' : 'text-muted-foreground')}
            strokeWidth={2}
          />
          Avisarme si baja
        </span>
        <Switch
          checked={on}
          onCheckedChange={toggle}
          label="Avisarme si baja"
          className={cn(dimmed && on && 'opacity-50')}
        />
      </div>
      {note && <p className="px-1 text-[13px] leading-normal text-muted-foreground">{note}</p>}
      <PushPrompt
        kind={prompt}
        onKindChange={setPrompt}
        device={device}
        priceAlert={item.title}
        isDesktop={isDesktop}
        nested
      />
    </div>
  )
}
