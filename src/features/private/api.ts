import { z } from 'zod'

import { supabase } from '@/lib/supabase/client'

import type { PasswordWrap, WrappedKey } from './vault'

/** La caja de la clave privada (`private_vaults`, 5.6): cifrada, nunca la clave en claro. */
export interface PrivateVault {
  /** Cuál es la clave de la caja: cambia solo al crear otra porque se olvidó. */
  keyId: string
  wrap: PasswordWrap
  check: string
}

/** Una llave de acceso de un aparato (`private_vault_keys`). */
export interface VaultDeviceKey {
  id: string
  credentialId: string
  prfSalt: string
  wrap: WrappedKey
  keyId: string
  /** «Face ID», «Touch ID», «Huella», «Windows Hello». */
  method: string
  /** «iPhone», «Mac», «móvil», «ordenador». */
  device: string
}

export interface PrivateVaultState {
  /** `null`: aún no hay clave privada. */
  vault: PrivateVault | null
  keys: VaultDeviceKey[]
}

const vaultRowSchema = z.object({
  key_id: z.string(),
  kdf_iterations: z.number(),
  kdf_salt: z.string(),
  wrap_iv: z.string(),
  wrapped_key: z.string(),
  key_check: z.string(),
})

const keyRowSchema = z.object({
  id: z.string(),
  credential_id: z.string(),
  prf_salt: z.string(),
  wrap_iv: z.string(),
  wrapped_key: z.string(),
  key_id: z.string(),
  method: z.string(),
  device: z.string(),
})

const VAULT_COLUMNS = 'key_id, kdf_iterations, kdf_salt, wrap_iv, wrapped_key, key_check'
const KEY_COLUMNS = 'id, credential_id, prf_salt, wrap_iv, wrapped_key, key_id, method, device'

function toVault(row: z.infer<typeof vaultRowSchema>): PrivateVault {
  return {
    keyId: row.key_id,
    wrap: {
      salt: row.kdf_salt,
      iterations: row.kdf_iterations,
      iv: row.wrap_iv,
      wrapped: row.wrapped_key,
    },
    check: row.key_check,
  }
}

function toDeviceKey(row: z.infer<typeof keyRowSchema>): VaultDeviceKey {
  return {
    id: row.id,
    credentialId: row.credential_id,
    prfSalt: row.prf_salt,
    wrap: { iv: row.wrap_iv, wrapped: row.wrapped_key },
    keyId: row.key_id,
    method: row.method,
    device: row.device,
  }
}

/** Tu caja y tus llaves. Cifradas: se guardan en la caché para desbloquear sin red. */
export async function fetchPrivateVault(): Promise<PrivateVaultState> {
  const [vault, keys] = await Promise.all([
    supabase.from('private_vaults').select(VAULT_COLUMNS).maybeSingle(),
    supabase.from('private_vault_keys').select(KEY_COLUMNS).order('created_at'),
  ])
  if (vault.error) throw vault.error
  if (keys.error) throw keys.error
  const current = vault.data ? toVault(vaultRowSchema.parse(vault.data)) : null
  return {
    vault: current,
    // Las de una caja anterior no sirven (la base ya las quita al crear otra).
    keys: z
      .array(keyRowSchema)
      .parse(keys.data)
      .map(toDeviceKey)
      .filter((key) => key.keyId === current?.keyId),
  }
}

const wrapColumns = (wrap: PasswordWrap) => ({
  kdf_iterations: wrap.iterations,
  kdf_salt: wrap.salt,
  wrap_iv: wrap.iv,
  wrapped_key: wrap.wrapped,
})

/** Crea la caja (la primera vez). */
export async function createPrivateVault(wrap: PasswordWrap, check: string): Promise<PrivateVault> {
  const { data, error } = await supabase
    .from('private_vaults')
    .insert({ ...wrapColumns(wrap), key_check: check })
    .select(VAULT_COLUMNS)
    .single()
  if (error) throw error
  return toVault(vaultRowSchema.parse(data))
}

/** Cambiar la clave privada: la misma clave de la caja, cifrada con la nueva. */
export async function rewrapPrivateVault(wrap: PasswordWrap): Promise<void> {
  const { data: auth } = await supabase.auth.getSession()
  const userId = auth.session?.user.id
  if (!userId) throw new Error('Sin sesión')
  const { error } = await supabase
    .from('private_vaults')
    .update(wrapColumns(wrap))
    .eq('user_id', userId)
  if (error) throw error
}

/**
 * Crea otra caja porque se olvidó la clave: pide haber entrado con un código por email hace poco
 * (`reset_private_vault`). Las llaves de antes se van.
 */
export async function resetPrivateVault(wrap: PasswordWrap, check: string): Promise<PrivateVault> {
  const { data, error } = await supabase.rpc('reset_private_vault', {
    p_kdf_iterations: wrap.iterations,
    p_kdf_salt: wrap.salt,
    p_wrap_iv: wrap.iv,
    p_wrapped_key: wrap.wrapped,
    p_key_check: check,
  })
  if (error) throw error
  return { keyId: z.string().parse(data), wrap, check }
}

/** Guarda la llave de este aparato. */
export async function addVaultDeviceKey(key: Omit<VaultDeviceKey, 'id'>): Promise<VaultDeviceKey> {
  const { data, error } = await supabase
    .from('private_vault_keys')
    .insert({
      credential_id: key.credentialId,
      prf_salt: key.prfSalt,
      wrap_iv: key.wrap.iv,
      wrapped_key: key.wrap.wrapped,
      key_id: key.keyId,
      method: key.method,
      device: key.device,
    })
    .select(KEY_COLUMNS)
    .single()
  if (error) throw error
  return toDeviceKey(keyRowSchema.parse(data))
}

export async function removeVaultDeviceKey(id: string): Promise<void> {
  const { error } = await supabase.from('private_vault_keys').delete().eq('id', id)
  if (error) throw error
}

/** El código de «He olvidado la clave»: a tu email, sin crear ninguna cuenta. */
export async function sendResetCode(email: string): Promise<void> {
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: false },
  })
  if (error) throw error
}

/** Canjea el código: la sesión queda con «entró con un código ahora», que pide crear otra caja. */
export async function verifyResetCode({ email, token }: { email: string; token: string }) {
  const { error } = await supabase.auth.verifyOtp({ email, token, type: 'email' })
  if (error) throw error
}

/**
 * Cuántas notas protegidas hay con esta clave de la caja (5.7): las que se pierden si se crea otra
 * porque se olvidó («el texto de tus 4 notas protegidas», C5b). Solo tuyas: una protegida no está
 * en una lista compartida.
 */
export async function countProtectedNotes(keyId: string): Promise<number> {
  const { count, error } = await supabase
    .from('items')
    .select('id', { count: 'exact', head: true })
    .eq('protected', true)
    .eq('sealed_key_id', keyId)
  if (error) throw error
  return count ?? 0
}
