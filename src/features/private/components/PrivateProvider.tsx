import { onlineManager, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, Lock } from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'

import { useSession } from '@/features/auth'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import { queryKeys } from '@/lib/queryKeys'
import { showUndoToast } from '@/lib/undoToast'

import { removeVaultDeviceKey, type PrivateVaultState } from '../api'
import { NEEDS_CONNECTION, newKeyMessage, SOMETHING_FAILED, unsupportedNote } from '../copy'
import {
  clearDeviceKey,
  markPrfUnsupported,
  prfUnsupportedHere,
  readDeviceKey,
  saveDeviceKey,
} from '../deviceKey'
import { privateVaultQueryOptions } from '../queries'
import { addDeviceKey, openWithDevice, openWithKey, type CreatedKey } from '../operations'
import { canUsePasskeys, currentDeviceUnlock, PasskeyFailure } from '../passkey'
import { PrivateContext, type PrivateContextValue, type PrivatePurpose } from '../privateContext'
import {
  getUnlocked,
  lock,
  subscribeUnlocked,
  unlock as keepUnlocked,
  useUnlocked,
  withoutAutoLock,
} from '../unlock'
import { ChangeKeySheet } from './ChangeKeySheet'
import { CreateKeySheet } from './CreateKeySheet'
import { ForgotKeySheet } from './ForgotKeySheet'
import { OfferDeviceKeySheet } from './OfferDeviceKeySheet'
import { ProtectNoteSheet } from './ProtectNoteSheet'
import { ResetCodeSheet } from './ResetCodeSheet'
import { UnlockSheet } from './UnlockSheet'

/** La hoja abierta: una cada vez, y unas llevan a otras («He olvidado la clave» → código → nueva). */
type Sheet =
  | { kind: 'create'; reset: boolean; purpose?: PrivatePurpose }
  | { kind: 'protect'; title: string }
  | { kind: 'unlock'; deviceFailed: boolean; forHidden: boolean }
  | { kind: 'change'; openedKey: CryptoKey | null }
  | { kind: 'forgot' }
  | { kind: 'code'; sentAt: number }
  | { kind: 'offer'; justCreated: boolean }

const PASSKEYS_KEY = ['passkeys-available'] as const

function notify(message: string, icon = Check) {
  showUndoToast({ icon, message })
}

/**
 * La clave privada en toda la app (5.6, diseño 26): su estado, desbloquear y las hojas de crear,
 * desbloquear, cambiar y olvidar la clave, y la de la llave de este aparato. Va una vez, en el
 * layout privado. Al salir de la cuenta, se bloquea.
 */
export function PrivateProvider({ children }: { children: ReactNode }) {
  const isDesktop = useMediaQuery('(min-width: 768px)')
  const session = useSession()
  const user = session.status === 'authenticated' ? session.session.user : null
  const userId = user?.id
  const queryClient = useQueryClient()
  const vaultQuery = useQuery({ ...privateVaultQueryOptions(), enabled: userId !== undefined })
  // Lo que puede este aparato: no es de la cuenta, así que no se guarda con la caché.
  const support = useQuery({
    queryKey: PASSKEYS_KEY,
    queryFn: canUsePasskeys,
    staleTime: Infinity,
    meta: { private: true },
  })
  const unlocked = useUnlocked()
  const [unlock] = useState(currentDeviceUnlock)
  const [sheet, setSheet] = useState<Sheet | null>(null)
  // Lo de este aparato vive en `localStorage`: esto vuelve a leerlo tras cambiarlo.
  const [, setDeviceVersion] = useState(0)
  const deviceChanged = () => {
    setDeviceVersion((version) => version + 1)
  }
  const pending = useRef<((ok: boolean) => void) | null>(null)

  // Otra cuenta, o ninguna: lo desbloqueado no es suyo.
  useEffect(
    () => () => {
      lock()
    },
    [userId],
  )

  // Al bloquear, se olvida el texto descifrado de las notas protegidas (5.7).
  useEffect(
    () =>
      subscribeUnlocked(() => {
        if (!getUnlocked()) queryClient.removeQueries({ queryKey: queryKeys.openedNotes })
      }),
    [queryClient],
  )

  const vault = vaultQuery.data?.vault ?? null
  const keys = vaultQuery.data?.keys ?? []
  const marker = userId ? readDeviceKey(userId) : null
  const deviceKey = (marker && keys.find((key) => key.id === marker.keyRowId)) ?? null
  const otherKeys = keys.filter((key) => key.id !== deviceKey?.id)
  const deviceSupported =
    support.data === undefined ? undefined : support.data && !prfUnsupportedHere()

  const settle = (ok: boolean) => {
    pending.current?.(ok)
    pending.current = null
  }
  const refresh = () => queryClient.invalidateQueries({ queryKey: queryKeys.privateVault })

  const unsupported = () => {
    markPrfUnsupported()
    deviceChanged()
    notify(unsupportedNote(unlock), Lock)
  }

  /** Face ID con la llave de este aparato: después, desbloqueado o «Cambiar la clave» (C5b). */
  const tryDevice = async (then: 'unlock' | 'change', forHidden = false) => {
    if (!vault || !deviceKey) return
    try {
      const key = await withoutAutoLock(() => openWithDevice(vault, deviceKey))
      keepUnlocked(key, vault.keyId)
      if (then === 'change') {
        setSheet({ kind: 'change', openedKey: key })
      } else {
        setSheet(null)
        settle(true)
      }
    } catch (error) {
      if (error instanceof PasskeyFailure && error.problem === 'unsupported') unsupported()
      if (then === 'unlock') setSheet({ kind: 'unlock', deviceFailed: true, forHidden })
      else notify(`${unlock.title} no ha funcionado.`, Lock)
    }
  }

  /** Espera a lo que se haga en una hoja: `true` si sale bien, `false` si se cierra. */
  const waitFor = (next: Sheet | null) => {
    settle(false)
    const promise = new Promise<boolean>((resolve) => {
      pending.current = resolve
    })
    if (next) setSheet(next)
    return promise
  }

  const requestUnlock = ({ withKey = false, forHidden = false } = {}) => {
    if (getUnlocked()) return Promise.resolve(true)
    if (!vault) return Promise.resolve(false)
    const useDevice = !withKey && deviceKey !== null && deviceSupported === true
    const promise = waitFor(useDevice ? null : { kind: 'unlock', deviceFailed: false, forHidden })
    if (useDevice) void tryDevice('unlock', forHidden)
    return promise
  }

  // «Proteger» (C6–C6c): sin clave, antes se crea; después se confirma y se desbloquea.
  const protectNote = async (title: string) => {
    if (
      !vault &&
      !(await waitFor({ kind: 'create', reset: false, purpose: { kind: 'note', title } }))
    ) {
      return false
    }
    if (!(await waitFor({ kind: 'protect', title }))) return false
    return requestUnlock()
  }

  // Ocultar una lista (diseño 27, D1): sin clave, antes se crea (D3c). Ocultar no la necesita
  // para nada, pero sin ella no habría con qué verlas.
  const ensureKey = () =>
    vault
      ? Promise.resolve(true)
      : waitFor({ kind: 'create', reset: false, purpose: { kind: 'hidden' } })

  // «Listas ocultas» (D3–D3c): sin clave se crea, y crearla ya deja desbloqueado.
  const openHidden = ({ withKey = false } = {}) =>
    vault ? requestUnlock({ withKey, forHidden: true }) : ensureKey()

  // Con la clave escrita en la ficha bloqueada, en escritorio (D4).
  const openWithPassword = async (password: string) => {
    if (!vault) return false
    const key = await openWithKey(vault, password)
    if (!key) return false
    keepUnlocked(key, vault.keyId)
    return true
  }

  const enroll = useMutation({
    mutationFn: (key: CryptoKey) => {
      if (!vault || !user?.email) throw new Error('Sin clave privada')
      const email = user.email
      return withoutAutoLock(() => addDeviceKey({ vault, key, userId: user.id, email, unlock }))
    },
    networkMode: 'always',
    onSuccess: (added) => {
      if (userId) saveDeviceKey({ userId, keyRowId: added.id })
      queryClient.setQueryData<PrivateVaultState>(queryKeys.privateVault, (state) =>
        state ? { ...state, keys: [...state.keys, added] } : state,
      )
      deviceChanged()
      setSheet(null)
      notify(`${unlock.title} listo en este ${unlock.device}`)
      void refresh()
    },
    onError: (error) => {
      setSheet(null)
      if (error instanceof PasskeyFailure) {
        if (error.problem === 'unsupported') unsupported()
        // Cancelada: se queda como estaba, sin aviso.
        if (error.problem !== 'failed') return
      }
      notify(onlineManager.isOnline() ? SOMETHING_FAILED : NEEDS_CONNECTION, Lock)
    },
  })

  const removeDevice = useMutation({
    mutationFn: removeVaultDeviceKey,
    networkMode: 'always',
    onSuccess: (_result, id) => {
      clearDeviceKey()
      queryClient.setQueryData<PrivateVaultState>(queryKeys.privateVault, (state) =>
        state ? { ...state, keys: state.keys.filter((key) => key.id !== id) } : state,
      )
      deviceChanged()
      notify(`${unlock.title} quitado de este ${unlock.device}`)
      void refresh()
    },
    onError: () => {
      notify(onlineManager.isOnline() ? SOMETHING_FAILED : NEEDS_CONNECTION, Lock)
    },
  })

  const setDeviceKey = (on: boolean) => {
    if (!vault || !user) return
    if (!onlineManager.isOnline()) {
      notify(NEEDS_CONNECTION, Lock)
      return
    }
    if (!on) {
      if (deviceKey) removeDevice.mutate(deviceKey.id)
      return
    }
    void (async () => {
      const ok = await requestUnlock()
      const current = getUnlocked()
      if (ok && current) enroll.mutate(current.key)
    })()
  }

  const created = ({ vault: next, key }: CreatedKey, reset: boolean, purpose?: PrivatePurpose) => {
    // Las notas protegidas con la de antes se quedan sin texto (C5d).
    const lost =
      reset && vault ? queryClient.getQueryData<number>(queryKeys.protectedCount(vault.keyId)) : 0
    if (reset) {
      clearDeviceKey()
      deviceChanged()
    }
    queryClient.setQueryData<PrivateVaultState>(queryKeys.privateVault, { vault: next, keys: [] })
    keepUnlocked(key, next.keyId)
    void refresh()
    // Otra clave: lo dice siempre, con lo que se quedó sin texto (C5d).
    if (reset) notify(newKeyMessage(lost ?? 0))
    // Para proteger una nota (C6b) u ocultar una lista (D3c), se sigue con ello; Face ID se
    // ofrece en Perfil.
    if (deviceSupported && purpose === undefined) {
      setSheet({ kind: 'offer', justCreated: true })
    } else {
      setSheet(null)
      if (!reset) notify('Clave creada')
      settle(true)
    }
  }

  const close = (open: boolean) => {
    if (open) return
    settle(false)
    setSheet(null)
  }

  const value: PrivateContextValue = {
    status: vaultQuery.isError ? 'error' : vaultQuery.data ? 'ready' : 'loading',
    vault,
    deviceKey,
    otherKeys,
    deviceSupported,
    unlock,
    unlocked: unlocked !== null,
    requestUnlock,
    ensureKey,
    openHidden,
    openWithPassword,
    protectNote,
    lock: () => {
      lock()
    },
    create: () => {
      setSheet({ kind: 'create', reset: false })
    },
    change: () => {
      setSheet({ kind: 'change', openedKey: null })
    },
    forgot: () => {
      setSheet({ kind: 'forgot' })
    },
    setDeviceKey,
  }

  return (
    <PrivateContext value={value}>
      {children}
      <CreateKeySheet
        open={sheet?.kind === 'create'}
        onOpenChange={close}
        isDesktop={isDesktop}
        unlock={unlock}
        reset={sheet?.kind === 'create' && sheet.reset}
        purpose={sheet?.kind === 'create' ? sheet.purpose : undefined}
        onCreated={(result) => {
          if (sheet?.kind === 'create') created(result, sheet.reset, sheet.purpose)
        }}
      />
      <ProtectNoteSheet
        open={sheet?.kind === 'protect'}
        onOpenChange={close}
        isDesktop={isDesktop}
        title={sheet?.kind === 'protect' ? sheet.title : ''}
        unlock={unlock}
        onConfirm={() => {
          setSheet(null)
          settle(true)
        }}
      />
      {vault && (
        <UnlockSheet
          open={sheet?.kind === 'unlock'}
          onOpenChange={close}
          isDesktop={isDesktop}
          vault={vault}
          unlock={unlock}
          deviceFailed={sheet?.kind === 'unlock' && sheet.deviceFailed}
          forHidden={sheet?.kind === 'unlock' && sheet.forHidden}
          onTryDevice={
            deviceKey && deviceSupported
              ? () => {
                  void tryDevice('unlock', sheet?.kind === 'unlock' && sheet.forHidden)
                }
              : undefined
          }
          onForgot={() => {
            settle(false)
            setSheet({ kind: 'forgot' })
          }}
          onUnlocked={(key) => {
            keepUnlocked(key, vault.keyId)
            setSheet(null)
            settle(true)
          }}
        />
      )}
      {vault && (
        <ChangeKeySheet
          open={sheet?.kind === 'change'}
          onOpenChange={close}
          isDesktop={isDesktop}
          vault={vault}
          unlock={unlock}
          hasDeviceKey={deviceKey !== null}
          openedKey={sheet?.kind === 'change' ? sheet.openedKey : null}
          onChanged={(key) => {
            keepUnlocked(key, vault.keyId)
            setSheet(null)
            notify('Clave cambiada')
            void refresh()
          }}
        />
      )}
      {user?.email && (
        <ForgotKeySheet
          open={sheet?.kind === 'forgot'}
          onOpenChange={close}
          isDesktop={isDesktop}
          email={user.email}
          keyId={vault?.keyId ?? null}
          unlock={unlock}
          onTryDevice={
            deviceKey && deviceSupported
              ? () => {
                  void tryDevice('change')
                }
              : undefined
          }
          otherDevice={otherKeys[0]}
          onCodeSent={(sentAt) => {
            setSheet({ kind: 'code', sentAt })
          }}
        />
      )}
      {user?.email && sheet?.kind === 'code' && (
        <ResetCodeSheet
          open
          onOpenChange={close}
          isDesktop={isDesktop}
          email={user.email}
          sentAt={sheet.sentAt}
          onResent={(sentAt) => {
            setSheet({ kind: 'code', sentAt })
          }}
          onVerified={() => {
            setSheet({ kind: 'create', reset: true })
          }}
        />
      )}
      <OfferDeviceKeySheet
        open={sheet?.kind === 'offer'}
        onOpenChange={close}
        isDesktop={isDesktop}
        unlock={unlock}
        justCreated={sheet?.kind === 'offer' && sheet.justCreated}
        pending={enroll.isPending}
        onAccept={() => {
          const current = getUnlocked()
          if (current) enroll.mutate(current.key)
        }}
      />
    </PrivateContext>
  )
}
