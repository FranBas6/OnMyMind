import {
  Camera,
  ExternalLink,
  FileText,
  Link2,
  LoaderCircle,
  Trash2,
  WifiOff,
  X,
} from 'lucide-react'
import { useRef, useState, type ReactNode } from 'react'

import { dropNeighbors, reorder, POSITION_STEP } from '@/lib/reorder'
import { showUndoToast } from '@/lib/undoToast'
import { cn } from '@/lib/utils'

import { FILE_ACCEPT } from '../files'
import { useFileUploads, useFileUrls } from '../hooks/useFileUploads'
import { useFileMutation, useImageMutation } from '../hooks/useItemMutations'
import type { LinkState } from '../hooks/useLinkMetadata'
import { usePhotoSrc, usePhotoUploads } from '../hooks/usePhoto'
import { linkDomain, linkPath } from '../links'
import type { Item, ItemFile, ItemImage, ItemPatch } from '../types'
import { hasLinks, sameLink } from '../stores'
import { LinkInput } from './LinkInput'
import { FileProblemLine, FilesSection } from './ItemFiles'
import { AddStoreButton } from './Stores'
import { PhotoStrip } from './PhotoStrip'
import { PhotoViewer, type ViewerPhoto } from './PhotoViewer'

interface ItemMediaProps {
  item: Item
  isDesktop: boolean
  online: boolean
  /** Cómo va el título del enlace: lo busca `useLinkMetadata`, que comparte con el precio. */
  linkState: LinkState
  /**
   * «+ Otra tienda» bajo el enlace de una compra (diseño 19, T1 y T2), u «+ Otro enlace» en lo
   * demás (4.6): el segundo convierte la fila en la caja de tiendas o de enlaces.
   */
  onAddLink: (url: string) => void
  onUpdate: (item: Item, patch: ItemPatch) => void
  /** «Enlaces» con varios (4.6), que va entre el enlace y los documentos (diseño 29). */
  linksSlot?: ReactNode
}

/**
 * Las fotos, el enlace y los documentos de un ítem, debajo de las notas (diseño 15; diseño 23, D;
 * diseño 29). Sin nada, una fila de tres botones iguales, «+ Foto», «+ Enlace» y «+ Documento»
 * (29, F1). Cuando ya tiene de un tipo, su botón se va de la fila y su sección lleva su propio
 * «añadir», en el orden Fotos, Enlaces, Documentos: con fotos propias, su tira, con «5 de 10» y el
 * «+ Foto» al final (`PhotoStrip`); con solo la imagen de la web, su cuadrado de 96 px con «De la
 * web», como en la 2a.6; la fila del enlace o «Enlaces»; y «Documentos» (`FilesSection`). Debajo,
 * la fila con lo que falta. Pegar un enlace lo guarda al momento y busca solo el título y la imagen de la página
 * (`useLinkMetadata`): si la cosa aún no tenía foto, esa imagen pasa a serlo, con «De la web».
 */
export function ItemMedia({
  item,
  isDesktop,
  online,
  linkState,
  onAddLink,
  onUpdate,
  linksSlot,
}: ItemMediaProps) {
  const [editingLink, setEditingLink] = useState(false)
  const [addingLink, setAddingLink] = useState(false)
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
  // Los documentos (6.1, diseño 29).
  const filePicker = useRef<HTMLInputElement>(null)
  const fileMutation = useFileMutation()
  const documents = useFileUploads(item, (file, onFailed) => {
    fileMutation.mutate({ type: 'add', item, files: [file] }, { onError: onFailed })
  })
  const fileUrls = useFileUrls(item.files, online)
  const hasFiles = item.files.length > 0 || documents.pending.length > 0

  const own = item.images
  const hasOwn = own.length > 0 || upload.pending.length > 0
  const webOnly = !hasOwn && item.imageUrl !== null
  // Con varios enlaces viven en «Dónde comprarlo» (diseño 19, T10) o en «Enlaces» (diseño 23,
  // D11); aquí quedan las fotos.
  const many = hasLinks(item)
  const hasLink = item.url !== null && !many
  const shopping = item.kind === 'shopping'

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

  const pickFiles = () => {
    documents.clearProblem()
    filePicker.current?.click()
  }
  // Quitar, con «Deshacer», que lo devuelve tal cual (F7). El archivo lo borra la limpieza de
  // huérfanos cuando ya no se puede deshacer.
  const removeFile = (file: ItemFile) => {
    fileMutation.mutate({ type: 'remove', item, fileId: file.id })
    showUndoToast({
      icon: Trash2,
      message: 'Documento quitado',
      onUndo: () => {
        fileMutation.mutate({ type: 'add', item, files: [file] })
      },
    })
  }

  const viewerPhotos: ViewerPhoto[] = webOnly
    ? [{ key: 'web', path: null, url: item.imageUrl }]
    : own.map((image) => ({ key: image.id, path: image.path, url: null }))

  // La fila con lo que falta (29, F1): sin fotos, sin enlace y sin documentos.
  const missing = [
    !hasOwn && !webOnly && (
      <MediaButton
        key="photo"
        icon={Camera}
        label="+ Foto"
        note={online ? undefined : 'Necesita conexión'}
        disabled={!online}
        // Una foto elegida como documento: se dice que va aquí (X2).
        highlight={documents.problem?.photo === true}
        onClick={() => {
          documents.clearProblem()
          pickPhotos()
        }}
      />
    ),
    !hasLink && !editingLink && !many && (
      <MediaButton
        key="link"
        icon={Link2}
        label="+ Enlace"
        onClick={() => {
          setEditingLink(true)
        }}
      />
    ),
    !hasFiles && (
      <MediaButton
        key="file"
        icon={FileText}
        label="+ Documento"
        note={online ? undefined : 'Necesita conexión'}
        disabled={!online}
        onClick={pickFiles}
      />
    ),
  ].filter(Boolean)

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
      <input
        ref={filePicker}
        type="file"
        accept={FILE_ACCEPT}
        multiple
        hidden
        aria-label="Elegir documentos"
        onChange={(event) => {
          const files = [...(event.target.files ?? [])]
          event.target.value = ''
          if (files.length > 0) documents.add(files)
        }}
      />

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
        (addingLink ? (
          <LinkInput
            validate={(url) =>
              item.url && sameLink(item.url, url)
                ? shopping
                  ? 'Esta tienda ya está en la lista.'
                  : 'Este enlace ya está.'
                : null
            }
            onSave={(url) => {
              setAddingLink(false)
              onAddLink(url)
            }}
            onCancel={() => {
              setAddingLink(false)
            }}
          />
        ) : (
          <AddStoreButton
            label={shopping ? 'Otra tienda' : 'Otro enlace'}
            className="-mt-1 h-9 self-start rounded-lg px-1"
            onClick={() => {
              setAddingLink(true)
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
      {linksSlot}
      {hasFiles && (
        <FilesSection
          files={item.files}
          pending={documents.pending}
          urls={fileUrls.data}
          online={online}
          isDesktop={isDesktop}
          onAdd={pickFiles}
          onDrop={documents.add}
          onRemove={removeFile}
          onRetry={documents.retry}
          onDiscard={documents.discard}
        />
      )}
      {documents.problem && <FileProblemLine problem={documents.problem} />}
      {missing.length > 0 && (
        <div
          className={cn(
            'grid gap-2.5',
            missing.length === 3 ? 'grid-cols-3 gap-2' : missing.length === 2 && 'grid-cols-2',
          )}
        >
          {missing}
        </div>
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

/**
 * Un botón de la fila de lo que falta (diseño 29, F1): 48 px, gris. Sin red, «Necesita conexión»
 * debajo (X6); `highlight`, resaltado en índigo, cuando una foto se eligió como documento (X2).
 */
function MediaButton({
  icon: Icon,
  label,
  note,
  disabled = false,
  highlight = false,
  onClick,
}: {
  icon: typeof Camera
  label: string
  note?: string | undefined
  disabled?: boolean
  highlight?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'flex h-12 min-w-0 flex-col items-center justify-center rounded-[14px] px-1.5 text-[13.5px] font-semibold outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50',
        highlight
          ? 'border-[1.5px] border-primary bg-brand-tint text-primary'
          : 'bg-fill text-muted-foreground hover:text-foreground disabled:hover:text-muted-foreground',
      )}
    >
      <span className={cn('flex items-center gap-1.5 whitespace-nowrap', disabled && 'opacity-70')}>
        <Icon aria-hidden className="size-4 shrink-0" strokeWidth={2.2} />
        {label}
      </span>
      {note && (
        <span className="text-[11px] leading-tight font-medium text-subtle-foreground">{note}</span>
      )}
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
