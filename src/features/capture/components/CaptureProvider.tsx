import { useRouterState } from '@tanstack/react-router'
import { Check } from 'lucide-react'
import { Dialog } from 'radix-ui'
import { useCallback, useMemo, useState, type ReactNode } from 'react'

import { KeyboardSheetContent } from '@/components/KeyboardSheet'
import {
  destinationShortName,
  destinationsOf,
  newItemKindAndStatus,
  useCreateItem,
  useDeleteItem,
  useFillCapturedLink,
  useSublists,
  type Destination,
  type NewItemLink,
} from '@/features/items'
import { useLists, type List } from '@/features/lists'
import { useProfile } from '@/features/profile'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import { showUndoToast } from '@/lib/undoToast'

import { CaptureContext, type CaptureApi, type OpenCaptureOptions } from '../captureContext'
import { useCaptureShortcut } from '../hooks/useCaptureShortcut'
import { CaptureForm } from './CaptureForm'

interface CaptureState {
  open: boolean
  text: string
  /**
   * La lista o sublista abierta al capturar: el id sale de la URL (`/lists/$listId`, o
   * `/lists/$listId/$sublistId` dentro de una sublista, que sale elegida: diseño 12, A4).
   */
  originId: string | undefined
  /** Cada apertura empieza de cero: texto, lista elegida, «···» cerrado. */
  session: number
}

const LIST_PATH = /^\/lists\/([^/]+)(?:\/([^/]+))?/

/**
 * Captura rápida para toda la zona privada (02 §Captura rápida, pantalla 3 y diseño 07). La abren
 * el botón + de móvil, el botón del sidebar, el atajo ⌘⇧Espacio y la ruta `/add` (también el
 * Atajo de iOS, con `?url=`). Guardar cierra
 * al instante, crea el ítem de forma optimista (también sin red) y enseña «Guardado en Casa» con
 * «Deshacer», que lo borra.
 */
export function CaptureProvider({ children }: { children: ReactNode }) {
  const isDesktop = useMediaQuery('(min-width: 768px)')
  const pathname = useRouterState({ select: (state) => state.location.pathname })
  const lists = useLists()
  const sublists = useSublists()
  const profile = useProfile()
  const createItem = useCreateItem()
  const deleteItem = useDeleteItem()
  const fillLink = useFillCapturedLink()
  const [state, setState] = useState<CaptureState>({
    open: false,
    text: '',
    originId: undefined,
    session: 0,
  })

  const open = useCallback(
    (options?: OpenCaptureOptions) => {
      const match = LIST_PATH.exec(pathname)
      const originId = match?.[2] ?? match?.[1]
      setState((current) => ({
        open: true,
        text: options?.text ?? '',
        originId,
        session: current.session + 1,
      }))
    },
    [pathname],
  )
  const close = useCallback(() => {
    setState((current) => ({ ...current, open: false }))
  }, [])

  const openFromShortcut = useCallback(() => {
    open()
  }, [open])
  useCaptureShortcut(openFromShortcut)

  const all: List[] = lists.data
    ? [...(lists.data.inbox ? [lists.data.inbox] : []), ...lists.data.lists]
    : []
  const destinations = destinationsOf(all, sublists)
  const origin = destinations.find((destination) => destination.id === state.originId)

  // Dentro de una sublista, lo capturado nace con el tipo por defecto de su lista. Con un enlace
  // cuya página aún no había llegado, se completa cuando llegue.
  const save = (title: string, destination: Destination, link: NewItemLink | undefined) => {
    const { list, sublist } = destination
    const item = {
      id: crypto.randomUUID(),
      listId: list.id,
      parentId: sublist?.id ?? null,
      title,
      ...newItemKindAndStatus(list.kind),
      ...(link && { link }),
    }
    createItem.mutate(item)
    fillLink(item)
    close()
    showUndoToast({
      icon: Check,
      message: `Guardado en ${destinationShortName(destination)}`,
      onUndo: () => {
        deleteItem.mutate(item)
      },
    })
  }

  const api = useMemo<CaptureApi>(() => ({ open, isOpen: state.open }), [open, state.open])

  const form = (
    <CaptureForm
      key={state.session}
      variant={isDesktop ? 'dialog' : 'sheet'}
      destinations={destinations}
      initialText={state.text}
      origin={origin}
      defaultListId={profile.data?.settings.defaultListId ?? null}
      onSave={save}
      onClose={close}
    />
  )

  return (
    <CaptureContext value={api}>
      {children}
      <Dialog.Root
        open={state.open}
        onOpenChange={(next) => {
          if (!next) close()
        }}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-scrim" />
          {isDesktop ? (
            <Dialog.Content
              aria-describedby={undefined}
              // El campo ya se enfoca solo (`autoFocus`); sin esto, Radix pondría el foco en «Cerrar».
              onOpenAutoFocus={(event) => {
                event.preventDefault()
              }}
              className="fixed top-[120px] left-1/2 z-50 w-[720px] max-w-[calc(100vw-2rem)] -translate-x-1/2 rounded-3xl border border-border bg-card px-6 pt-[22px] pb-5 text-foreground shadow-dialog outline-none"
            >
              <Dialog.Title className="sr-only">Captura rápida</Dialog.Title>
              {form}
            </Dialog.Content>
          ) : (
            <KeyboardSheetContent title="Captura rápida">{form}</KeyboardSheetContent>
          )}
        </Dialog.Portal>
      </Dialog.Root>
    </CaptureContext>
  )
}
