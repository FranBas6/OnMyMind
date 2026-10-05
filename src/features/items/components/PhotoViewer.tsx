import { Camera, Trash2, X } from 'lucide-react'
import { Dialog } from 'radix-ui'

import { cn } from '@/lib/utils'

import { usePhotoSrc } from '../hooks/usePhoto'
import type { Item } from '../types'

interface PhotoViewerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  item: Item
  isDesktop: boolean
  online: boolean
  onChange: () => void
  onRemove: () => void
}

/**
 * La foto en grande (diseño 15, M11, M15, D4 y D8): fondo casi negro (los tokens del modo oscuro,
 * también con la app en claro), el título arriba, cerrar, y «Cambiar» y «Quitar» abajo. En
 * escritorio, una caja de luz sobre la pantalla que se cierra con Esc.
 */
export function PhotoViewer({
  open,
  onOpenChange,
  item,
  isDesktop,
  online,
  onChange,
  onRemove,
}: PhotoViewerProps) {
  const { src } = usePhotoSrc(item, 'full')

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[70] bg-viewer-scrim" />
        <Dialog.Content
          aria-describedby={undefined}
          className={cn(
            'dark fixed inset-0 z-[70] flex flex-col text-foreground outline-none',
            isDesktop
              ? 'items-center justify-center gap-5 p-8'
              : 'bg-background px-4 pt-[calc(env(safe-area-inset-top)+0.75rem)] pb-[calc(env(safe-area-inset-bottom)+1rem)]',
          )}
        >
          <div
            className={cn(
              'flex items-center gap-3',
              isDesktop ? 'w-full max-w-[480px] justify-center' : 'h-11',
            )}
          >
            {!isDesktop && <CloseButton />}
            <Dialog.Title
              className={cn(
                'min-w-0 truncate font-sans text-[13px] font-medium text-muted-foreground',
                !isDesktop && 'flex-1 pr-11 text-center',
              )}
            >
              {item.title}
            </Dialog.Title>
          </div>
          {isDesktop && (
            <div className="absolute top-6 right-6 flex items-center gap-2">
              <kbd className="rounded-[5px] bg-fill px-1.5 py-0.5 font-sans text-[11px] text-muted-foreground">
                Esc
              </kbd>
              <CloseButton />
            </div>
          )}

          <div
            className={cn(
              'flex min-h-0 items-center justify-center',
              isDesktop ? 'max-h-[600px] max-w-[480px]' : 'flex-1 py-6',
            )}
          >
            {src && (
              <img
                src={src}
                alt={`Foto de «${item.title}»`}
                referrerPolicy="no-referrer"
                className="max-h-full max-w-full rounded-md object-contain"
              />
            )}
          </div>

          <div className={cn('grid grid-cols-2 gap-2.5', isDesktop ? 'w-[240px]' : '')}>
            <button
              type="button"
              disabled={!online}
              onClick={onChange}
              className="flex h-13 items-center justify-center gap-2 rounded-md bg-fill font-display text-base font-bold text-foreground outline-none hover:bg-border focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-50 md:h-11 md:rounded-[12px] md:text-[15px]"
            >
              <Camera aria-hidden className="size-4" strokeWidth={2.2} />
              Cambiar
            </button>
            <button
              type="button"
              onClick={onRemove}
              className="flex h-13 items-center justify-center gap-2 rounded-md bg-priority-high-bg font-display text-base font-bold text-error outline-none hover:brightness-110 focus-visible:ring-[3px] focus-visible:ring-ring/50 md:h-11 md:rounded-[12px] md:text-[15px]"
            >
              <Trash2 aria-hidden className="size-4" strokeWidth={2.2} />
              Quitar
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

function CloseButton() {
  return (
    <Dialog.Close
      aria-label="Cerrar la foto"
      className="grid size-11 shrink-0 place-items-center rounded-full bg-fill text-foreground outline-none hover:bg-border focus-visible:ring-[3px] focus-visible:ring-ring/50"
    >
      <X aria-hidden className="size-5" strokeWidth={2.2} />
    </Dialog.Close>
  )
}
