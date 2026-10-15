import { FileText, Lock, Search } from 'lucide-react'

import { ResponsiveSheet } from '@/components/ResponsiveSheet'

import type { DeviceUnlock } from '../passkey'
import { DesktopActions, HeaderCancel, MainAction, SheetPoint as Point } from './SheetParts'

interface ProtectNoteSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  isDesktop: boolean
  /** La primera línea de la nota: «Proteger «Wifi de casa»». */
  title: string
  unlock: DeviceUnlock
  onConfirm: () => void
}

/**
 * «Proteger «Wifi de casa»» (diseño 26, C6c): antes de proteger, tres cosas; la del medio en
 * negrita, porque la primera línea se sigue viendo en la lista y ahí no va la clave.
 */
export function ProtectNoteSheet({
  open,
  onOpenChange,
  isDesktop,
  title,
  unlock,
  onConfirm,
}: ProtectNoteSheetProps) {
  const action = (
    <MainAction isDesktop={isDesktop} type="button" onClick={onConfirm}>
      <Lock aria-hidden className="size-[18px]" strokeWidth={2.4} />
      Proteger
    </MainAction>
  )
  return (
    <ResponsiveSheet
      open={open}
      onOpenChange={onOpenChange}
      isDesktop={isDesktop}
      title={`Proteger «${title}»`}
      headerAction={<HeaderCancel />}
      closeHint
    >
      <ul className="flex flex-col gap-3.5 py-1">
        <Point icon={Lock}>
          El texto solo se ve al desbloquear, con {unlock.noun} o con tu clave.
        </Point>
        <Point icon={FileText}>
          <b className="font-bold">La primera línea se sigue viendo</b> en la lista. No pongas ahí
          la clave.
        </Point>
        <Point icon={Search}>
          Su texto no sale en Buscar, en lo que exportes ni en los avisos.
        </Point>
      </ul>
      {isDesktop ? <DesktopActions>{action}</DesktopActions> : action}
    </ResponsiveSheet>
  )
}
