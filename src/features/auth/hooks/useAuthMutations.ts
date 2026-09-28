import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'

import { flushMutations, SIGN_OUT_MUTATION_KEY } from '@/lib/flushMutations'

import { signInWithPassword, signOut, signUp, updatePassword } from '../api'
import type { ChangePasswordValues } from '../schemas'

export function useSignIn() {
  return useMutation({ mutationFn: signInWithPassword })
}

export function useSignUp() {
  return useMutation({ mutationFn: signUp })
}

export function useChangePassword() {
  return useMutation({
    mutationFn: ({ password }: ChangePasswordValues) => updatePassword(password),
  })
}

/**
 * Cierra sesión, lleva a `/login` y vacía la caché de TanStack Query, para que quien entre
 * después en este navegador no vea ni un instante los datos de la cuenta anterior. Antes envía
 * lo que quede pendiente (diseño 09 Perfil: «se enviará antes de salir»), si hay red.
 */
export function useSignOut() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()

  return useMutation({
    mutationKey: SIGN_OUT_MUTATION_KEY,
    mutationFn: async () => {
      await flushMutations(queryClient)
      await signOut()
    },
    onSuccess: async () => {
      await navigate({ to: '/login' })
      queryClient.clear()
    },
  })
}
