import { Bell, EyeOff, Lock } from 'lucide-react'

import { ResponsiveSheet } from '@/components/ResponsiveSheet'
import {
  DesktopActions,
  HeaderCancel,
  InfoBox,
  MainAction,
  SheetPoint,
  usePrivate,
} from '@/features/private'

import { hideSharedNote } from '../hidden'
import type { List } from '../types'

interface HideListSheetProps {
  list: List
  open: boolean
  onOpenChange: (open: boolean) => void
  isDesktop: boolean
  /** Es la lista por defecto de la captura (D1c): al ocultarla, la captura vuelve a «En mente». */
  isDefault: boolean
  /** Con quién está compartida (D7b): para ellos no cambia nada. */
  others: readonly { displayName: string | null }[]
  onConfirm: () => void
}

/**
 * «Ocultar «Regalos de Marta»» (diseño 27, D1b, D1c y D7b): dónde deja de verse, dónde se
 * encuentra y cómo llegan sus avisos. Si era la lista por defecto de la captura, o si está
 * compartida, una caja lo dice.
 */
export function HideListSheet({
  list,
  open,
  onOpenChange,
  isDesktop,
  isDefault,
  others,
  onConfirm,
}: HideListSheetProps) {
  const { unlock, deviceSupported } = usePrivate()
  const action = (
    <MainAction isDesktop={isDesktop} type="button" onClick={onConfirm}>
      <EyeOff aria-hidden className="size-[18px]" strokeWidth={2.2} />
      Ocultar
    </MainAction>
  )
  return (
    <ResponsiveSheet
      open={open}
      onOpenChange={onOpenChange}
      isDesktop={isDesktop}
      title={`Ocultar «${list.name}»`}
      headerAction={<HeaderCancel />}
      closeHint
    >
      <ul className="flex flex-col gap-3.5 py-1">
        <SheetPoint icon={EyeOff}>
          Desaparece de Inicio, Hoy, Buscar, la captura y el calendario.
        </SheetPoint>
        <SheetPoint icon={Lock}>
          Solo se ve en Perfil › Listas ocultas, con{' '}
          {deviceSupported === false ? 'tu clave privada' : `${unlock.noun} o tu clave privada`}.
        </SheetPoint>
        <SheetPoint icon={Bell}>
          Sus avisos te llegan sin título: «Tienes un aviso en una lista oculta».
        </SheetPoint>
      </ul>
      {isDefault && (
        <InfoBox>
          Es tu lista por defecto para capturar. Al ocultarla, la captura vuelve a guardar en{' '}
          <b className="font-bold">En mente</b>.
        </InfoBox>
      )}
      {others.length > 0 && <InfoBox>{hideSharedNote(others)}</InfoBox>}
      {isDesktop ? <DesktopActions>{action}</DesktopActions> : action}
    </ResponsiveSheet>
  )
}
