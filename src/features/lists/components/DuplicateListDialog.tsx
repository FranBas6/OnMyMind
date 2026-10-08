import { useNavigate } from '@tanstack/react-router'
import { CopyPlus, WifiOff } from 'lucide-react'
import { useState } from 'react'

import { ListIcon } from '@/components/ListIcon'
import { ResponsiveSheet } from '@/components/ResponsiveSheet'
import { personName } from '@/features/sharing/copy'
import { useListPeople } from '@/features/sharing/hooks/useSharing'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import { useOnline } from '@/hooks/useOnline'
import { showUndoToast } from '@/lib/undoToast'
import { cn } from '@/lib/utils'

import { copiedSummary, copyName, duplicatedMessage, notCopiedSummary } from '../duplicate'
import { useArchivedLists } from '../hooks/useArchivedLists'
import { useDeleteList, useDuplicateList } from '../hooks/useListMutations'
import { useLists } from '../hooks/useLists'
import { LIST_NAME_MAX_LENGTH } from '../schemas'
import type { List } from '../types'

/**
 * «Duplicar «Maleta de viaje»» (diseño 23, C2, C5, C7 y E4): el nombre de la copia ya escrito y
 * editable, con el icono de la lista; qué se copia y qué no; y, si es de otro o está archivada, una
 * línea de qué pasa con la original. Al duplicar se abre la copia con «Copia creada · 24 cosas
 * pendientes» y «Deshacer», que la borra (C3). En móvil, hoja con «Cancelar» arriba; en escritorio,
 * el diálogo con «Cancelar» y «Duplicar» abajo.
 */
export function DuplicateListDialog({
  list,
  open,
  onOpenChange,
}: {
  list: List
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const isDesktop = useMediaQuery('(min-width: 768px)')
  const online = useOnline()
  const navigate = useNavigate()
  const lists = useLists()
  const archived = useArchivedLists()
  const shared = !list.isOwner
  const people = useListPeople(list.id, shared && open)
  const owner = people.data?.find((person) => person.isOwner)
  const ownerName = shared && owner ? personName(owner.displayName) : null
  const duplicate = useDuplicateList()
  const deleteList = useDeleteList()

  const taken = [...(lists.data?.lists ?? []), ...(archived.data ?? [])].map((entry) => entry.name)
  const proposed = copyName(list.name, taken, ownerName)
  // Mientras no se toca, sigue la propuesta (el nombre del dueño llega un momento después).
  const [typed, setTyped] = useState<string | null>(null)
  const name = typed ?? proposed
  const count = list.counters.pending + list.counters.done
  const valid = name.trim().length > 0

  const submit = () => {
    if (!valid || !online || duplicate.isPending) return
    duplicate.mutate(
      { list, name },
      {
        onSuccess: (copy) => {
          onOpenChange(false)
          void navigate({ to: '/lists/$listId', params: { listId: copy.listId } })
          // Sin icono, como en C3: así cabe «Copia creada · 24 cosas pendientes» en el móvil.
          showUndoToast({
            message: duplicatedMessage(copy.items),
            onUndo: () => {
              deleteList.mutate({ ...list, id: copy.listId, name, isOwner: true, archivedAt: null })
              void navigate({ to: '/' })
            },
          })
        },
      },
    )
  }

  const cancel = (
    <button
      type="button"
      onClick={() => {
        onOpenChange(false)
      }}
      className="rounded-md text-[15px] font-semibold text-muted-foreground outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"
    >
      Cancelar
    </button>
  )

  const button = (
    <button
      type="submit"
      disabled={!valid || !online || duplicate.isPending}
      className={cn(
        'flex items-center justify-center gap-2 bg-primary font-display font-bold text-primary-foreground outline-none hover:bg-primary-hover focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:bg-control disabled:text-white',
        isDesktop ? 'h-11 rounded-[14px] px-[18px] text-[15px]' : 'h-13 rounded-2xl text-base',
      )}
    >
      <CopyPlus aria-hidden className="size-[18px]" strokeWidth={2.2} />
      {duplicate.isPending ? 'Duplicando…' : 'Duplicar'}
    </button>
  )

  const note = shared
    ? `La lista de ${ownerName ?? 'quien la creó'} no cambia y tú sigues en ella.`
    : list.archivedAt
      ? `La copia sale en tus listas. «${list.name}» sigue archivada.`
      : null

  return (
    <ResponsiveSheet
      open={open}
      onOpenChange={(next) => {
        if (!next) setTyped(null)
        onOpenChange(next)
      }}
      isDesktop={isDesktop}
      title={`Duplicar «${shared && ownerName ? `${list.name} de ${ownerName}` : list.name}»`}
      headerAction={cancel}
    >
      <form
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault()
          submit()
        }}
      >
        <label className="flex flex-col gap-2">
          <span className="px-1 font-sans text-xs font-bold tracking-[0.06em] text-muted-foreground uppercase">
            Nombre de la copia
          </span>
          <span className="flex h-13 items-center gap-3 rounded-2xl border border-primary bg-card px-3 shadow-[0_0_0_0.5px_var(--primary)]">
            <ListIcon name={name || list.name} color={list.color} size="xs" />
            <input
              value={name}
              maxLength={LIST_NAME_MAX_LENGTH}
              autoComplete="off"
              onChange={(event) => {
                setTyped(event.target.value)
              }}
              className="h-full min-w-0 flex-1 bg-transparent text-base outline-none"
            />
          </span>
        </label>

        <dl className="grid grid-cols-[auto_1fr] gap-x-[22px] gap-y-2.5 rounded-2xl border border-border-soft bg-fill/60 p-3.5 text-[14px] leading-[1.45]">
          <dt className="font-bold">Se copia</dt>
          <dd className="text-muted-foreground">{copiedSummary(count)}</dd>
          <dt className="font-bold">No se copia</dt>
          <dd className="text-muted-foreground">{notCopiedSummary(shared)}</dd>
        </dl>

        {note && <p className="-mt-1 px-1 text-[13px] text-muted-foreground">{note}</p>}
        {!online && (
          <p className="flex gap-2 px-1 text-[13px] leading-[1.45] text-muted-foreground">
            <WifiOff aria-hidden className="mt-0.5 size-3.5 shrink-0" strokeWidth={2.2} />
            Para duplicar hace falta conexión.
          </p>
        )}
        {duplicate.isError && (
          <p role="alert" className="px-1 text-[13px] text-error">
            No se ha podido duplicar. Prueba otra vez.
          </p>
        )}

        {isDesktop ? (
          <div className="flex items-center justify-end gap-5">
            {cancel}
            {button}
          </div>
        ) : (
          button
        )}
      </form>
    </ResponsiveSheet>
  )
}
