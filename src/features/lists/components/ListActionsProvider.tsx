import { useLocation, useNavigate } from '@tanstack/react-router'
import { Archive, Eye, EyeOff } from 'lucide-react'
import { useCallback, useMemo, useState, type ReactNode } from 'react'

// Por su ruta y no por el índice: `items` usa piezas de `lists`.
import { ProtectedNotesGate } from '@/features/items/components/ProtectedNotesGate'
import { usePrivate } from '@/features/private'
// Por su ruta: `profile` usa piezas de `lists`.
import { useProfile } from '@/features/profile/hooks/useProfile'
import { ListPeopleSheet } from '@/features/sharing/components/ListPeopleSheet'
import { useListSharing } from '@/features/sharing/hooks/useSharing'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import { showUndoToast } from '@/lib/undoToast'

import { HIDDEN_TOAST, shownToast } from '../hidden'
import { useForgetHiddenOnLock } from '../hooks/useHiddenLists'
import {
  useArchiveList,
  useDeleteList,
  useHideList,
  useShowList,
  useUnarchiveList,
} from '../hooks/useListMutations'
import type { List } from '../types'
import { DeleteListDialog } from './DeleteListDialog'
import { DuplicateListDialog } from './DuplicateListDialog'
import { HideListSheet } from './HideListSheet'
import { ListActionsContext, type ListActions } from './listActionsContext'
import { ListFormDialog } from './ListFormDialog'

/**
 * Acciones sobre listas para toda la zona privada: crear, editar, archivar, desarchivar, duplicar,
 * ocultar, mostrar y borrar. Va dentro de `PrivateProvider`: ocultar sin clave la crea antes.
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
  // Como las otras hojas: montada al cerrarse.
  const [toHide, setToHide] = useState<{ list: List; open: boolean } | null>(null)
  const navigate = useNavigate()
  const pathname = useLocation({ select: (location) => location.pathname })
  const isDesktop = useMediaQuery('(min-width: 768px)')
  const privacy = usePrivate()
  const profile = useProfile()
  const archiveList = useArchiveList()
  const unarchiveList = useUnarchiveList()
  const deleteList = useDeleteList()
  const hideList = useHideList()
  const showList = useShowList()
  // Al bloquear, lo de las ocultas se olvida (5.8).
  useForgetHiddenOnLock()
  const { ensureKey } = privacy

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

  const show = useCallback(
    (list: List) => {
      showList.mutate(list)
      // De vuelta en Inicio, donde vuelve a estar (D5c).
      void navigate({ to: '/' })
      showUndoToast({ icon: Eye, message: shownToast(list.name) })
    },
    [showList, navigate],
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
      hide: (list) => {
        void ensureKey().then((ready) => {
          if (ready) setToHide({ list, open: true })
        })
      },
      show,
    }),
    [archive, unarchive, ensureKey, show],
  )

  // Ocultar (D1d): fuera de su pantalla si estabas en ella, y el aviso sin su nombre.
  const hide = (list: List) => {
    setToHide((current) => current && { ...current, open: false })
    hideList.mutate(list, {
      onSuccess: () => {
        showUndoToast({
          icon: EyeOff,
          message: HIDDEN_TOAST,
          onUndo: () => {
            showList.mutate({ ...list, hidden: true })
          },
        })
      },
    })
    if (pathname.startsWith(`/lists/${list.id}`)) void navigate({ to: '/' })
  }

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
          inviteGate={ProtectedNotesGate}
        />
      )}
      {toHide && (
        <HideSheet
          key={toHide.list.id}
          list={toHide.list}
          open={toHide.open}
          isDesktop={isDesktop}
          isDefault={profile.data?.settings.defaultListId === toHide.list.id}
          onOpenChange={(open) => {
            setToHide((current) => current && { ...current, open })
          }}
          onConfirm={() => {
            hide(toHide.list)
          }}
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

/** La hoja de ocultar con quién está compartida (D7b). */
function HideSheet(props: Omit<Parameters<typeof HideListSheet>[0], 'others'>) {
  const { others } = useListSharing(props.list.id)
  return <HideListSheet {...props} others={others} />
}
