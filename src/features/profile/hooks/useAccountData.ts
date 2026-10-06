import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'

import { markAccountDeleted } from '@/features/auth/accountDeleted'
import { signOut } from '@/features/auth/api'
import { fetchItems } from '@/features/items/api'
import type { List } from '@/features/lists/types'
import { downloadFile } from '@/lib/download'
import { queryKeys } from '@/lib/queryKeys'

import { deleteAccount, fetchAccountCounts, fetchExport } from '../api'
import { exportFileName, listCsv, listFileName } from '../export'
import { useCurrentUser } from './useProfile'

export type ExportChoice = { kind: 'json' } | { kind: 'csv'; list: List }

/**
 * Exportar mis datos (diseño 18, P7 y P8): se prepara en el navegador y se descarga. Solo con red
 * (`networkMode: 'online'`), aunque la fila ya lo impide sin conexión.
 */
export function useExportData() {
  const user = useCurrentUser()
  return useMutation({
    networkMode: 'online',
    mutationFn: async (choice: ExportChoice) => {
      if (choice.kind === 'json') {
        const data = await fetchExport(user.id)
        downloadFile(exportFileName(), JSON.stringify(data, null, 2), 'application/json')
        return
      }
      const items = await fetchItems(choice.list.id)
      downloadFile(listFileName(choice.list), listCsv(items), 'text/csv;charset=utf-8')
    },
  })
}

/** Cuántas listas y cosas se borran con la cuenta: se pide cada vez que se abre la confirmación. */
export function useAccountCounts(enabled: boolean) {
  const user = useCurrentUser()
  return useQuery({
    queryKey: queryKeys.accountCounts,
    queryFn: () => fetchAccountCounts(user.id),
    enabled,
    staleTime: 0,
  })
}

/**
 * Borrar la cuenta (diseño 18, P9, P10 y D7). Al terminar, este navegador deja de estar suscrito a
 * los avisos, se cierra la sesión (la de la base ya no existe; si cerrarla falla, da igual) y se
 * vuelve al acceso con «Tu cuenta y todo lo que tenía se han borrado.» (decisión de Fran, 2.8).
 */
export function useDeleteAccount() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  return useMutation({
    networkMode: 'online',
    mutationFn: deleteAccount,
    onSuccess: async () => {
      // El aviso del acceso va aparte de la URL: al cerrarse la sesión, la guarda de las rutas
      // privadas también lleva a `/login` (con `?redirect=`), y no debe perderse.
      markAccountDeleted()
      await unsubscribeThisBrowser()
      await signOut().catch(() => undefined)
      await navigate({ to: '/login' })
      queryClient.clear()
    },
  })
}

async function unsubscribeThisBrowser(): Promise<void> {
  try {
    if (!('serviceWorker' in navigator)) return
    const registration = await navigator.serviceWorker.getRegistration()
    const subscription = await registration?.pushManager.getSubscription()
    await subscription?.unsubscribe()
  } catch {
    // Sin service worker o sin permiso: no había nada que quitar.
  }
}
