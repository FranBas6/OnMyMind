import { ChevronRight, Key, Lock } from 'lucide-react'
import type { ReactNode } from 'react'

import { Switch } from '@/components/Switch'
import { showUndoToast } from '@/lib/undoToast'
import { cn } from '@/lib/utils'

import { AUTO_LOCK_NOTE, deviceKeyLabel, ONE_KEY_NOTE, unsupportedNote } from '../copy'
import { usePrivate } from '../privateContext'
import { DeviceIcon } from './DeviceIcon'

const ROW = 'flex h-13 w-full items-center justify-between gap-3 px-4 text-left text-[15px]'
const BUTTON_ROW = cn(
  ROW,
  'outline-none hover:bg-fill/50 focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:ring-inset',
)

/**
 * «Privado» de Perfil (diseño 26, C1, C1b, C4, D1 y D2), entre Captura y Avisos: «Clave privada»
 * (Crear o Creada) y, creada, la llave de este aparato con su interruptor, «Cambiar la clave» y
 * «He olvidado la clave». Donde el aparato no la permite, «Solo con la clave en este ordenador» y
 * por qué. Tocar «Creada» desbloquea, y «Desbloqueada», bloquea.
 */
export function PrivateSection() {
  const privacy = usePrivate()
  const { vault, unlock, deviceSupported, deviceKey, unlocked } = privacy

  if (privacy.status !== 'ready') {
    return (
      <div className="overflow-hidden rounded-2xl border border-border-soft bg-card">
        <div className={cn(ROW, 'text-muted-foreground')}>
          <Label icon={<Key aria-hidden className="size-4" strokeWidth={2} />}>Clave privada</Label>
          <span>{privacy.status === 'error' ? 'Sin conexión' : '…'}</span>
        </div>
      </div>
    )
  }

  if (!vault) {
    return (
      <div className="flex flex-col gap-2">
        <div className="overflow-hidden rounded-2xl border border-border-soft bg-card">
          <button type="button" onClick={privacy.create} className={BUTTON_ROW}>
            <Label
              icon={<Key aria-hidden className="size-4 text-muted-foreground" strokeWidth={2} />}
            >
              Clave privada
            </Label>
            <Value>
              <span className="font-semibold text-primary">Crear</span>
            </Value>
          </button>
        </div>
        <Note>{ONE_KEY_NOTE}</Note>
      </div>
    )
  }

  const deviceRow =
    deviceSupported === false ? (
      <div className={cn(ROW, 'text-muted-foreground')}>
        <Label icon={<Lock aria-hidden className="size-4" strokeWidth={2} />}>
          Solo con la clave en este {unlock.device}
        </Label>
      </div>
    ) : (
      <div className={ROW}>
        <Label
          icon={
            <DeviceIcon
              unlock={unlock}
              className={cn('size-4', deviceKey ? 'text-primary' : 'text-muted-foreground')}
              strokeWidth={2}
            />
          }
        >
          {deviceKeyLabel(unlock)}
        </Label>
        <Switch
          checked={deviceKey !== null}
          disabled={deviceSupported === undefined}
          onCheckedChange={privacy.setDeviceKey}
          label={deviceKeyLabel(unlock)}
        />
      </div>
    )

  return (
    <div className="flex flex-col gap-2">
      <div className="divide-y divide-border-soft overflow-hidden rounded-2xl border border-border-soft bg-card">
        <button
          type="button"
          onClick={() => {
            if (unlocked) {
              privacy.lock()
              showUndoToast({ icon: Lock, message: 'Bloqueada' })
            } else {
              void privacy.requestUnlock()
            }
          }}
          className={BUTTON_ROW}
        >
          <Label
            icon={<Key aria-hidden className="size-4 text-muted-foreground" strokeWidth={2} />}
          >
            Clave privada
          </Label>
          <Value>
            {unlocked ? (
              <span className="font-semibold text-primary">Desbloqueada</span>
            ) : (
              <span className="text-muted-foreground">Creada</span>
            )}
          </Value>
        </button>
        {deviceRow}
        <button type="button" onClick={privacy.change} className={BUTTON_ROW}>
          <span className="font-medium">Cambiar la clave</span>
          <ChevronRight aria-hidden className="size-4 text-subtle-foreground" strokeWidth={2} />
        </button>
        <button
          type="button"
          onClick={privacy.forgot}
          className={cn(BUTTON_ROW, 'font-medium text-primary')}
        >
          He olvidado la clave
        </button>
      </div>
      <Note>{deviceSupported === false ? unsupportedNote(unlock) : AUTO_LOCK_NOTE}</Note>
    </div>
  )
}

function Label({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <span className="flex min-w-0 items-center gap-2.5 font-medium">
      {icon}
      <span className="truncate">{children}</span>
    </span>
  )
}

function Value({ children }: { children: ReactNode }) {
  return (
    <span className="flex shrink-0 items-center gap-1.5">
      {children}
      <ChevronRight aria-hidden className="size-4 text-subtle-foreground" strokeWidth={2} />
    </span>
  )
}

function Note({ children }: { children: ReactNode }) {
  return <p className="px-1 text-[13px] leading-normal text-muted-foreground">{children}</p>
}
