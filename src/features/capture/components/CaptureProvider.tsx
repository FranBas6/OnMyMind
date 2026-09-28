import { useRouterState } from '@tanstack/react-router'
import { Check } from 'lucide-react'
import { Dialog } from 'radix-ui'
import { useCallback, useMemo, useState, type ReactNode } from 'react'

import { initialStatus, useCreateItem, useDeleteItem } from '@/features/items'
import { useLists, type List } from '@/features/lists'
import { useKeyboardInset } from '@/hooks/useKeyboardInset'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import { showUndoToast } from '@/lib/undoToast'
import { cn } from '@/lib/utils'

import { CaptureContext, type CaptureApi, type OpenCaptureOptions } from '../captureContext'
import { useCaptureShortcut } from '../hooks/useCaptureShortcut'
import { CaptureForm } from './CaptureForm'

interface CaptureState {
  open: boolean
  text: string
  /** La lista abierta al capturar (su id sale de la URL `/lists/$listId`). */
  originId: string | undefined
  /** Cada apertura empieza de cero: texto, lista elegida, «···» cerrado. */
  session: number
}

const LIST_PATH = /^\/lists\/([^/]+)/

/**
 * Captura rápida para toda la zona privada (02 §Captura rápida, pantalla 3 y diseño 07). La abren
 * el botón + de móvil, el botón del sidebar, el atajo ⌘⇧Espacio y la ruta `/add`. Guardar cierra
 * al instante, crea el ítem de forma optimista (también sin red) y enseña «Guardado en Casa» con
 * «Deshacer», que lo borra.
 */
export function CaptureProvider({ children }: { children: ReactNode }) {
  const isDesktop = useMediaQuery('(min-width: 768px)')
  const pathname = useRouterState({ select: (state) => state.location.pathname })
  const lists = useLists()
  const createItem = useCreateItem()
  const deleteItem = useDeleteItem()
  const [state, setState] = useState<CaptureState>({
    open: false,
    text: '',
    originId: undefined,
    session: 0,
  })

  const open = useCallback(
    (options?: OpenCaptureOptions) => {
      const originId = LIST_PATH.exec(pathname)?.[1]
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
  const origin = all.find((list) => list.id === state.originId)

  const save = (title: string, list: List) => {
    const item = {
      id: crypto.randomUUID(),
      listId: list.id,
      title,
      status: initialStatus(list.kind),
    }
    createItem.mutate(item)
    close()
    showUndoToast({
      icon: Check,
      message: `Guardado en ${list.name}`,
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
      lists={all}
      initialText={state.text}
      origin={origin}
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
            <MobileSheet>{form}</MobileSheet>
          )}
        </Dialog.Portal>
      </Dialog.Root>
    </CaptureContext>
  )
}

/**
 * Hoja de móvil pegada encima del teclado: su `bottom` es lo que tapa el teclado
 * (`useKeyboardInset`, con `visualViewport`). Sin teclado (eligiendo lista con «···»), baja al
 * fondo y deja la zona segura del indicador de inicio.
 */
function MobileSheet({ children }: { children: ReactNode }) {
  const keyboard = useKeyboardInset()
  return (
    <Dialog.Content
      aria-describedby={undefined}
      onOpenAutoFocus={(event) => {
        event.preventDefault()
      }}
      style={{ bottom: keyboard }}
      className={cn(
        'fixed inset-x-0 z-50 max-h-[90dvh] overflow-y-auto rounded-t-[28px] bg-card px-[22px] pt-2.5 text-foreground shadow-sheet outline-none',
        keyboard === 0 && 'pb-[env(safe-area-inset-bottom)]',
      )}
    >
      <div aria-hidden className="mx-auto mb-4 h-[5px] w-10 rounded-[3px] bg-border" />
      <Dialog.Title className="sr-only">Captura rápida</Dialog.Title>
      {children}
    </Dialog.Content>
  )
}
