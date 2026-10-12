import { createContext, useContext } from 'react'

import type { PrivateVault, VaultDeviceKey } from './api'
import type { DeviceUnlock } from './passkey'

/** Lo que sabe la app de la clave privada de quien la usa (5.6). */
export interface PrivateState {
  /** `loading` mientras llega la caja (o sin red y sin caché); `ready` con ella o sin ella. */
  status: 'loading' | 'error' | 'ready'
  /** `null`: aún no hay clave privada. */
  vault: PrivateVault | null
  /** La llave de este aparato, si la hay. */
  deviceKey: VaultDeviceKey | null
  /** Las de otros aparatos («Si en tu iPhone desbloqueas con Face ID…»). */
  otherKeys: VaultDeviceKey[]
  /** Si aquí se puede usar Face ID, la huella, Touch ID o Windows Hello; `undefined` mientras se mira. */
  deviceSupported: boolean | undefined
  /** Cómo se llama aquí: Face ID en este iPhone, Touch ID en este Mac… */
  unlock: DeviceUnlock
  unlocked: boolean
}

export interface PrivateActions {
  /**
   * Desbloquea: con la llave de este aparato si la hay; si falla o no la hay, con la clave
   * (`withKey`: directamente con la clave, «Usar la clave»). Da `true` si queda desbloqueado y
   * `false` si se cancela.
   */
  requestUnlock: (options?: { withKey?: boolean }) => Promise<boolean>
  /** Con la clave escrita en la ficha bloqueada de escritorio (D4): `false` si no es esa. */
  openWithPassword: (password: string) => Promise<boolean>
  /**
   * «Proteger» una nota (5.7, C6–C6c): crea la clave si aún no hay, confirma y desbloquea. `true`
   * si se puede cifrar ya; `false` si se cancela.
   */
  protectNote: (title: string) => Promise<boolean>
  lock: () => void
  /** «Crea tu clave privada». */
  create: () => void
  /** «Cambiar la clave». */
  change: () => void
  /** «He olvidado la clave». */
  forgot: () => void
  /** Enciende o apaga la llave de este aparato. */
  setDeviceKey: (on: boolean) => void
}

export type PrivateContextValue = PrivateState & PrivateActions

export const PrivateContext = createContext<PrivateContextValue | null>(null)

/**
 * Cuál es la clave de la caja de ahora, o `null` si no se sabe (sin clave, cargando o fuera de
 * `PrivateProvider`): para saber si una nota protegida es de la clave anterior.
 */
export function usePrivateKeyId(): string | null {
  return useContext(PrivateContext)?.vault?.keyId ?? null
}

/** Como `usePrivate`, o `null` fuera de `PrivateProvider` (piezas que también se usan sueltas). */
export function useOptionalPrivate(): PrivateContextValue | null {
  return useContext(PrivateContext)
}

/** La clave privada, desde cualquier pantalla de dentro (`PrivateProvider`, en el layout privado). */
export function usePrivate(): PrivateContextValue {
  const value = useContext(PrivateContext)
  if (!value) throw new Error('usePrivate necesita PrivateProvider')
  return value
}
