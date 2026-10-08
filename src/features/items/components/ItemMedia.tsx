import { Camera, ExternalLink, Link2, LoaderCircle, Trash2, WifiOff, X } from 'lucide-react'
import { useRef, useState } from 'react'

import { dropNeighbors, reorder, POSITION_STEP } from '@/lib/reorder'
import { showUndoToast } from '@/lib/undoToast'
import { cn } from '@/lib/utils'

import { useImageMutation } from '../hooks/useItemMutations'
import type { LinkState } from '../hooks/useLinkMetadata'
import { usePhotoSrc, usePhotoUploads } from '../hooks/usePhoto'
import { linkDomain, linkPath } from '../links'
import type { Item, ItemImage, ItemPatch } from '../types'
import { hasStores, sameLink } from '../stores'
import { LinkInput } from './LinkInput'
import { AddStoreButton } from './Stores'
import { PhotoStrip } from './PhotoStrip'
import { PhotoViewer, type ViewerPhoto } from './PhotoViewer'

interface ItemMediaProps {
  item: Item
  isDesktop: boolean
  online: boolean
  /** Cómo va el título del enlace: lo busca `useLinkMetadata`, que comparte con el precio. */
  linkState: LinkState
  /** En una compra: «+ Otra tienda» bajo su enlace (diseño 19, T1 y T2). */
  onAddStore?: ((url: string) => void) | undefined
  onUpdate: (item: Item, patch: ItemPatch) => void
}

/**
 * Las fotos y el enlace de un ítem, debajo de las notas (diseño 15; diseño 23, D). Sin nada, dos
 * botones a medias, «+ Foto» y «+ Enlace» (D1). Con fotos propias, su tira, con «5 de 10» y el
 * «+ Foto» al final (`PhotoStrip`); con solo la imagen de la web, su cuadrado de 96 px con «De la
 * web», como en la 2a.6. Después la fila del enlace, y el botón que falta va debajo, a todo el
 * ancho. Pegar un enlace lo guarda al momento y busca solo el título y la imagen de la página
 * (`useLinkMetadata`): si la cosa aún no tenía foto, esa imagen pasa a serlo, con «De la web».
 */
export function ItemMedia({
  item,
  isDesktop,
  online,
  linkState,
  onAddStore,
  onUpdate,
}: ItemMediaProps) {
  const [editingLink, setEditingLink] = useState(false)
  const [addingStore, setAddingStore] = useState(false)
  const [viewing, setViewing] = useState<number | null>(null)
  // «Cambiar» en el visor: la foto que se sustituye al elegir otra.
  const replacing = useRef<ItemImage | null>(null)
  const picker = useRef<HTMLInputElement>(null)
  const images = useImageMutation()
  const upload = usePhotoUploads(item, {
    onUploaded: (image) => {
      images.mutate({ type: 'add', item, images: [image] })
    },
    onReplaced: (imageId, path) => {
      images.mutate({ type: 'update', item, imageId, patch: { path } })
    },
  })
  const web = usePhotoSrc({ imagePath: null, imageUrl: item.imageUrl }, 'thumb')

  const own = item.images
  const hasOwn = own.length > 0 || upload.pending.length > 0
  const webOnly = !hasOwn && item.imageUrl !== null
  // Con varias tiendas el enlace vive en «Dónde comprarlo» (diseño 19, T10); aquí quedan las fotos.
  const stores = hasStores(item)
  const hasLink = item.url !== null && !stores

  const pickPhotos = (replace: ItemImage | null = null) => {
    replacing.current = replace
    picker.current?.click()
  }
  const saveLink = (url: string) => {
    setEditingLink(false)
    onUpdate(item, { url, urlTitle: null, urlSite: null })
  }

  // Quitar, con «Deshacer», que la devuelve tal cual (D10). El archivo lo borra la limpieza de
  // huérfanas cuando ya no se puede deshacer.
  const remove = (index: number) => {
    const image = own[index]
    if (!image) return
    images.mutate({ type: 'remove', item, imageId: image.id })
    showUndoToast({
      icon: Trash2,
      message: 'Foto quitada',
      onUndo: () => {
        images.mutate({ type: 'add', item, images: [image] })
      },
    })
  }
  const makeFirst = (index: number) => {
    const image = own[index]
    const first = own[0]
    if (!image || !first || index === 0) return
    images.mutate({
      type: 'update',
      item,
      imageId: image.id,
      patch: { position: first.position - POSITION_STEP },
    })
  }
  const move = (imageId: string, overId: string) => {
    const ids = own.map((image) => image.id)
    const neighbors = dropNeighbors(ids, imageId, overId)
    if (!neighbors) return
    for (const change of reorder(own, imageId, neighbors)) {
      images.mutate({
        type: 'update',
        item,
        imageId: change.id,
        patch: { position: change.position },
      })
    }
  }

  const viewerPhotos: ViewerPhoto[] = webOnly
    ? [{ key: 'web', path: null, url: item.imageUrl }]
    : own.map((image) => ({ key: image.id, path: image.path, url: null }))

  const photoButton = (
    <MediaButton
      icon={Camera}
      label="+ Foto"
      note={online ? undefined : 'Necesita conexión'}
      disabled={!online}
      onClick={() => {
        pickPhotos()
      }}
    />
  )
  const linkButton = (
    <MediaButton
      icon={Link2}
      label="+ Enlace"
      onClick={() => {
        setEditingLink(true)
      }}
    />
  )

  return (
    <div className="flex flex-col gap-2.5">
      <input
        ref={picker}
        type="file"
        accept="image/*"
        multiple
        hidden
        aria-label="Elegir fotos"
        onChange={(event) => {
          const files = [...(event.target.files ?? [])]
          event.target.value = ''
          const replace = replacing.current
          replacing.current = null
          const [first] = files
          if (replace && first) upload.replace(replace, first)
          else if (files.length > 0) upload.add(files)
        }}
      />

      {!hasOwn && !webOnly && !hasLink && !editingLink && !stores ? (
        <div className="grid grid-cols-2 gap-2.5">
          {photoButton}
          {linkButton}
        </div>
      ) : (
        <>
          {hasOwn && (
            <PhotoStrip
              images={own}
              pending={upload.pending}
              online={online}
              isDesktop={isDesktop}
              onOpen={setViewing}
              onAdd={() => {
                pickPhotos()
              }}
              onMove={move}
              onMakeFirst={makeFirst}
              onRemove={remove}
              onRetry={upload.retry}
              onDiscard={upload.discard}
            />
          )}
          {webOnly && (
            <WebPhotoSquare
              src={web.src}
              title={item.title}
              onOpen={() => {
                setViewing(0)
              }}
            />
          )}
          {hasLink && item.url && (
            <LinkRow
              url={item.url}
              title={item.urlTitle}
              state={linkState}
              onRemove={() => {
                onUpdate(item, { url: null, urlTitle: null, urlSite: null })
              }}
            />
          )}
          {hasLink &&
            item.url &&
            onAddStore &&
            (addingStore ? (
              <LinkInput
                validate={(url) =>
                  item.url && sameLink(item.url, url) ? 'Esta tienda ya está en la lista.' : null
                }
                onSave={(url) => {
                  setAddingStore(false)
                  onAddStore(url)
                }}
                onCancel={() => {
                  setAddingStore(false)
                }}
              />
            ) : (
              <AddStoreButton
                className="-mt-1 h-9 self-start rounded-lg px-1"
                onClick={() => {
                  setAddingStore(true)
                }}
              />
            ))}
          {!hasLink && editingLink && (
            <LinkInput
              onSave={saveLink}
              onCancel={() => {
                setEditingLink(false)
              }}
            />
          )}
          {!hasOwn && !webOnly && photoButton}
          {!hasLink && !editingLink && !stores && linkButton}
        </>
      )}

      <PhotoViewer
        open={viewing !== null}
        onOpenChange={(open) => {
          if (!open) setViewing(null)
        }}
        title={item.title}
        photos={viewerPhotos}
        index={Math.min(viewing ?? 0, Math.max(0, viewerPhotos.length - 1))}
        onIndexChange={setViewing}
        isDesktop={isDesktop}
        online={online}
        onChange={(index) => {
          setViewing(null)
          // La de la web se sustituye añadiendo una propia, que manda sobre ella.
          pickPhotos(webOnly ? null : (own[index] ?? null))
        }}
        onMakeFirst={
          webOnly
            ? undefined
            : (index) => {
                makeFirst(index)
                // El visor la sigue: ahora es la primera.
                setViewing(0)
              }
        }
        onRemove={(index) => {
          if (webOnly) {
            setViewing(null)
            onUpdate(item, { imageUrl: null })
            return
          }
          // Con más, el visor sigue en la de al lado; con la última, se cierra.
          if (own.length <= 1) setViewing(null)
          else setViewing(Math.min(index, own.length - 2))
          remove(index)
        }}
      />
    </div>
  )
}

function MediaButton({
  icon: Icon,
  label,
  note,
  disabled = false,
  onClick,
}: {
  icon: typeof Camera
  label: string
  note?: string | undefined
  disabled?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="flex h-11 items-center justify-center gap-2 rounded-[14px] bg-fill px-3 text-sm font-semibold text-muted-foreground outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:hover:text-muted-foreground"
    >
      <Icon aria-hidden className="size-4" strokeWidth={2.2} />
      <span className={cn(disabled && 'opacity-70')}>{label}</span>
      {note && <span className="text-xs font-medium text-subtle-foreground">· {note}</span>}
    </button>
  )
}

/** La imagen de la web de su enlace, sin fotos propias: un cuadrado de 96 px con «De la web». */
function WebPhotoSquare({
  src,
  title,
  onOpen,
}: {
  src: string | null
  title: string
  onOpen: () => void
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`Ver la foto de «${title}»`}
      className="relative size-24 shrink-0 overflow-hidden rounded-md bg-fill outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
    >
      {src && (
        <img src={src} alt="" referrerPolicy="no-referrer" className="size-full object-cover" />
      )}
      <span className="absolute bottom-1.5 left-1.5 flex items-center gap-1 rounded-[7px] bg-card px-1.5 py-0.5 text-[10.5px] font-bold text-foreground shadow-xs">
        <Link2 aria-hidden className="size-3" strokeWidth={2.4} />
        De la web
      </span>
    </button>
  )
}

/**
 * La fila del enlace (diseño 15, M3 a M5 y M12): el título de la página y el dominio debajo, ↗ para
 * abrirlo y ✕ para quitarlo. Mientras se busca, el dominio en gris y «Buscando título…»; sin
 * título, el dominio pasa a ser el título y la ruta va debajo; sin red, se buscará al volver.
 */
function LinkRow({
  url,
  title,
  state,
  onRemove,
}: {
  url: string
  title: string | null
  state: LinkState
  onRemove: () => void
}) {
  const domain = linkDomain(url)
  // `''` es «la página no da título»: también va el dominio.
  const heading = (title ?? '') === '' ? domain : (title ?? domain)
  const detail =
    state === 'searching'
      ? 'Buscando título…'
      : state === 'offline'
        ? null
        : title
          ? domain
          : linkPath(url)

  return (
    <div className="flex h-16 items-center gap-3 rounded-md border border-border-soft bg-card pr-2 pl-3">
      <span className="grid size-10 shrink-0 place-items-center rounded-[12px] bg-fill text-muted-foreground">
        {state === 'searching' ? (
          <LoaderCircle
            aria-hidden
            className="size-[18px] animate-spin text-primary"
            strokeWidth={2.4}
          />
        ) : (
          <Link2 aria-hidden className="size-4" strokeWidth={2.2} />
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span
          className={cn(
            'block truncate text-[15px] font-semibold',
            state === 'searching' ? 'font-medium text-muted-foreground' : 'text-foreground',
          )}
        >
          {heading}
        </span>
        <span className="mt-0.5 flex items-center gap-1 truncate text-[12.5px] text-subtle-foreground">
          {state === 'offline' ? (
            <>
              <WifiOff aria-hidden className="size-3 shrink-0" strokeWidth={2.2} />
              <span className="truncate">El título se buscará al volver la conexión.</span>
            </>
          ) : (
            <span className="truncate">{detail}</span>
          )}
        </span>
      </span>
      {state !== 'searching' && (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Abrir ${domain}`}
          className="grid size-9 shrink-0 place-items-center rounded-[10px] text-primary outline-none hover:bg-fill focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          <ExternalLink aria-hidden className="size-4" strokeWidth={2.2} />
        </a>
      )}
      <button
        type="button"
        aria-label="Quitar el enlace"
        onClick={onRemove}
        className="grid size-9 shrink-0 place-items-center rounded-[10px] text-muted-foreground outline-none hover:bg-fill hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"
      >
        <X aria-hidden className="size-4" strokeWidth={2.2} />
      </button>
    </div>
  )
}
