import { useLocation, useNavigate } from '@tanstack/react-router'
import { Archive } from 'lucide-react'
import { useCallback, useMemo, useState, type ReactNode } from 'react'

import { ListPeopleSheet } from '@/features/sharing/components/ListPeopleSheet'
import { showUndoToast } from '@/lib/undoToast'

import { useArchiveList, useDeleteList, useUnarchiveList } from '../hooks/useListMutations'
import type { List } from '../types'
import { DeleteListDialog } from './DeleteListDialog'
import { DuplicateListDialog } from './DuplicateListDialog'
import { ListActionsContext, type ListActions } from './listActionsContext'
import { ListFormDialog } from './ListFormDialog'

/**
 * Acciones sobre listas para toda la zona privada: crear, editar, archivar, desarchivar, duplicar
 * y borrar.
 * El formulario y la confirmación se montan una sola vez aquí; cualquier botón («+ Nueva lista»
 * del sidebar, la cabecera, la tarjeta punteada, el menú ···) los abre con `useListActions`.
 */
export function ListActionsProvider({ children }: { children: ReactNode }) {
  const [form, setForm] = useState<{
    open: boolean
    list?: List | undefined
    onCreated?: ((list: List) => void) | undefined
  }>({ open: false })
  const [toDelete, setToDelete] = useState<List | undefined>(undefined)
  // Se queda montada al cerrarse, para que la hoja baje con su animación.
  const [people, setPeople] = useState<{ list: List; confirmLeave: boolean; open: boolean } | null>(
    null,
  )
  // Como la de quién está: montada al cerrarse, para que baje con su animación.
  const [toDuplicate, setToDuplicate] = useState<{ list: List; open: boolean } | null>(null)
  const navigate = useNavigate()
  const pathname = useLocation({ select: (location) => location.pathname })
  const archiveList = useArchiveList()
  const unarchiveList = useUnarchiveList()
  const deleteList = useDeleteList()

  const unarchive = useCallback(
    (list: List) => {
      unarchiveList.mutate(list)
    },
    [unarchiveList],
  )

  const archive = useCallback(
    (list: List) => {
      archiveList.mutate(list, {
        onSuccess: () => {
          showUndoToast({
            icon: Archive,
            message: `«${list.name}» archivada`,
            onUndo: () => {
              unarchive(list)
            },
          })
        },
      })
    },
    [archiveList, unarchive],
  )

  const actions = useMemo<ListActions>(
    () => ({
      openCreate: (options) => {
        setForm({ open: true, onCreated: options?.onCreated })
      },
      openEdit: (list) => {
        setForm({ open: true, list })
      },
      confirmDelete: setToDelete,
      archive,
      unarchive,
      openPeople: (list, options) => {
        setPeople({ list, confirmLeave: options?.confirmLeave ?? false, open: true })
      },
      duplicate: (list) => {
        setToDuplicate({ list, open: true })
      },
    }),
    [archive, unarchive],
  )

  // Al salir de una lista compartida (M5): si estabas en ella, a Inicio; y el aviso.
  const left = (list: List) => {
    if (pathname.startsWith(`/lists/${list.id}`)) void navigate({ to: '/' })
    showUndoToast({ message: `Has salido de «${list.name}»` })
  }

  return (
    <ListActionsContext value={actions}>
      {children}
      <ListFormDialog
        open={form.open}
        list={form.list}
        onCreated={form.onCreated}
        onOpenChange={(open) => {
          setForm((current) => ({ ...current, open }))
        }}
      />
      {people && (
        <ListPeopleSheet
          key={`${people.list.id}-${String(people.confirmLeave)}`}
          list={people.list}
          open={people.open}
          confirmLeave={people.confirmLeave}
          onOpenChange={(open) => {
            setPeople((current) => current && { ...current, open })
          }}
          onLeft={left}
        />
      )}
      {toDuplicate && (
        <DuplicateListDialog
          key={toDuplicate.list.id}
          list={toDuplicate.list}
          open={toDuplicate.open}
          onOpenChange={(open) => {
            setToDuplicate((current) => current && { ...current, open })
          }}
        />
      )}
      <DeleteListDialog
        list={toDelete}
        onOpenChange={(open) => {
          if (!open) setToDelete(undefined)
        }}
        onConfirm={(list) => {
          deleteList.mutate(list)
          setToDelete(undefined)
        }}
      />
    </ListActionsContext>
  )
}
