import { useQuery } from '@tanstack/react-query'
import { Camera, CircleAlert, ExternalLink, Link2, LoaderCircle, WifiOff, X } from 'lucide-react'
import { useEffect, useId, useRef, useState, type ClipboardEvent, type KeyboardEvent } from 'react'

import { queryKeys } from '@/lib/queryKeys'
import { cn } from '@/lib/utils'

import { fetchLinkMetadata } from '../api'
import { usePhotoSrc, usePhotoUpload } from '../hooks/usePhoto'
import { linkDomain, linkPath, normalizeLink, URL_TITLE_MAX_LENGTH } from '../links'
import type { Item, ItemPatch } from '../types'
import { PhotoViewer } from './PhotoViewer'

interface ItemMediaProps {
  item: Item
  isDesktop: boolean
  online: boolean
  onUpdate: (item: Item, patch: ItemPatch) => void
}

/**
 * La foto y el enlace de un ítem, debajo de las notas (diseño 15). Sin nada, dos botones a medias,
 * «+ Foto» y «+ Enlace». Lo que hay ocupa su sitio en orden fijo (la foto, un cuadrado de 96 px;
 * después la fila del enlace) y el botón que falta va debajo, a todo el ancho. Pegar un enlace lo
 * guarda al momento y busca solo el título y la imagen de la página (`fetch-metadata`): si la cosa
 * aún no tenía foto, esa imagen pasa a serlo, con «De la web».
 */
export function ItemMedia({ item, isDesktop, online, onUpdate }: ItemMediaProps) {
  const [editingLink, setEditingLink] = useState(false)
  const [viewing, setViewing] = useState(false)
  const picker = useRef<HTMLInputElement>(null)
  const upload = usePhotoUpload(item, onUpdate)
  const photo = usePhotoSrc(item, 'thumb')

  // El título y la imagen de la página, una vez por enlace. Sin red, la consulta espera en pausa y
  // sale sola al volver la conexión (diseño 15, M12).
  const needsMetadata = item.url !== null && item.urlTitle === null
  const metadata = useQuery({
    queryKey: queryKeys.linkMetadata(item.url ?? ''),
    queryFn: () => fetchLinkMetadata(item.url ?? ''),
    enabled: needsMetadata,
    // Sin red ni lo intenta (la app va en `offlineFirst`): espera en pausa y sale al volver.
    networkMode: 'online',
    staleTime: Infinity,
    retry: 1,
  })
  // Una vez por enlace: si guardar falla y vuelve atrás, no se reintenta en bucle.
  const applied = useRef<string | null>(null)
  useEffect(() => {
    if (!needsMetadata || !metadata.data || applied.current === item.url) return
    applied.current = item.url
    const patch: ItemPatch = {
      urlTitle: metadata.data.title?.slice(0, URL_TITLE_MAX_LENGTH) ?? '',
    }
    if (!item.imagePath && !item.imageUrl && metadata.data.image)
      patch.imageUrl = metadata.data.image
    onUpdate(item, patch)
  }, [needsMetadata, metadata.data, item, onUpdate])

  const hasPhoto =
    item.imagePath !== null || item.imageUrl !== null || upload.state.status !== 'idle'
  const hasLink = item.url !== null
  const linkState: LinkState = !needsMetadata
    ? 'ready'
    : !online || metadata.fetchStatus === 'paused'
      ? 'offline'
      : metadata.isError && metadata.fetchStatus === 'idle'
        ? // No se ha podido preguntar: se ve como sin título y se reintenta al volver a abrirlo.
          'unavailable'
        : 'searching'

  const pickPhoto = () => {
    picker.current?.click()
  }
  const saveLink = (url: string) => {
    setEditingLink(false)
    onUpdate(item, { url, urlTitle: null })
  }

  const photoButton = (
    <MediaButton
      icon={Camera}
      label="+ Foto"
      note={online ? undefined : 'Necesita conexión'}
      disabled={!online}
      onClick={pickPhoto}
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
        hidden
        aria-label="Elegir una foto"
        onChange={(event) => {
          const file = event.target.files?.[0]
          event.target.value = ''
          if (file) upload.start(file)
        }}
      />

      {!hasPhoto && !hasLink && !editingLink ? (
        <div className="grid grid-cols-2 gap-2.5">
          {photoButton}
          {linkButton}
        </div>
      ) : (
        <>
          {hasPhoto && (
            <PhotoSquare
              src={upload.state.status === 'idle' ? photo.src : upload.state.preview}
              fromWeb={upload.state.status === 'idle' && photo.fromWeb}
              status={upload.state.status}
              title={item.title}
              onOpen={() => {
                setViewing(true)
              }}
              onRetry={upload.retry}
              onDiscard={upload.discard}
            />
          )}
          {hasLink && item.url && (
            <LinkRow
              url={item.url}
              title={item.urlTitle}
              state={linkState}
              onRemove={() => {
                onUpdate(item, { url: null, urlTitle: null })
              }}
            />
          )}
          {!hasLink && editingLink && (
            <LinkInput
              onSave={saveLink}
              onCancel={() => {
                setEditingLink(false)
              }}
            />
          )}
          {!hasPhoto && photoButton}
          {!hasLink && !editingLink && linkButton}
        </>
      )}

      <PhotoViewer
        open={viewing}
        onOpenChange={setViewing}
        item={item}
        isDesktop={isDesktop}
        online={online}
        onChange={() => {
          setViewing(false)
          pickPhoto()
        }}
        onRemove={() => {
          setViewing(false)
          onUpdate(item, { imagePath: null, imageUrl: null })
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

/** La foto: un cuadrado de 96 px que se abre en grande, o su estado mientras sube o si falla. */
function PhotoSquare({
  src,
  fromWeb,
  status,
  title,
  onOpen,
  onRetry,
  onDiscard,
}: {
  src: string | null
  fromWeb: boolean
  status: 'idle' | 'uploading' | 'error'
  title: string
  onOpen: () => void
  onRetry: () => void
  onDiscard: () => void
}) {
  if (status === 'error') {
    return (
      <div className="flex items-center gap-3">
        <div className="flex size-24 shrink-0 flex-col items-center justify-center gap-1.5 rounded-md border-[1.5px] border-error bg-priority-high-bg text-error">
          <CircleAlert aria-hidden className="size-5" strokeWidth={2.2} />
          <span className="text-[11px] font-bold">No se subió</span>
        </div>
        <div className="flex flex-col gap-1">
          <p role="alert" className="text-[13px] text-error">
            No se ha podido subir la foto.
          </p>
          <div className="flex gap-3 text-[13px] font-semibold">
            <button
              type="button"
              onClick={onRetry}
              className="text-primary outline-none hover:text-primary-hover focus-visible:underline"
            >
              Reintentar
            </button>
            <button
              type="button"
              onClick={onDiscard}
              className="text-muted-foreground outline-none hover:text-foreground focus-visible:underline"
            >
              Quitar
            </button>
          </div>
        </div>
      </div>
    )
  }

  const uploading = status === 'uploading'
  return (
    <div className="flex items-end gap-3">
      <button
        type="button"
        onClick={onOpen}
        disabled={uploading}
        aria-label={uploading ? 'Subiendo la foto…' : `Ver la foto de «${title}»`}
        className="relative size-24 shrink-0 overflow-hidden rounded-md bg-fill outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
      >
        {src && <img src={src} alt="" className="size-full object-cover" />}
        {uploading && (
          <span className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 bg-scrim text-white">
            <LoaderCircle aria-hidden className="size-7 animate-spin" strokeWidth={2.4} />
            <span className="text-[11px] font-bold">Subiendo…</span>
          </span>
        )}
        {fromWeb && !uploading && (
          <span className="absolute bottom-1.5 left-1.5 flex items-center gap-1 rounded-[7px] bg-card px-1.5 py-0.5 text-[10.5px] font-bold text-foreground shadow-xs">
            <Link2 aria-hidden className="size-3" strokeWidth={2.4} />
            De la web
          </span>
        )}
      </button>
      {uploading && (
        <p className="pb-1 text-[13px] leading-snug text-subtle-foreground">
          Puedes seguir escribiendo. Se guarda sola.
        </p>
      )}
    </div>
  )
}

type LinkState = 'ready' | 'searching' | 'offline' | 'unavailable'

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

/**
 * «Pega un enlace…» (diseño 15, M2 y M6): abre con el foco y se guarda al pegar o con Intro. Si lo
 * escrito no es un enlace, lo dice y espera. Con portapapeles accesible, «Pegar» lo pega sin tener
 * que mantener pulsado.
 */
function LinkInput({ onSave, onCancel }: { onSave: (url: string) => void; onCancel: () => void }) {
  const id = useId()
  const [text, setText] = useState('')
  const [invalid, setInvalid] = useState(false)
  const canRead =
    typeof navigator !== 'undefined' &&
    'clipboard' in navigator &&
    'readText' in navigator.clipboard

  const submit = (value: string) => {
    const url = normalizeLink(value)
    if (url) onSave(url)
    else setInvalid(true)
  }
  const onPaste = (event: ClipboardEvent<HTMLInputElement>) => {
    const pasted = event.clipboardData.getData('text/plain')
    const url = normalizeLink(pasted)
    if (!url) return
    event.preventDefault()
    onSave(url)
  }
  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' && !event.nativeEvent.isComposing) {
      event.preventDefault()
      submit(text)
    }
    if (event.key === 'Escape') {
      event.stopPropagation()
      onCancel()
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div
        className={cn(
          'flex h-13 items-center gap-2.5 rounded-md border-[1.5px] bg-card pr-1.5 pl-3.5',
          invalid ? 'border-error' : 'border-primary',
        )}
      >
        <Link2
          aria-hidden
          className={cn('size-4 shrink-0', invalid ? 'text-error' : 'text-primary')}
          strokeWidth={2.2}
        />
        <input
          id={id}
          autoFocus
          type="url"
          inputMode="url"
          enterKeyHint="done"
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          value={text}
          placeholder="Pega un enlace…"
          aria-label="Pega un enlace"
          aria-invalid={invalid || undefined}
          aria-describedby={invalid ? `${id}-error` : undefined}
          onChange={(event) => {
            setText(event.target.value)
            setInvalid(false)
          }}
          onPaste={onPaste}
          onKeyDown={onKeyDown}
          className="min-w-0 flex-1 bg-transparent text-base text-foreground outline-none placeholder:text-subtle-foreground"
        />
        <button
          type="button"
          aria-label="Cancelar el enlace"
          onClick={onCancel}
          className="grid size-9 shrink-0 place-items-center rounded-[10px] text-muted-foreground outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          <X aria-hidden className="size-4" strokeWidth={2.2} />
        </button>
      </div>
      {invalid ? (
        <p id={`${id}-error`} className="px-1 text-[13px] text-error">
          Eso no parece un enlace.
        </p>
      ) : (
        canRead &&
        !text && (
          <button
            type="button"
            onMouseDown={(event) => {
              // Que no le quite el foco al campo (en iOS cerraría el teclado).
              event.preventDefault()
            }}
            onClick={() => {
              void navigator.clipboard.readText().then(
                (pasted) => {
                  setText(pasted)
                  submit(pasted)
                },
                () => undefined,
              )
            }}
            className="self-start rounded-[10px] bg-brand-tint px-3 py-1.5 text-[13px] font-bold text-primary-strong outline-none hover:bg-primary/20 focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            Pegar
          </button>
        )
      )}
    </div>
  )
}
