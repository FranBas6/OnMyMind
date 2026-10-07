import type { QueryClient } from '@tanstack/react-query'
import { useCallback } from 'react'
import { toast } from 'sonner'

import { errorMessage } from '@/lib/errors'
import {
  durableMutation,
  useDurableMutation,
  WAITS_FOR_NETWORK,
  type DurableMutation,
} from '@/lib/mutations'
import { queryKeys } from '@/lib/queryKeys'

import { updateDisplayName, updateSettings } from '../api'
import type { SettingsPatch } from '../schemas'
import type { Profile } from '../types'
import { useCurrentUser } from './useProfile'

/** En fila: guardar el tema y la lista por defecto seguidos no se pisan al fusionar `settings`. */
const PROFILE_SCOPE = { id: 'profile' }

/**
 * Lo que se guarda va con quién lo guarda: una mutación restaurada al abrir la app (2.10) no tiene
 * un hook alrededor que se lo diga.
 */
interface ProfileChange<T> {
  userId: string
  value: T
}

/** Lo de antes, para volver atrás si falla. */
interface ProfileContext {
  previous: Profile | undefined
}

/**
 * Patrón optimista del perfil: se ve al instante, sin red espera (también con la app cerrada),
 * vuelve atrás si el servidor dice que no y, al terminar, se pide de nuevo (el servidor manda:
 * `updated_at`, lo que haya cambiado otro dispositivo).
 */
function optimisticProfile<T>(
  update: (profile: Profile, value: T) => Profile,
  send: (userId: string, value: T) => Promise<void>,
  failure: string,
) {
  const key = queryKeys.profile()
  return (queryClient: QueryClient) => ({
    ...WAITS_FOR_NETWORK,
    scope: PROFILE_SCOPE,
    mutationFn: ({ userId, value }: ProfileChange<T>) => send(userId, value),
    onMutate: async ({ value }: ProfileChange<T>): Promise<ProfileContext> => {
      await queryClient.cancelQueries({ queryKey: key })
      const previous = queryClient.getQueryData<Profile>(key)
      if (previous) queryClient.setQueryData(key, update(previous, value))
      return { previous }
    },
    onError: (error: Error, _change: ProfileChange<T>, context: ProfileContext | undefined) => {
      if (context?.previous) queryClient.setQueryData(key, context.previous)
      toast.error(`${failure} ${errorMessage(error)}`)
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: key })
    },
  })
}

const updateSettingsMutation = durableMutation(
  ['profile', 'settings'],
  optimisticProfile<SettingsPatch>(
    (profile, patch) => ({
      ...profile,
      themeStored: profile.themeStored || patch.theme !== undefined,
      settings: {
        ...profile.settings,
        ...(patch.theme !== undefined && { theme: patch.theme }),
        ...(patch.defaultListId !== undefined && { defaultListId: patch.defaultListId }),
        ...(patch.timezone !== undefined && { timezone: patch.timezone }),
        ...(patch.dailySummaryTime !== undefined && { dailySummaryTime: patch.dailySummaryTime }),
        ...(patch.inboxSort !== undefined && { inboxSort: patch.inboxSort }),
        ...(patch.priceDropAlerts !== undefined && { priceDropAlerts: patch.priceDropAlerts }),
      },
    }),
    updateSettings,
    'No se ha podido guardar el ajuste.',
  ),
)

const updateDisplayNameMutation = durableMutation(
  ['profile', 'name'],
  optimisticProfile<string>(
    (profile, name) => ({ ...profile, displayName: name.trim() }),
    updateDisplayName,
    'No se ha podido guardar tu nombre.',
  ),
)

/** Las mutaciones del perfil que se registran en el QueryClient (2.10). */
export const profileMutations = [updateSettingsMutation, updateDisplayNameMutation]

/** Quien llama solo pasa el cambio; quién lo guarda lo pone el hook. */
function useProfileChange<T>(mutation: DurableMutation<ProfileChange<T>, void, ProfileContext>) {
  const user = useCurrentUser()
  const { mutate } = useDurableMutation(mutation)
  return {
    mutate: useCallback(
      (value: T) => {
        mutate({ userId: user.id, value })
      },
      [mutate, user.id],
    ),
  }
}

export function useUpdateSettings() {
  return useProfileChange(updateSettingsMutation)
}

export function useUpdateDisplayName() {
  return useProfileChange(updateDisplayNameMutation)
}
