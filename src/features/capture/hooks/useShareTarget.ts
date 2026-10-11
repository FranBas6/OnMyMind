import { useNavigate } from '@tanstack/react-router'
import { Check } from 'lucide-react'
import { useEffect, useRef } from 'react'

import {
  newItemKindAndStatus,
  useCreateWithDate,
  useDeleteItem,
  useFillCapturedLink,
} from '@/features/items'
import { useLists } from '@/features/lists'
import { showUndoToast } from '@/lib/undoToast'

import { sharedItem, type SharedData } from '../share'

/**
 * Compartir a OnMyMind (4.7): lo que llega a `/share` (la hoja de compartir de Android con
 * `share_target`, o el Atajo del iPhone) se guarda directo en «En mente», sin captura, y se abre
 * «En mente» con «Guardado en En mente · Deshacer». Como la captura, también sin red: el ítem es
 * optimista, sube al volver la conexión y el título de la página llega solo (`useFillCapturedLink`).
 * Se hace una sola vez, en cuanto se sabe cuál es «En mente»; la URL se sustituye para que volver
 * atrás o recargar no lo guarde otra vez.
 */
export function useShareTarget(shared: SharedData) {
  const lists = useLists()
  const createItem = useCreateWithDate()
  const deleteItem = useDeleteItem()
  const fillLink = useFillCapturedLink()
  const navigate = useNavigate()
  const done = useRef(false)

  const loaded = lists.data !== undefined
  const failed = lists.isError && !loaded
  const inbox = lists.data?.inbox ?? null

  useEffect(() => {
    if (done.current || (!loaded && !failed)) return
    done.current = true
    const item = sharedItem(shared)
    if (!inbox || !item) {
      void navigate({ to: '/', replace: true })
      return
    }
    const created = createItem(
      {
        id: crypto.randomUUID(),
        listId: inbox.id,
        title: item.title,
        ...newItemKindAndStatus(inbox.kind),
        ...(item.link && { link: item.link }),
        ...(item.notes && { notes: item.notes }),
      },
      null,
    )
    fillLink(created)
    showUndoToast({
      icon: Check,
      message: 'Guardado en En mente',
      onUndo: () => {
        deleteItem.mutate(created)
      },
    })
    void navigate({ to: '/lists/$listId', params: { listId: inbox.id }, replace: true })
  }, [loaded, failed, inbox, shared, createItem, deleteItem, fillLink, navigate])
}
