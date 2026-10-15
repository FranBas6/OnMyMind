import { useMutation } from '@tanstack/react-query'
import { useId, useState } from 'react'

import { ResponsiveSheet } from '@/components/ResponsiveSheet'
import { FormError, PasswordField } from '@/features/auth'
import { useOnline } from '@/hooks/useOnline'
import { isNetworkError } from '@/lib/errors'

import { KEY_HINT, KEY_MISMATCH, NEEDS_CONNECTION, passwordsApp, SOMETHING_FAILED } from '../copy'
import { createKey, type CreatedKey } from '../operations'
import type { DeviceUnlock } from '../passkey'
import type { PrivatePurpose } from '../privateContext'
import { KEY_MIN_LENGTH } from '../vault'
import { DesktopActions, HeaderCancel, InfoBox, Lead, MainAction } from './SheetParts'

interface CreateKeySheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  isDesktop: boolean
  unlock: DeviceUnlock
  /** Otra en lugar de la de antes, tras el código por email (C5c). */
  reset: boolean
  /**
   * Para qué, si viene de algo que la necesita: «Proteger» sin clave aún (C6b, «Para proteger
   * «Wifi de casa» hace falta una clave.») o las listas ocultas (diseño 27, D3c).
   */
  purpose?: PrivatePurpose | undefined
  onCreated: (created: CreatedKey) => void
}

/**
 * «Crea tu clave privada» (diseño 26, C2–C2c y D3): qué es, escribirla dos veces y la advertencia
 * de olvidarla. Mínimo 4 caracteres (un PIN vale), sin más reglas. Necesita conexión: la caja se guarda en tu
 * cuenta. Tras el código de «He olvidado la clave», crea la nueva en lugar de la de antes.
 */
export function CreateKeySheet({
  open,
  onOpenChange,
  isDesktop,
  unlock,
  reset,
  purpose,
  onCreated,
}: CreateKeySheetProps) {
  return (
    <ResponsiveSheet
      open={open}
      onOpenChange={onOpenChange}
      isDesktop={isDesktop}
      title={
        reset
          ? 'Crea tu clave nueva'
          : purpose !== undefined
            ? 'Antes, crea tu clave privada'
            : 'Crea tu clave privada'
      }
      headerAction={<HeaderCancel />}
      closeHint
    >
      <CreateKeyForm
        isDesktop={isDesktop}
        unlock={unlock}
        reset={reset}
        purpose={purpose}
        onCreated={onCreated}
      />
    </ResponsiveSheet>
  )
}

function CreateKeyForm({
  isDesktop,
  unlock,
  reset,
  purpose,
  onCreated,
}: Pick<CreateKeySheetProps, 'isDesktop' | 'unlock' | 'reset' | 'purpose' | 'onCreated'>) {
  const formId = useId()
  const online = useOnline()
  const [key, setKey] = useState('')
  const [repeat, setRepeat] = useState('')
  const [mismatch, setMismatch] = useState(false)
  const create = useMutation({
    mutationFn: (password: string) => createKey(password, { reset }),
    networkMode: 'always',
    onSuccess: onCreated,
  })

  const ready = key.length >= KEY_MIN_LENGTH && repeat.length >= KEY_MIN_LENGTH && !mismatch
  const submit = () => {
    if (!ready || create.isPending) return
    if (key !== repeat) {
      setMismatch(true)
      return
    }
    create.mutate(key)
  }
  const error = !online
    ? NEEDS_CONNECTION
    : create.error
      ? isNetworkError(create.error)
        ? NEEDS_CONNECTION
        : SOMETHING_FAILED
      : null
  const label = create.isPending ? 'Creando…' : 'Crear clave'

  return (
    <form
      id={formId}
      noValidate
      onSubmit={(event) => {
        event.preventDefault()
        submit()
      }}
      className="flex flex-col gap-3"
    >
      {purpose?.kind === 'hidden' ? (
        <Lead>
          Las listas ocultas se abren con la misma clave que tus notas protegidas, o con{' '}
          {unlock.noun}. Se crea una vez.
        </Lead>
      ) : (
        <Lead>
          {purpose?.kind === 'note' && `Para proteger «${purpose.title}» hace falta una clave. `}
          Es una sola clave para lo privado: la del wifi, el código de la alarma o del candado. Para
          las contraseñas del banco o del correo, mejor {passwordsApp(unlock)}.
        </Lead>
      )}
      <PasswordField
        label="Clave privada"
        placeholder="Clave privada"
        autoComplete="off"
        data-1p-ignore
        autoFocus
        value={key}
        onChange={(event) => {
          setKey(event.target.value)
          setMismatch(false)
        }}
      />
      <PasswordField
        label="Repite la clave"
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
      {purpose?.kind === 'hidden' ? (
        <InfoBox>
          Si la olvidas, podrás crear otra. Tus listas ocultas no se pierden: vuelven a verse con la
          clave nueva. Lo que se pierde son las notas protegidas.
        </InfoBox>
      ) : (
        <InfoBox>
          Si la olvidas, podrás crear otra, pero{' '}
          <b className="font-bold">lo que protegiste con esta se pierde</b>. No la guardamos, así
          que no podemos recuperarla.
        </InfoBox>
      )}
      {error && <FormError message={error} />}
      {isDesktop ? (
        <DesktopActions>
          <MainAction isDesktop disabled={!ready || create.isPending || !online}>
            {label}
          </MainAction>
        </DesktopActions>
      ) : (
        <MainAction isDesktop={false} disabled={!ready || create.isPending || !online}>
          {label}
        </MainAction>
      )}
    </form>
  )
}
