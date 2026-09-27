import { Archive } from 'lucide-react'
import { useCallback, useMemo, useState, type ReactNode } from 'react'
import { toast } from 'sonner'

import { useArchiveList, useDeleteList, useUnarchiveList } from '../hooks/useListMutations'
import type { List } from '../types'
import { DeleteListDialog } from './DeleteListDialog'
import { ListActionsContext, type ListActions } from './listActionsContext'
import { ListFormDialog } from './ListFormDialog'

/** Cuánto dura el aviso «Archivada · Deshacer» (diseño 04 Listas). */
const UNDO_MS = 5000

/**
 * Acciones sobre listas para toda la zona privada: crear, editar, archivar, desarchivar y borrar.
 * El formulario y la confirmación se montan una sola vez aquí; cualquier botón («+ Nueva lista»
 * del sidebar, la cabecera, la tarjeta punteada, el menú ···) los abre con `useListActions`.
 */
export function ListActionsProvider({ children }: { children: ReactNode }) {
  const [form, setForm] = useState<{ open: boolean; list?: List | undefined }>({ open: false })
  const [toDelete, setToDelete] = useState<List | undefined>(undefined)
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
          toast.custom(
            (id) => (
              <UndoToast
                message={`«${list.name}» archivada`}
                onUndo={() => {
                  toast.dismiss(id)
                  unarchive(list)
                }}
              />
            ),
            { duration: UNDO_MS, position: 'bottom-center' },
          )
        },
      })
    },
    [archiveList, unarchive],
  )

  const actions = useMemo<ListActions>(
    () => ({
      openCreate: () => {
        setForm({ open: true })
      },
      openEdit: (list) => {
        setForm({ open: true, list })
      },
      confirmDelete: setToDelete,
      archive,
      unarchive,
    }),
    [archive, unarchive],
  )

  return (
    <ListActionsContext value={actions}>
      {children}
      <ListFormDialog
        open={form.open}
        list={form.list}
        onOpenChange={(open) => {
          setForm((current) => ({ ...current, open }))
        }}
      />
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

/** Aviso tras archivar (diseño 04 Listas, L11 y D8): «Deshacer» durante cinco segundos. */
function UndoToast({ message, onUndo }: { message: string; onUndo: () => void }) {
  return (
    <div className="flex h-12 w-full items-center gap-[18px] rounded-[14px] bg-toast px-[18px] text-sm font-medium whitespace-nowrap text-toast-foreground shadow-toast md:min-w-[360px]">
      <Archive aria-hidden className="size-[18px] shrink-0" strokeWidth={2} />
      <span className="truncate">{message}</span>
      <button
        type="button"
        onClick={onUndo}
        className="ml-auto font-bold text-toast-action outline-none focus-visible:underline"
      >
        Deshacer
      </button>
    </div>
  )
}
