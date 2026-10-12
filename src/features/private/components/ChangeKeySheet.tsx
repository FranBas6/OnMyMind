import { useMutation } from '@tanstack/react-query'
import { useState } from 'react'

import { ResponsiveSheet } from '@/components/ResponsiveSheet'
import { FormError, PasswordField } from '@/features/auth'
import { useOnline } from '@/hooks/useOnline'
import { isNetworkError } from '@/lib/errors'

import type { PrivateVault } from '../api'
import {
  KEY_HINT,
  KEY_MISMATCH,
  NEEDS_CONNECTION,
  SOMETHING_FAILED,
  WRONG_CURRENT_KEY,
} from '../copy'
import { changeKey } from '../operations'
import type { DeviceUnlock } from '../passkey'
import { KEY_MIN_LENGTH } from '../vault'
import { DesktopActions, HeaderCancel, Lead, MainAction } from './SheetParts'

interface ChangeKeySheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  isDesktop: boolean
  vault: PrivateVault
  unlock: DeviceUnlock
  /** Si este aparato tiene su llave: «y Face ID sigue funcionando». */
  hasDeviceKey: boolean
  /**
   * Ya abierta con Face ID (desde «He olvidado la clave», C5b): no pide la de ahora, que es
   * justo la que se olvidó.
   */
  openedKey: CryptoKey | null
  onChanged: (key: CryptoKey) => void
}

/**
 * «Cambiar la clave» (diseño 26, C5): la de ahora, la nueva y repetirla. Lo protegido sigue igual
 * y Face ID sigue funcionando: solo se vuelve a cifrar la clave de la caja. Necesita conexión.
 */
export function ChangeKeySheet(props: ChangeKeySheetProps) {
  const { open, onOpenChange, isDesktop } = props
  return (
    <ResponsiveSheet
      open={open}
      onOpenChange={onOpenChange}
      isDesktop={isDesktop}
      title="Cambiar la clave"
      headerAction={<HeaderCancel />}
      closeHint
    >
      <ChangeKeyForm {...props} />
    </ResponsiveSheet>
  )
}

function ChangeKeyForm({
  isDesktop,
  vault,
  unlock,
  hasDeviceKey,
  openedKey,
  onChanged,
}: ChangeKeySheetProps) {
  const online = useOnline()
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [repeat, setRepeat] = useState('')
  const [wrongCurrent, setWrongCurrent] = useState(false)
  const [mismatch, setMismatch] = useState(false)
  const change = useMutation({
    mutationFn: () => changeKey(vault, openedKey ?? current, next),
    networkMode: 'always',
    onSuccess: (key) => {
      if (key) onChanged(key)
      else setWrongCurrent(true)
    },
  })

  const ready =
    (openedKey !== null || current.length > 0) &&
    next.length >= KEY_MIN_LENGTH &&
    repeat.length >= KEY_MIN_LENGTH &&
    !mismatch &&
    !wrongCurrent
  const disabled = !ready || change.isPending || !online
  const error = !online
    ? NEEDS_CONNECTION
    : change.error
      ? isNetworkError(change.error)
        ? NEEDS_CONNECTION
        : SOMETHING_FAILED
      : null
  const label = change.isPending ? 'Cambiando…' : 'Cambiar la clave'
  const action = (
    <MainAction isDesktop={isDesktop} disabled={disabled}>
      {label}
    </MainAction>
  )

  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault()
        if (disabled) return
        if (next !== repeat) {
          setMismatch(true)
          return
        }
        change.mutate()
      }}
      className="flex flex-col gap-3"
    >
      {openedKey && <Lead>Abierta con {unlock.noun}. Escribe la clave nueva.</Lead>}
      {!openedKey && (
        <PasswordField
          label="Clave de ahora"
          placeholder="Clave de ahora"
          autoComplete="off"
          data-1p-ignore
          autoFocus
          value={current}
          error={wrongCurrent ? WRONG_CURRENT_KEY : undefined}
          onChange={(event) => {
            setCurrent(event.target.value)
            setWrongCurrent(false)
          }}
        />
      )}
      <PasswordField
        label="Clave nueva"
        placeholder="Clave nueva"
        autoComplete="off"
        data-1p-ignore
        autoFocus={openedKey !== null}
        value={next}
        onChange={(event) => {
          setNext(event.target.value)
          setMismatch(false)
        }}
      />
      <PasswordField
        label="Repite la clave nueva"
        placeholder="Repítela"
        autoComplete="off"
        data-1p-ignore
        value={repeat}
        error={mismatch ? KEY_MISMATCH : undefined}
        hint={KEY_HINT}
        onChange={(event) => {
          setRepeat(event.target.value)
          setMismatch(false)
        }}
      />
      <p className="px-1 text-[13px] leading-normal text-muted-foreground">
        {hasDeviceKey
          ? `Lo que tienes protegido sigue igual y ${unlock.noun} sigue funcionando. Necesita conexión.`
          : 'Lo que tienes protegido sigue igual. Necesita conexión.'}
      </p>
      {error && <FormError message={error} />}
      {isDesktop ? <DesktopActions>{action}</DesktopActions> : action}
    </form>
  )
}
