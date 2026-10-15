import { useMutation } from '@tanstack/react-query'
import { WifiOff } from 'lucide-react'
import { useState } from 'react'

import { ResponsiveSheet } from '@/components/ResponsiveSheet'
import { PasswordField } from '@/features/auth'
import { useOnline } from '@/hooks/useOnline'

import type { PrivateVault } from '../api'
import { tryDeviceLabel, WRONG_KEY } from '../copy'
import { openWithKey } from '../operations'
import type { DeviceUnlock } from '../passkey'
import { DesktopActions, HeaderCancel, MainAction, TextAction } from './SheetParts'

interface UnlockSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  isDesktop: boolean
  vault: PrivateVault
  unlock: DeviceUnlock
  /** Viene de Face ID que no ha funcionado o se canceló (C3b). */
  deviceFailed: boolean
  /** Para ver las listas ocultas (diseño 27, D3b y E2): la hoja se llama «Listas ocultas». */
  forHidden: boolean
  /** Si este aparato tiene su llave: «Probar con Face ID». */
  onTryDevice: (() => void) | undefined
  onForgot: () => void
  onUnlocked: (key: CryptoKey) => void
}

/**
 * «Desbloquear» con la clave privada (diseño 26, C3b–C3e y D4–D5). Se comprueba en el aparato,
 * así que funciona sin red y lo dice. Abajo, «Probar con Face ID» si este aparato tiene su llave y
 * «He olvidado la clave».
 */
export function UnlockSheet(props: UnlockSheetProps) {
  const { open, onOpenChange, isDesktop, forHidden } = props
  return (
    <ResponsiveSheet
      open={open}
      onOpenChange={onOpenChange}
      isDesktop={isDesktop}
      title={forHidden ? 'Listas ocultas' : 'Desbloquear'}
      headerAction={<HeaderCancel />}
      closeHint
    >
      <UnlockForm {...props} />
    </ResponsiveSheet>
  )
}

function UnlockForm({
  isDesktop,
  vault,
  unlock,
  deviceFailed,
  forHidden,
  onTryDevice,
  onForgot,
  onUnlocked,
}: UnlockSheetProps) {
  const online = useOnline()
  const [key, setKey] = useState('')
  const [wrong, setWrong] = useState(false)
  const check = useMutation({
    mutationFn: (password: string) => openWithKey(vault, password),
    networkMode: 'always',
    onSuccess: (opened) => {
      if (opened) onUnlocked(opened)
      else setWrong(true)
    },
  })

  const notice = deviceFailed
    ? `${unlock.title} no ha funcionado. Escribe tu clave privada.`
    : forHidden
      ? 'Escribe tu clave privada para verlas.'
      : null
  const label = check.isPending ? 'Comprobando…' : 'Desbloquear'
  const disabled = key.length === 0 || check.isPending

  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault()
        if (!disabled) check.mutate(key)
      }}
      className="flex flex-col gap-3"
    >
      {!online ? (
        <p className="flex gap-2 text-[13.5px] leading-[1.45] text-muted-foreground">
          <WifiOff aria-hidden className="mt-0.5 size-3.5 shrink-0" strokeWidth={2.2} />
          Sin conexión. Se desbloquea igual: la clave se comprueba en este {unlock.device}.
        </p>
      ) : (
        notice && <p className="text-[13.5px] leading-[1.45] text-muted-foreground">{notice}</p>
      )}
      <PasswordField
        label="Clave privada"
        placeholder="Clave privada"
        autoComplete="off"
        data-1p-ignore
        autoFocus
        value={key}
        error={wrong ? WRONG_KEY : undefined}
        onChange={(event) => {
          setKey(event.target.value)
          setWrong(false)
        }}
      />
      {isDesktop ? (
        <>
          <DesktopActions>
            <MainAction isDesktop disabled={disabled}>
              {label}
            </MainAction>
          </DesktopActions>
          <Footer unlock={unlock} onTryDevice={onTryDevice} onForgot={onForgot} />
        </>
      ) : (
        <>
          <MainAction isDesktop={false} disabled={disabled}>
            {label}
          </MainAction>
          <Footer unlock={unlock} onTryDevice={onTryDevice} onForgot={onForgot} />
        </>
      )}
    </form>
  )
}

function Footer({
  unlock,
  onTryDevice,
  onForgot,
}: Pick<UnlockSheetProps, 'unlock' | 'onTryDevice' | 'onForgot'>) {
  return (
    <div className="flex h-9 items-center justify-between gap-3">
      {onTryDevice ? (
        <TextAction onClick={onTryDevice}>{tryDeviceLabel(unlock)}</TextAction>
      ) : (
        <span />
      )}
      <TextAction onClick={onForgot}>He olvidado la clave</TextAction>
    </div>
  )
}
