import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import {
  horizontalListSortingStrategy,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { ArrowUp, Camera, CircleAlert, Eye, LoaderCircle, Trash2, WifiOff } from 'lucide-react'
import { ContextMenu } from 'radix-ui'
import { useState, type ComponentProps, type ReactNode } from 'react'

import { BottomSheet } from '@/components/BottomSheet'
import {
  isTouchStart,
  LIFT_DELAY_MS,
  LIFT_TOLERANCE_PX,
  liftHaptic,
} from '@/hooks/useReorderSensors'
import { cn } from '@/lib/utils'

import { usePhotoSrc, type PendingPhoto } from '../hooks/usePhoto'
import { MAX_PHOTOS } from '../photos'
import type { ItemImage } from '../types'

interface PhotoStripProps {
  images: readonly ItemImage[]
  pending: readonly PendingPhoto[]
  online: boolean
  isDesktop: boolean
  onOpen: (index: number) => void
  onAdd: () => void
  /** Arrastrar: dejar `imageId` donde estaba `overId`. */
  onMove: (imageId: string, overId: string) => void
  onMakeFirst: (index: number) => void
  onRemove: (index: number) => void
  onRetry: (key: string) => void
  onDiscard: (key: string) => void
}

/**
 * Las fotos de una cosa (diseño 23, D2, D4, D5, D6, D7 y D13; E5 en escritorio): «FOTOS» con «5 de
 * 10» y una tira de cuadrados de 96 px que se desliza de lado; la primera lleva «Miniatura», que es
 * la de la fila. Al final, el cuadrado «+ Foto» (sin red, «Necesita conexión»; con 10, ninguno y una
 * línea que lo dice). Se ordenan manteniendo pulsada y arrastrando, como las filas (diseño 14);
 * mantener pulsada sin mover abre «Poner la primera / Ver en grande / Quitar» (D6), que en
 * escritorio sale con el botón derecho.
 */
export function PhotoStrip({
  images,
  pending,
  online,
  isDesktop,
  onOpen,
  onAdd,
  onMove,
  onMakeFirst,
  onRemove,
  onRetry,
  onDiscard,
}: PhotoStripProps) {
  // Como las filas (diseño 14), salvo el teclado: Intro abre la foto y Espacio la levanta.
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: LIFT_DELAY_MS, tolerance: LIFT_TOLERANCE_PX },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
      keyboardCodes: { start: ['Space'], cancel: ['Escape'], end: ['Space'] },
    }),
  )
  const [lifted, setLifted] = useState<string | null>(null)
  const [menu, setMenu] = useState<number | null>(null)
  const adding = pending.filter((photo) => photo.replaces === null)
  const count = images.length + adding.length
  const full = count >= MAX_PHOTOS
  const failed = pending.filter((photo) => photo.status === 'error')

  const onDragStart = ({ active, activatorEvent }: DragStartEvent) => {
    setLifted(String(active.id))
    if (isTouchStart(activatorEvent)) liftHaptic()
  }
  const onDragEnd = ({ active, over, delta, activatorEvent }: DragEndEvent) => {
    setLifted(null)
    const id = String(active.id)
    // Soltar sin mover, con el dedo: el menú de la foto (D6).
    if (isTouchStart(activatorEvent) && Math.abs(delta.x) < 8 && Math.abs(delta.y) < 8) {
      const index = images.findIndex((image) => image.id === id)
      if (index >= 0) setMenu(index)
      return
    }
    if (over && over.id !== active.id) onMove(id, String(over.id))
  }

  const tiles = images.map((image, index) => {
    const replacing = pending.find((photo) => photo.replaces === image.id)
    if (replacing) return <PendingTile key={replacing.key} photo={replacing} />
    const tile = (
      <SortableTile
        key={image.id}
        image={image}
        index={index}
        total={images.length}
        onOpen={() => {
          onOpen(index)
        }}
      />
    )
    if (!isDesktop) return tile
    return (
      <ContextMenu.Root key={image.id} modal={false}>
        <ContextMenu.Trigger asChild>{tile}</ContextMenu.Trigger>
        <ContextMenu.Portal>
          <ContextMenu.Content
            aria-label={`Foto ${String(index + 1)} de ${String(images.length)}`}
            className="z-[60] w-[220px] rounded-2xl border border-border-soft bg-card p-1.5 text-foreground shadow-popover outline-none"
          >
            {menuEntries(index, { onMakeFirst, onOpen, onRemove }).map((entry) => (
              <ContextMenu.Item
                key={entry.label}
                onSelect={entry.onSelect}
                className={cn(
                  'flex h-11 cursor-pointer items-center gap-3 rounded-xl px-3.5 text-[15px] font-medium outline-none select-none data-highlighted:bg-fill',
                  entry.destructive
                    ? 'text-destructive'
                    : 'text-foreground [&_svg]:text-muted-foreground',
                )}
              >
                <entry.icon aria-hidden className="size-[18px]" strokeWidth={2} />
                {entry.label}
              </ContextMenu.Item>
            ))}
          </ContextMenu.Content>
        </ContextMenu.Portal>
      </ContextMenu.Root>
    )
  })

  return (
    <section aria-label="Fotos" className="flex flex-col gap-2">
      <div className="flex items-center justify-between px-1">
        <h3 className="font-sans text-xs font-bold tracking-[0.06em] text-muted-foreground uppercase">
          Fotos
        </h3>
        <span
          className={cn('text-xs', full ? 'font-bold text-foreground' : 'text-subtle-foreground')}
        >
          {count} de {MAX_PHOTOS}
        </span>
      </div>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        onDragCancel={() => {
          setLifted(null)
        }}
      >
        <SortableContext
          items={images.map((image) => image.id)}
          strategy={horizontalListSortingStrategy}
        >
          <ul
            data-vaul-no-drag
            className="-mx-1 flex [scrollbar-width:none] gap-2 overflow-x-auto px-1 py-1"
          >
            {tiles.map((tile, index) => (
              <li key={images[index]?.id ?? index} className="shrink-0">
                {tile}
              </li>
            ))}
            {adding.map((photo) => (
              <li key={photo.key} className="shrink-0">
                <PendingTile photo={photo} />
              </li>
            ))}
            {!full && (
              <li className="shrink-0">
                <button
                  type="button"
                  disabled={!online}
                  onClick={onAdd}
                  aria-label={online ? 'Añadir fotos' : 'Añadir fotos: necesita conexión'}
                  className="flex size-24 flex-col items-center justify-center gap-1 rounded-[18px] border-[1.5px] border-dashed border-control text-[13px] font-semibold text-muted-foreground outline-none hover:border-primary hover:text-primary focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:hover:border-control disabled:hover:text-muted-foreground"
                >
                  {online ? (
                    <>
                      <Camera aria-hidden className="size-5" strokeWidth={2.2} />
                      Foto
                    </>
                  ) : (
                    <>
                      <WifiOff aria-hidden className="size-4" strokeWidth={2.2} />
                      <span className="text-center text-[12px] leading-tight">
                        Necesita
                        <br />
                        conexión
                      </span>
                    </>
                  )}
                </button>
              </li>
            )}
          </ul>
        </SortableContext>
      </DndContext>

      {failed.length > 0 && (
        <p role="alert" className="flex flex-wrap items-center gap-x-3 px-1 text-[13px] text-error">
          {failed.length === 1
            ? 'No se ha podido subir una foto.'
            : `No se han podido subir ${String(failed.length)} fotos.`}
          <button
            type="button"
            onClick={() => {
              for (const photo of failed) onRetry(photo.key)
            }}
            className="font-semibold text-primary outline-none hover:text-primary-hover focus-visible:underline"
          >
            Reintentar
          </button>
          <button
            type="button"
            onClick={() => {
              for (const photo of failed) onDiscard(photo.key)
            }}
            className="font-semibold text-muted-foreground outline-none hover:text-foreground focus-visible:underline"
          >
            Quitar
          </button>
        </p>
      )}
      {lifted ? (
        <p className="px-1 text-[13px] text-muted-foreground">
          Suelta en el primer sitio para que sea la miniatura.
        </p>
      ) : (
        full && (
          <p className="px-1 text-[13px] text-muted-foreground">
            Has llegado a 10 fotos. Quita alguna para añadir otra.
          </p>
        )
      )}

      {!isDesktop && (
        <PhotoMenuSheet
          image={menu === null ? null : (images[menu] ?? null)}
          index={menu ?? 0}
          total={images.length}
          onClose={() => {
            setMenu(null)
          }}
          entries={
            menu === null
              ? []
              : menuEntries(menu, {
                  onMakeFirst,
                  onOpen,
                  onRemove,
                })
          }
        />
      )}
    </section>
  )
}

interface MenuEntry {
  label: string
  icon: typeof Eye
  trailing?: string
  destructive?: boolean
  onSelect: () => void
}

/** «Poner la primera» (salvo si ya lo es), «Ver en grande» y «Quitar» (D6). */
function menuEntries(
  index: number,
  actions: Pick<PhotoStripProps, 'onMakeFirst' | 'onOpen' | 'onRemove'>,
): MenuEntry[] {
  return [
    ...(index > 0
      ? [
          {
            label: 'Poner la primera',
            icon: ArrowUp,
            trailing: 'será la miniatura',
            onSelect: () => {
              actions.onMakeFirst(index)
            },
          },
        ]
      : []),
    {
      label: 'Ver en grande',
      icon: Eye,
      onSelect: () => {
        actions.onOpen(index)
      },
    },
    {
      label: 'Quitar',
      icon: Trash2,
      destructive: true,
      onSelect: () => {
        actions.onRemove(index)
      },
    },
  ]
}

/** El menú de una foto en el móvil (D6): la foto pequeña con «Foto 3 de 5» y sus acciones. */
function PhotoMenuSheet({
  image,
  index,
  total,
  entries,
  onClose,
}: {
  image: ItemImage | null
  index: number
  total: number
  entries: MenuEntry[]
  onClose: () => void
}) {
  const label = `Foto ${String(index + 1)} de ${String(total)}`
  const plain = entries.filter((entry) => !entry.destructive)
  const destructive = entries.filter((entry) => entry.destructive)
  const row = (entry: MenuEntry) => (
    <button
      key={entry.label}
      type="button"
      onClick={() => {
        onClose()
        entry.onSelect()
      }}
      className={cn(
        'flex h-13 w-full items-center gap-3 px-4 text-[15px] font-medium outline-none active:bg-fill',
        entry.destructive ? 'text-destructive' : 'text-foreground [&_svg]:text-muted-foreground',
      )}
    >
      <entry.icon aria-hidden className="size-[18px]" strokeWidth={2} />
      <span className="flex-1 text-left">{entry.label}</span>
      {entry.trailing && (
        <span className="text-[13px] text-subtle-foreground">{entry.trailing}</span>
      )}
    </button>
  )
  return (
    <BottomSheet
      nested
      open={image !== null}
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
      title={label}
    >
      <div className="flex items-center gap-3">
        {image && <Thumb path={image.path} className="size-14 rounded-[14px]" />}
        <p className="font-display text-base font-bold">{label}</p>
      </div>
      <div className="divide-y divide-border-soft overflow-hidden rounded-2xl border border-border-soft bg-card">
        {plain.map(row)}
      </div>
      <div className="overflow-hidden rounded-2xl border border-border-soft bg-card">
        {destructive.map(row)}
      </div>
    </BottomSheet>
  )
}

/** Una foto de la tira: se abre en grande al tocarla y se arrastra para ordenarla. */
function SortableTile({
  image,
  index,
  total,
  onOpen,
  ref,
  ...rest
}: {
  image: ItemImage
  index: number
  total: number
  onOpen: () => void
} & Omit<ComponentProps<'button'>, 'onClick'>) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: image.id,
  })
  // El menú del botón derecho (escritorio) le pasa sus props y su ref, además de las de arrastrar.
  const setRef = (node: HTMLButtonElement | null) => {
    setNodeRef(node)
    if (typeof ref === 'function') ref(node)
    else if (ref) ref.current = node
  }
  const first = index === 0
  return (
    <button
      {...rest}
      ref={setRef}
      type="button"
      onClick={onOpen}
      {...attributes}
      {...listeners}
      aria-label={`Foto ${String(index + 1)} de ${String(total)}${first ? ', la miniatura' : ''}`}
      aria-roledescription="foto que se puede ordenar"
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn(
        'relative block size-24 touch-manipulation overflow-hidden rounded-[18px] bg-fill outline-none select-none [-webkit-touch-callout:none] focus-visible:ring-[3px] focus-visible:ring-ring/50',
        isDragging && 'z-10 scale-105 shadow-lift',
      )}
    >
      <Thumb path={image.path} className="size-full" />
      {first && (
        <span className="absolute bottom-1.5 left-1.5 rounded-[7px] bg-foreground/80 px-1.5 py-0.5 text-[10.5px] font-bold text-background">
          Miniatura
        </span>
      )}
    </button>
  )
}

/** Una que se está subiendo (con un velo) o que no se pudo (en rojo). */
function PendingTile({ photo }: { photo: PendingPhoto }) {
  if (photo.status === 'error') {
    return (
      <div className="flex size-24 flex-col items-center justify-center gap-1.5 rounded-[18px] border-[1.5px] border-error bg-priority-high-bg text-error">
        <CircleAlert aria-hidden className="size-5" strokeWidth={2.2} />
        <span className="text-[11px] font-bold">No se subió</span>
      </div>
    )
  }
  return (
    <div
      role="status"
      aria-label="Subiendo la foto…"
      className="relative size-24 overflow-hidden rounded-[18px] bg-fill"
    >
      <img src={photo.preview} alt="" className="size-full object-cover" />
      <span className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 bg-scrim text-white">
        <LoaderCircle aria-hidden className="size-6 animate-spin" strokeWidth={2.4} />
        <span className="text-[11px] font-bold">Subiendo…</span>
      </span>
    </div>
  )
}

function Thumb({ path, className }: { path: string; className?: string }): ReactNode {
  const { src } = usePhotoSrc({ imagePath: path, imageUrl: null }, 'thumb')
  return (
    <span className={cn('block overflow-hidden bg-fill', className)}>
      {src && <img src={src} alt="" draggable={false} className="size-full object-cover" />}
    </span>
  )
}
