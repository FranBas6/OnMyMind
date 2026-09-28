import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import { errorMessage } from '@/lib/errors'
import { queryKeys } from '@/lib/queryKeys'

import { updateDisplayName, updateSettings } from '../api'
import type { SettingsPatch } from '../schemas'
import type { Profile } from '../types'
import { useCurrentUser } from './useProfile'

/** En fila: guardar el tema y la lista por defecto seguidos no se pisan al fusionar `settings`. */
const PROFILE_SCOPE = { id: 'profile' }

/**
 * Patrón optimista del perfil: se ve al instante, vuelve atrás si el servidor dice que no y, al
 * terminar, se pide de nuevo (el servidor manda: `updated_at`, lo que haya cambiado otro dispositivo).
 */
function useOptimisticProfile<T>(
  update: (profile: Profile, variables: T) => Profile,
  mutationFn: (userId: string, variables: T) => Promise<void>,
  failure: string,
) {
  const queryClient = useQueryClient()
  const user = useCurrentUser()
  const key = queryKeys.profile()
  return useMutation({
    scope: PROFILE_SCOPE,
    mutationFn: (variables: T) => mutationFn(user.id, variables),
    onMutate: async (variables) => {
      await queryClient.cancelQueries({ queryKey: key })
      const previous = queryClient.getQueryData<Profile>(key)
      if (previous) queryClient.setQueryData(key, update(previous, variables))
      return { previous }
    },
    onError: (error, _variables, context) => {
      if (context?.previous) queryClient.setQueryData(key, context.previous)
      toast.error(`${failure} ${errorMessage(error)}`)
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: key })
    },
  })
}

export function useUpdateSettings() {
  return useOptimisticProfile<SettingsPatch>(
    (profile, patch) => ({
      ...profile,
      themeStored: profile.themeStored || patch.theme !== undefined,
      settings: {
        ...profile.settings,
        ...(patch.theme !== undefined && { theme: patch.theme }),
        ...(patch.defaultListId !== undefined && { defaultListId: patch.defaultListId }),
      },
    }),
    updateSettings,
    'No se ha podido guardar el ajuste.',
  )
}

export function useUpdateDisplayName() {
  return useOptimisticProfile<string>(
    (profile, name) => ({ ...profile, displayName: name.trim() }),
    updateDisplayName,
    'No se ha podido guardar tu nombre.',
  )
}
