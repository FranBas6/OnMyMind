import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import { useProfile } from '@/features/profile/hooks/useProfile'
import { useUpdateSettings } from '@/features/profile/hooks/useProfileMutations'
import { errorMessage } from '@/lib/errors'
import { queryKeys } from '@/lib/queryKeys'

import { disablePush, enablePush, type PushState } from '../push'
import { pushStateQueryOptions } from '../queries'

/**
 * Los avisos de este dispositivo: cómo están y activarlos o desactivarlos. Al activarlos, si la
 * zona horaria del perfil no es la de este dispositivo, se guarda la de aquí: con ella calcula la
 * base «el día antes a las 9:00» y el resumen de Hoy.
 */
export function usePush() {
  const queryClient = useQueryClient()
  const state = useQuery(pushStateQueryOptions)
  const profile = useProfile()
  const updateSettings = useUpdateSettings()

  const settle = (next: PushState) => {
    queryClient.setQueryData(queryKeys.push, next)
  }

  const enable = useMutation({
    mutationFn: enablePush,
    onSuccess: (next) => {
      settle(next)
      const zone = Intl.DateTimeFormat().resolvedOptions().timeZone
      if (next === 'on' && profile.data && profile.data.settings.timezone !== zone) {
        updateSettings.mutate({ timezone: zone })
      }
    },
    onError: (error) => {
      toast.error(`No se han podido activar los avisos. ${errorMessage(error)}`)
    },
  })

  const disable = useMutation({
    mutationFn: disablePush,
    onSuccess: settle,
    onError: (error) => {
      toast.error(`No se han podido desactivar los avisos. ${errorMessage(error)}`)
    },
  })

  return { state: state.data, enable, disable }
}
