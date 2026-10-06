import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import type { Item } from '@/features/items/types'
import { useCurrentUser } from '@/features/profile/hooks/useProfile'
import { queryKeys } from '@/lib/queryKeys'

import {
  acceptInvite,
  createInvite,
  fetchActiveInvite,
  fetchDeparture,
  fetchSharedPeople,
  fetchInvitePreview,
  fetchListPeople,
  leaveList,
  removeMember,
  revokeInvite,
} from '../api'
import type { ListPerson } from '../schemas'

/**
 * Compartir pide conexión (diseño 20, S6 y J8): crear, anular, quitar, salir y unirse no se
 * guardan para luego, como los ítems. Sin red, la interfaz ya los desactiva.
 */
const NEEDS_NETWORK = { networkMode: 'online' } as const

const NO_PEOPLE: readonly ListPerson[] = []

/**
 * Quién está en cada lista compartida (3.3): una consulta para todas las iniciales de la app. Lo
 * cambia otra persona al entrar o salir, así que caduca pronto (10 s) y se vuelve a pedir al
 * cambiar de pantalla; con la 3.4 (en directo) llegará solo.
 */
export function useSharedPeople() {
  return useQuery({
    queryKey: queryKeys.sharing.shared,
    queryFn: fetchSharedPeople,
    staleTime: 10_000,
  })
}

/**
 * Si una lista es compartida y con quién (diseño 20, M1, M2 y M6): `people` (primero quien la
 * creó) y `others`, todos menos tú. Vacíos si no la comparte nadie.
 */
export function useListSharing(listId: string | undefined) {
  const shared = useSharedPeople()
  const me = useCurrentUser()
  const people = (listId === undefined ? undefined : shared.data?.get(listId)) ?? NO_PEOPLE
  return {
    shared: people.length > 1,
    people,
    others: people.filter((person) => person.userId !== me.id),
  }
}

/**
 * A quién va la inicial de una fila (diseño 20, M2): en lo terminado, a quien lo completó; en lo
 * demás, a quien lo añadió. Solo si no fuiste tú y la lista es compartida; si no, `null` y la fila
 * se ve como siempre.
 */
export function useItemPerson(
  item: Pick<Item, 'listId' | 'createdBy' | 'completedBy' | 'completedAt'>,
): ListPerson | null {
  const { shared, people } = useListSharing(item.listId)
  const me = useCurrentUser()
  if (!shared) return null
  const userId = item.completedAt ? (item.completedBy ?? item.createdBy) : item.createdBy
  if (!userId || userId === me.id) return null
  return people.find((person) => person.userId === userId) ?? null
}

/** Por qué ya no tienes esta lista (M9 y M10), cuando la estabas viendo. */
export function useDeparture(listId: string, enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.sharing.departure(listId),
    queryFn: () => fetchDeparture(listId),
    enabled,
    staleTime: 0,
  })
}

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
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.sharing.people(listId) })
      await queryClient.invalidateQueries({ queryKey: queryKeys.sharing.shared })
    },
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
      await queryClient.invalidateQueries({ queryKey: queryKeys.sharing.shared })
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
      await queryClient.invalidateQueries({ queryKey: queryKeys.sharing.shared })
      await queryClient.invalidateQueries({ queryKey: queryKeys.sharing.preview(token) })
    },
  })
}
