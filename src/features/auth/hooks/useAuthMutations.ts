import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'

import { signInWithPassword, signOut, signUp } from '../api'

export function useSignIn() {
  return useMutation({ mutationFn: signInWithPassword })
}

export function useSignUp() {
  return useMutation({ mutationFn: signUp })
}

/**
 * Cierra sesión, lleva a `/login` y vacía la caché de TanStack Query, para que quien entre
 * después en este navegador no vea ni un instante los datos de la cuenta anterior.
 */
export function useSignOut() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()

  return useMutation({
    mutationFn: signOut,
    onSuccess: async () => {
      await navigate({ to: '/login' })
      queryClient.clear()
    },
  })
}
