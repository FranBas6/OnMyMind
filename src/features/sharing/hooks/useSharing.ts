import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { queryKeys } from '@/lib/queryKeys'

import {
  acceptInvite,
  createInvite,
  fetchActiveInvite,
  fetchInvitePreview,
  fetchListPeople,
  leaveList,
  removeMember,
  revokeInvite,
} from '../api'

/**
 * Compartir pide conexión (diseño 20, S6 y J8): crear, anular, quitar, salir y unirse no se
 * guardan para luego, como los ítems. Sin red, la interfaz ya los desactiva.
 */
const NEEDS_NETWORK = { networkMode: 'online' } as const

/**
 * Quién está en una lista: quien la creó y quienes entraron. Lo cambia otra persona (alguien
 * entra con el enlace), así que se pregunta cada vez que se abre la hoja; mientras, lo de antes.
 */
export function useListPeople(listId: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.sharing.people(listId),
    queryFn: () => fetchListPeople(listId),
    enabled,
    staleTime: 0,
  })
}

/** El enlace activo de una lista tuya, si hay. Caduca solo: se pregunta al abrir la hoja. */
export function useActiveInvite(listId: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.sharing.invite(listId),
    queryFn: () => fetchActiveInvite(listId),
    enabled,
    staleTime: 0,
  })
}

/** Crea el enlace (o da el activo) y lo deja en la caché, para que la hoja pase a S4. */
export function useCreateInvite(listId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    ...NEEDS_NETWORK,
    mutationFn: () => createInvite(listId),
    onSuccess: (invite) => {
      queryClient.setQueryData(queryKeys.sharing.invite(listId), invite)
    },
  })
}

export function useRevokeInvite(listId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    ...NEEDS_NETWORK,
    mutationFn: () => revokeInvite(listId),
    onSuccess: () => {
      queryClient.setQueryData(queryKeys.sharing.invite(listId), null)
    },
  })
}

/** Quien creó la lista quita a alguien. */
export function useRemoveMember(listId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    ...NEEDS_NETWORK,
    mutationFn: (userId: string) => removeMember(listId, userId),
    onSettled: () => queryClient.invalidateQueries({ queryKey: queryKeys.sharing.people(listId) }),
  })
}

/** Sales de una lista compartida contigo: deja de estar en tus listas. */
export function useLeaveList(listId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    ...NEEDS_NETWORK,
    mutationFn: (userId: string) => leaveList(listId, userId),
    onSuccess: async () => {
      queryClient.removeQueries({ queryKey: queryKeys.items.byList(listId) })
      await queryClient.invalidateQueries({ queryKey: queryKeys.lists.all })
    },
  })
}

/** Lo que dice un enlace: a qué lista, quién invita y si aún vale. También sin sesión. */
export function useInvitePreview(token: string) {
  return useQuery({
    queryKey: queryKeys.sharing.preview(token),
    queryFn: () => fetchInvitePreview(token),
    // Su estado cambia (caduca, se anula, entras): cada vez que se abre, se pregunta.
    staleTime: 0,
    retry: false,
  })
}

/** Unirse con el enlace. Al entrar, tus listas se vuelven a pedir: ya está entre ellas. */
export function useAcceptInvite(token: string) {
  const queryClient = useQueryClient()
  return useMutation({
    ...NEEDS_NETWORK,
    mutationFn: () => acceptInvite(token),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.lists.all })
      await queryClient.invalidateQueries({ queryKey: queryKeys.sharing.preview(token) })
    },
  })
}
