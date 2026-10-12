import { ResponsiveSheet } from '@/components/ResponsiveSheet'

import { deviceActionLabel } from '../copy'
import type { DeviceUnlock } from '../passkey'
import { DeviceIcon } from './DeviceIcon'
import { Lead, MainAction } from './SheetParts'

interface OfferDeviceKeySheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  isDesktop: boolean
  unlock: DeviceUnlock
  /** Viene de crear la clave: «Clave creada.» delante (C2d). */
  justCreated: boolean
  pending: boolean
  onAccept: () => void
}

/**
 * Ofrecer la llave de este aparato (diseño 26, C2d), justo al crear la clave: es como se
 * desbloqueará casi siempre. Solo sirve en este aparato.
 */
export function OfferDeviceKeySheet({
  open,
  onOpenChange,
  isDesktop,
  unlock,
  justCreated,
  pending,
  onAccept,
}: OfferDeviceKeySheetProps) {
  const question = `¿Usar ${unlock.noun} en este ${unlock.device}?`
  return (
    <ResponsiveSheet
      open={open}
      onOpenChange={onOpenChange}
      isDesktop={isDesktop}
      title={justCreated ? `Clave creada. ${question}` : question}
      icon={
        <span className="grid size-14 place-items-center rounded-[18px] bg-brand-tint text-primary">
          <DeviceIcon unlock={unlock} className="size-7" strokeWidth={2} />
        </span>
      }
    >
      <Lead>
        Así no tienes que escribir la clave cada vez. Solo sirve en este {unlock.device}; en otro
        aparato, la clave o su propio Face ID, huella o Windows Hello.
      </Lead>
      <div className="flex flex-col gap-1">
        <MainAction isDesktop={false} type="button" disabled={pending} onClick={onAccept}>
          <DeviceIcon unlock={unlock} className="size-[18px]" strokeWidth={2.2} />
          {pending ? 'Un momento…' : deviceActionLabel(unlock)}
        </MainAction>
        <button
          type="button"
          onClick={() => {
            onOpenChange(false)
          }}
          className="h-11 rounded-[14px] font-display text-[15px] font-bold text-muted-foreground outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          Ahora no
        </button>
      </div>
    </ResponsiveSheet>
  )
}
