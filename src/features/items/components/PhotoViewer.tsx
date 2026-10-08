import { ArrowUp, Camera, ChevronLeft, ChevronRight, Trash2, X } from 'lucide-react'
import { Dialog } from 'radix-ui'
import { useEffect, useRef, type KeyboardEvent } from 'react'

import { cn } from '@/lib/utils'

import { usePhotoSrc } from '../hooks/usePhoto'

/** Una foto del visor: propia (`path`) o la de la web de su enlace (`url`). */
export interface ViewerPhoto {
  key: string
  path: string | null
  url: string | null
}

interface PhotoViewerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  photos: readonly ViewerPhoto[]
  index: number
  onIndexChange: (index: number) => void
  isDesktop: boolean
  online: boolean
  onChange: (index: number) => void
  /** Sin él (la imagen de la web), no hay «Poner la primera». */
  onMakeFirst?: ((index: number) => void) | undefined
  onRemove: (index: number) => void
}

/**
 * Las fotos en grande (diseño 15, M11, M15, D4 y D8; diseño 23, D8, D9 y E6): fondo casi negro (los
 * tokens del modo oscuro, también con la app en claro). En el móvil, cerrar y «2 de 5» arriba, la
 * foto, que pasa a la siguiente deslizando, los puntos y «Cambiar», «Poner la primera» y «Quitar»
 * abajo. En escritorio, el título con «2 de 5» y las acciones arriba, flechas a los lados, las
 * miniaturas abajo, ← → para pasar y Esc para cerrar. Con una sola foto, sin contar ni puntos.
 */
export function PhotoViewer({
  open,
  onOpenChange,
  title,
  photos,
  index,
  onIndexChange,
  isDesktop,
  online,
  onChange,
  onMakeFirst,
  onRemove,
}: PhotoViewerProps) {
  const several = photos.length > 1
  const counter = `${String(index + 1)} de ${String(photos.length)}`
  const go = (next: number) => {
    onIndexChange(Math.min(photos.length - 1, Math.max(0, next)))
  }

  const actions = (
    <>
      <ActionButton
        icon={Camera}
        label="Cambiar"
        disabled={!online}
        desktop={isDesktop}
        onClick={() => {
          onChange(index)
        }}
      />
      {onMakeFirst && index > 0 && (
        <ActionButton
          icon={ArrowUp}
          label="Poner la primera"
          desktop={isDesktop}
          onClick={() => {
            onMakeFirst(index)
          }}
        />
      )}
      <ActionButton
        icon={Trash2}
        label="Quitar"
        danger
        desktop={isDesktop}
        onClick={() => {
          onRemove(index)
        }}
      />
    </>
  )

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[70] bg-viewer-scrim" />
        <Dialog.Content
          aria-describedby={undefined}
          onKeyDown={(event: KeyboardEvent) => {
            if (event.key === 'ArrowRight') go(index + 1)
            if (event.key === 'ArrowLeft') go(index - 1)
          }}
          className={cn(
            'dark fixed inset-0 z-[70] flex flex-col text-foreground outline-none',
            isDesktop
              ? 'px-6 pt-5 pb-6'
              : 'bg-background pt-[calc(env(safe-area-inset-top)+0.75rem)] pb-[calc(env(safe-area-inset-bottom)+1rem)]',
          )}
        >
          {isDesktop ? (
            <div className="flex items-center gap-4">
              <Dialog.Title className="min-w-0 flex-1 truncate font-sans text-[15px] font-semibold">
                {several ? `${title} · ${counter}` : title}
              </Dialog.Title>
              <div className="flex items-center gap-5">{actions}</div>
              <kbd className="rounded-[5px] bg-fill px-1.5 py-0.5 font-sans text-[11px] text-muted-foreground">
                Esc
              </kbd>
              <CloseButton desktop />
            </div>
          ) : (
            <div className="flex h-11 items-center gap-3 px-4">
              <CloseButton desktop={false} />
              <Dialog.Title className="sr-only">{title}</Dialog.Title>
              <p
                aria-hidden={!several}
                className="min-w-0 flex-1 truncate pr-11 text-center font-sans text-[15px] font-semibold"
              >
                {several ? counter : title}
              </p>
            </div>
          )}

          {isDesktop ? (
            <div className="relative flex min-h-0 flex-1 items-center justify-center py-6">
              {several && (
                <NavButton
                  side="left"
                  disabled={index === 0}
                  onClick={() => {
                    go(index - 1)
                  }}
                />
              )}
              {photos[index] && (
                <PhotoImage
                  photo={photos[index]}
                  title={title}
                  className="max-h-full max-w-[760px]"
                />
              )}
              {several && (
                <NavButton
                  side="right"
                  disabled={index === photos.length - 1}
                  onClick={() => {
                    go(index + 1)
                  }}
                />
              )}
            </div>
          ) : (
            <Slides photos={photos} index={index} title={title} onIndexChange={onIndexChange} />
          )}

          {several &&
            (isDesktop ? (
              <div className="flex justify-center gap-2">
                {photos.map((photo, at) => (
                  <button
                    key={photo.key}
                    type="button"
                    aria-label={`Foto ${String(at + 1)}`}
                    aria-current={at === index}
                    onClick={() => {
                      go(at)
                    }}
                    className={cn(
                      'h-12 w-16 overflow-hidden rounded-[10px] bg-fill outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50',
                      at === index ? 'ring-2 ring-foreground' : 'opacity-60 hover:opacity-100',
                    )}
                  >
                    <PhotoImage
                      photo={photo}
                      title=""
                      size="thumb"
                      className="size-full object-cover"
                    />
                  </button>
                ))}
              </div>
            ) : (
              <div aria-hidden className="flex justify-center gap-1.5 pb-4">
                {photos.map((photo, at) => (
                  <span
                    key={photo.key}
                    className={cn(
                      'h-1.5 rounded-full transition-all',
                      at === index ? 'w-5 bg-foreground' : 'w-1.5 bg-subtle-foreground',
                    )}
                  />
                ))}
              </div>
            ))}

          {!isDesktop && <div className="flex justify-around px-4">{actions}</div>}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

/** Las fotos en fila, una por pantalla: se pasa de una a otra deslizando (D9). */
function Slides({
  photos,
  index,
  title,
  onIndexChange,
}: {
  photos: readonly ViewerPhoto[]
  index: number
  title: string
  onIndexChange: (index: number) => void
}) {
  const strip = useRef<HTMLDivElement>(null)
  // Al abrir (o al quitar una), la que toca a la vista, sin animación.
  useEffect(() => {
    const element = strip.current
    if (!element) return
    const target = index * element.clientWidth
    if (Math.abs(element.scrollLeft - target) > 1) element.scrollTo({ left: target })
  }, [index, photos.length])
  return (
    <div
      ref={strip}
      onScroll={(event) => {
        const element = event.currentTarget
        if (element.clientWidth === 0) return
        const at = Math.round(element.scrollLeft / element.clientWidth)
        if (at !== index) onIndexChange(at)
      }}
      className="flex min-h-0 flex-1 snap-x snap-mandatory [scrollbar-width:none] overflow-x-auto py-6"
    >
      {photos.map((photo) => (
        <div
          key={photo.key}
          className="flex w-full shrink-0 snap-center items-center justify-center"
        >
          <PhotoImage photo={photo} title={title} className="max-h-full max-w-full" />
        </div>
      ))}
    </div>
  )
}

function PhotoImage({
  photo,
  title,
  size = 'full',
  className,
}: {
  photo: ViewerPhoto
  title: string
  size?: 'thumb' | 'full'
  className?: string
}) {
  const { src } = usePhotoSrc({ imagePath: photo.path, imageUrl: photo.url }, size)
  if (!src) return null
  return (
    <img
      src={src}
      alt={title ? `Foto de «${title}»` : ''}
      referrerPolicy="no-referrer"
      draggable={false}
      className={cn('rounded-md object-contain', className)}
    />
  )
}

function ActionButton({
  icon: Icon,
  label,
  danger = false,
  disabled = false,
  desktop,
  onClick,
}: {
  icon: typeof Camera
  label: string
  danger?: boolean
  disabled?: boolean
  desktop: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'flex items-center rounded-lg font-semibold outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-50',
        desktop ? 'h-9 text-[14px] hover:opacity-80' : 'min-w-20 flex-col gap-1.5 py-1 text-[13px]',
        danger ? 'text-error' : 'text-foreground',
      )}
    >
      {!desktop && <Icon aria-hidden className="size-[18px]" strokeWidth={2.2} />}
      {label}
    </button>
  )
}

function NavButton({
  side,
  disabled,
  onClick,
}: {
  side: 'left' | 'right'
  disabled: boolean
  onClick: () => void
}) {
  const Icon = side === 'left' ? ChevronLeft : ChevronRight
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      aria-label={side === 'left' ? 'Foto anterior' : 'Foto siguiente'}
      className={cn(
        'absolute top-1/2 grid size-13 -translate-y-1/2 place-items-center rounded-full bg-fill text-foreground outline-none hover:bg-border focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-30',
        side === 'left' ? 'left-0' : 'right-0',
      )}
    >
      <Icon aria-hidden className="size-6" strokeWidth={2.2} />
    </button>
  )
}

function CloseButton({ desktop }: { desktop: boolean }) {
  return (
    <Dialog.Close
      aria-label="Cerrar la foto"
      className={cn(
        'grid shrink-0 place-items-center rounded-full text-foreground outline-none hover:bg-fill focus-visible:ring-[3px] focus-visible:ring-ring/50',
        desktop ? 'size-9' : 'size-11',
      )}
    >
      <X aria-hidden className="size-5" strokeWidth={2.2} />
    </Dialog.Close>
  )
}
