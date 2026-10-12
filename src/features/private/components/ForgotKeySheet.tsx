import { useMutation, useQuery } from '@tanstack/react-query'

import { ResponsiveSheet } from '@/components/ResponsiveSheet'
import { FormError } from '@/features/auth'
import { useOnline } from '@/hooks/useOnline'
import { isNetworkError } from '@/lib/errors'
import { queryKeys } from '@/lib/queryKeys'

import { countProtectedNotes, sendResetCode, type VaultDeviceKey } from '../api'
import { NEEDS_CONNECTION, protectedNotesLabel, SOMETHING_FAILED, tryDeviceLabel } from '../copy'
import type { DeviceUnlock } from '../passkey'
import { DeviceIcon } from './DeviceIcon'
import { DesktopActions, InfoBox, Lead, MainAction, TextAction } from './SheetParts'

interface ForgotKeySheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  isDesktop: boolean
  email: string
  /** La clave de la caja de ahora: cuántas notas protegidas se perderían. */
  keyId: string | null
  unlock: DeviceUnlock
  /** Si este aparato tiene su llave: «Antes, prueba a desbloquear con Face ID». */
  onTryDevice: (() => void) | undefined
  /** La llave de otro aparato, si la hay y aquí no: «Si en tu iPhone desbloqueas con Face ID…». */
  otherDevice: VaultDeviceKey | undefined
  onCodeSent: (sentAt: number) => void
}

/**
 * «He olvidado la clave», antes de seguir (diseño 26, C5b y D9). Dice lo que se pierde y propone
 * antes probar con Face ID, que abre la caja y deja cambiar la clave sin perder nada. Si no, otra
 * clave con un código a tu email (como en 11), porque crearla es cosa de la cuenta, no de quien
 * tenga el móvil abierto.
 */
export function ForgotKeySheet(props: ForgotKeySheetProps) {
  const { open, onOpenChange, isDesktop } = props
  return (
    <ResponsiveSheet
      open={open}
      onOpenChange={onOpenChange}
      isDesktop={isDesktop}
      title="¿Crear una clave nueva?"
      closeHint
    >
      <ForgotKeyBody {...props} />
    </ResponsiveSheet>
  )
}

function ForgotKeyBody({
  onOpenChange,
  isDesktop,
  email,
  keyId,
  unlock,
  onTryDevice,
  otherDevice,
  onCodeSent,
}: ForgotKeySheetProps) {
  const online = useOnline()
  const count = useQuery({
    queryKey: queryKeys.protectedCount(keyId ?? ''),
    queryFn: () => countProtectedNotes(keyId ?? ''),
    enabled: keyId !== null,
  }).data
  const send = useMutation({
    mutationFn: () => sendResetCode(email),
    networkMode: 'always',
    onSuccess: () => {
      onCodeSent(Date.now())
    },
  })
  const error = !online
    ? NEEDS_CONNECTION
    : send.error
      ? isNetworkError(send.error)
        ? NEEDS_CONNECTION
        : SOMETHING_FAILED
      : null
  const action = (
    <MainAction
      isDesktop={isDesktop}
      type="button"
      destructive
      disabled={send.isPending || !online}
      onClick={() => {
        send.mutate()
      }}
    >
      {send.isPending ? 'Enviando…' : 'Enviarme el código'}
    </MainAction>
  )

  return (
    <div className="flex flex-col gap-3">
      {count ? (
        <Lead>
          Sin la clave de ahora, el texto de tus{' '}
          <b className="font-bold text-foreground">{protectedNotesLabel(count)}</b> no se puede
          abrir y <b className="font-bold text-foreground">se perderá</b>. Sus primeras líneas se
          quedan, para que sepas cuáles eran.
        </Lead>
      ) : (
        <Lead>
          Sin la clave de ahora, lo que hayas protegido con ella no se puede abrir y{' '}
          <b className="font-bold text-foreground">se perderá</b>.
        </Lead>
      )}
      {onTryDevice ? (
        <InfoBox>
          Antes, prueba a desbloquear con {unlock.noun}. Si funciona, puedes cambiar la clave sin
          perder nada.{' '}
          <TextAction onClick={onTryDevice} className="align-baseline">
            <DeviceIcon unlock={unlock} className="size-3.5" strokeWidth={2.2} />
            {tryDeviceLabel(unlock)}
          </TextAction>
        </InfoBox>
      ) : (
        otherDevice && (
          <InfoBox>
            Si en tu {otherDevice.device} desbloqueas con {otherDevice.method}, hazlo desde allí:
            podrás cambiar la clave sin perder nada.
          </InfoBox>
        )
      )}
      <p className="text-[13.5px] leading-[1.45] text-muted-foreground">
        Para crear otra, te enviamos un código a {email}.
      </p>
      {error && <FormError message={error} />}
      {isDesktop ? (
        <DesktopActions>{action}</DesktopActions>
      ) : (
        <>
          {action}
          <button
            type="button"
            onClick={() => {
              onOpenChange(false)
            }}
            className="h-11 rounded-[14px] font-display text-[15px] font-bold text-muted-foreground outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            Cancelar
          </button>
        </>
      )}
    </div>
  )
}
