import { useQuery, type QueryClient } from '@tanstack/react-query'

import { queryKeys } from '@/lib/queryKeys'

import { usePrivateKeyId } from './privateContext'
import { getUnlocked, UNLOCK_MS, useUnlocked, type Unlocked } from './unlock'
import { openText, sealText, type SealedText } from './vault'

/**
 * El texto de las notas protegidas (5.7, ADR-013): se cifra y se descifra aquí, en el aparato, con
 * la clave de la caja desbloqueada. Lo descifrado vive solo en memoria (`meta.private`: no va a la
 * caché guardada) y se olvida al bloquear (`PrivateProvider`).
 */

/** El texto cifrado de una nota protegida y con qué clave de la caja (`private_vaults.key_id`). */
export interface SealedNotes extends SealedText {
  keyId: string
}

/** Cifra el texto de una nota con lo desbloqueado. Bloqueado, falla: antes se pide desbloquear. */
export async function sealNote(
  text: string,
  unlocked: Unlocked | null = getUnlocked(),
): Promise<SealedNotes> {
  if (!unlocked) throw new Error('Bloqueada')
  return { ...(await sealText(unlocked.key, text)), keyId: unlocked.keyId }
}

/** Descifra el texto de una nota con lo desbloqueado; `null` si está bloqueada o no se abre. */
export async function openNote(
  sealed: SealedNotes,
  unlocked: Unlocked | null = getUnlocked(),
): Promise<string | null> {
  if (unlocked?.keyId !== sealed.keyId) return null
  return openText(unlocked.key, sealed)
}

/**
 * Lo que se ve de una nota protegida: `locked` sin desbloquear; `lost` si es de la clave anterior
 * (C5d) o no se abre; `opening` mientras se descifra; `open` con su texto.
 */
export type OpenedNote =
  { state: 'locked' | 'lost' | 'opening'; text: null } | { state: 'open'; text: string }

/** El texto de una nota protegida, si está desbloqueada (`OpenedNote`). */
export function useOpenedNote(itemId: string, sealed: SealedNotes | null): OpenedNote {
  const unlocked = useUnlocked()
  const keyId = usePrivateKeyId()
  // La consulta va con el `iv`, que cambia cada vez que se cifra: un texto nuevo se descifra solo.
  const query = useQuery({
    queryKey: queryKeys.openedNote(itemId, sealed?.iv ?? ''),
    queryFn: async () => (unlocked && sealed ? openText(unlocked.key, sealed) : null),
    enabled: sealed !== null && unlocked !== null && unlocked.keyId === sealed.keyId,
    staleTime: Infinity,
    // Mientras dure desbloqueado: al bloquear, `PrivateProvider` lo borra todo.
    gcTime: UNLOCK_MS,
    retry: false,
    meta: { private: true },
  })
  if (!sealed) return { state: 'lost', text: null }
  // De la clave anterior: lo dice aunque esté bloqueada, si se sabe cuál es la de ahora.
  if (keyId !== null && keyId !== sealed.keyId) return { state: 'lost', text: null }
  if (!unlocked) return { state: 'locked', text: null }
  if (unlocked.keyId !== sealed.keyId) return { state: 'lost', text: null }
  if (query.data === undefined) return { state: 'opening', text: null }
  return query.data === null ? { state: 'lost', text: null } : { state: 'open', text: query.data }
}

/**
 * Lo que se acaba de cifrar ya se sabe: se deja descifrado para que la ficha no lo vuelva a abrir
 * (y no parpadee) al cambiar el `iv`.
 */
export function rememberOpenedNote(
  queryClient: QueryClient,
  itemId: string,
  sealed: SealedNotes,
  text: string,
): void {
  queryClient.setQueryData(queryKeys.openedNote(itemId, sealed.iv), text)
}

/** Si una nota protegida es de la clave anterior: su texto ya no se abre (C5d). */
export function useIsLostNote(sealed: SealedNotes | null): boolean {
  const keyId = usePrivateKeyId()
  return sealed !== null && keyId !== null && keyId !== sealed.keyId
}
