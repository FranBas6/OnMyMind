import {
  addVaultDeviceKey,
  createPrivateVault,
  resetPrivateVault,
  rewrapPrivateVault,
  type PrivateVault,
  type VaultDeviceKey,
} from './api'
import { evaluatePasskey, PasskeyFailure, registerPasskey, type DeviceUnlock } from './passkey'
import {
  generateVaultKey,
  keyCheck,
  matchesCheck,
  newPrfSalt,
  unwrapWithPassword,
  unwrapWithPrf,
  wrapWithPassword,
  wrapWithPrf,
} from './vault'

/**
 * Lo que hace la clave privada (5.6, ADR-013), sin pantallas: crear la caja, desbloquearla con la
 * clave o con la llave de este aparato, cambiar la clave y añadir la llave. Lo desbloqueado vuelve
 * a quien llama; guardarlo en memoria es cosa de `unlock.ts`.
 */

export interface CreatedKey {
  vault: PrivateVault
  key: CryptoKey
}

/**
 * Crea la clave privada: una clave de la caja nueva, cifrada con ella. Con `reset`, en lugar de la
 * de antes (necesita el código por email).
 */
export async function createKey(password: string, { reset = false } = {}): Promise<CreatedKey> {
  const key = await generateVaultKey()
  const [wrap, check] = await Promise.all([wrapWithPassword(key, password), keyCheck(key)])
  const vault = reset ? await resetPrivateVault(wrap, check) : await createPrivateVault(wrap, check)
  return { vault, key }
}

/** La clave de la caja con la clave privada, o `null` si no es esa. Sin red: se comprueba aquí. */
export async function openWithKey(
  vault: PrivateVault,
  password: string,
): Promise<CryptoKey | null> {
  const key = await unwrapWithPassword(vault.wrap, password)
  if (!key || !(await matchesCheck(key, vault.check))) return null
  return key
}

/** La clave de la caja con la llave de este aparato (pide Face ID). */
export async function openWithDevice(
  vault: PrivateVault,
  deviceKey: VaultDeviceKey,
): Promise<CryptoKey> {
  const output = await evaluatePasskey(deviceKey.credentialId, deviceKey.prfSalt)
  const key = await unwrapWithPrf(deviceKey.wrap, output)
  if (!key || !(await matchesCheck(key, vault.check))) throw new PasskeyFailure('failed')
  return key
}

/**
 * Cambia la clave privada: la misma clave de la caja, cifrada con la nueva. Lo protegido y las
 * llaves de los aparatos siguen valiendo. `current` es la clave de ahora o, si ya se abrió con
 * Face ID, la clave de la caja. `null` si la clave de ahora no es esa.
 */
export async function changeKey(
  vault: PrivateVault,
  current: string | CryptoKey,
  next: string,
): Promise<CryptoKey | null> {
  const key = typeof current === 'string' ? await openWithKey(vault, current) : current
  if (!key) return null
  await rewrapPrivateVault(await wrapWithPassword(key, next))
  return key
}

/** Crea la llave de este aparato y guarda con ella la clave de la caja. */
export async function addDeviceKey({
  vault,
  key,
  userId,
  email,
  unlock,
}: {
  vault: PrivateVault
  key: CryptoKey
  userId: string
  email: string
  unlock: DeviceUnlock
}): Promise<VaultDeviceKey> {
  const prfSalt = newPrfSalt()
  const { credentialId, output } = await registerPasskey({ userId, email, prfSalt })
  return addVaultDeviceKey({
    credentialId,
    prfSalt,
    wrap: await wrapWithPrf(key, output),
    keyId: vault.keyId,
    method: unlock.title,
    device: unlock.device,
  })
}
