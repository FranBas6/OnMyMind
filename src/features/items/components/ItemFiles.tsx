import { Ellipsis, ExternalLink, Plus, RotateCw, Trash2, WifiOff, X } from 'lucide-react'
import { DropdownMenu } from 'radix-ui'
import { useState, type DragEvent } from 'react'

import { BottomSheet } from '@/components/BottomSheet'
import { cn } from '@/lib/utils'

import { fileSummary, fileType, MAX_FILES, viewerHint } from '../files'
import type { FileProblem, PendingFile } from '../hooks/useFileUploads'
import type { ItemFile } from '../types'

interface FilesSectionProps {
  files: readonly ItemFile[]
  pending: readonly PendingFile[]
  /** Los enlaces para abrirlos, por ruta (`useFileUrls`); sin red o mientras llegan, ninguno. */
  urls: Readonly<Record<string, string>> | undefined
  online: boolean
  isDesktop: boolean
  onAdd: () => void
  /** Soltar archivos encima, en escritorio (D2: «o arrástralo aquí»). */
  onDrop: (files: File[]) => void
  onRemove: (file: ItemFile) => void
  onRetry: (key: string) => void
  onDiscard: (key: string) => void
}

/**
 * «Documentos» (6.1, diseño 29, F3–F9, X4–X7, D2–D6): la caja de «Enlaces» (diseño 23) con una
 * hoja por documento, su tipo y su tamaño («PDF · 1,2 MB»), y «N de 5» junto a la etiqueta. Tocar
 * uno lo abre en el visor del sistema (en una pestaña nueva); su ··· abre «Abrir» y «Quitar». Lo que
 * sube sale en la caja con su porcentaje y la ✕; lo que falló, con «Reintentar». Al final, «+ Otro
 * documento» (en escritorio, «o arrástralo aquí»); con 5, una línea en su lugar. Sin red, los
 * guardados siguen ahí y una línea dice que abrirlos necesita conexión.
 */
export function FilesSection({
  files,
  pending,
  urls,
  online,
  isDesktop,
  onAdd,
  onDrop,
  onRemove,
  onRetry,
  onDiscard,
}: FilesSectionProps) {
  const [dragging, setDragging] = useState(false)
  const count = files.length + pending.length
  const full = count >= MAX_FILES

  const drop = isDesktop
    ? {
        onDragOver: (event: DragEvent) => {
          if (!online || full || !event.dataTransfer.types.includes('Files')) return
          event.preventDefault()
          setDragging(true)
        },
        onDragLeave: () => {
          setDragging(false)
        },
        onDrop: (event: DragEvent) => {
          event.preventDefault()
          setDragging(false)
          if (online && !full) onDrop([...event.dataTransfer.files])
        },
      }
    : {}

  return (
    <section aria-label="Documentos" className="flex flex-col gap-2">
      <div className="flex items-center justify-between px-1">
        <h3 className="font-sans text-xs font-bold tracking-[0.06em] text-muted-foreground uppercase">
          Documentos
        </h3>
        <span
          className={cn('text-xs', full ? 'font-bold text-foreground' : 'text-subtle-foreground')}
        >
          {count} de {MAX_FILES}
        </span>
      </div>
      <ul
        {...drop}
        className={cn(
          'overflow-hidden rounded-md border border-border-soft bg-background',
          dragging && 'border-primary bg-brand-tint',
        )}
      >
        {files.map((file) => (
          <FileRow
            key={file.id}
            file={file}
            url={urls?.[file.path]}
            online={online}
            isDesktop={isDesktop}
            onRemove={() => {
              onRemove(file)
            }}
          />
        ))}
        {pending.map((entry) => (
          <PendingRow
            key={entry.key}
            entry={entry}
            onRetry={() => {
              onRetry(entry.key)
            }}
            onDiscard={() => {
              onDiscard(entry.key)
            }}
          />
        ))}
        {!full && (
          <li className="border-t border-border-soft first:border-t-0">
            {online ? (
              <button
                type="button"
                onClick={onAdd}
                className="flex h-12 w-full items-center gap-2.5 px-4 text-[15px] font-semibold text-primary outline-none hover:text-primary-hover focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:ring-inset"
              >
                <Plus aria-hidden className="size-[18px]" strokeWidth={2.4} />
                Otro documento
                {isDesktop && (
                  <span className="ml-auto text-xs font-normal text-subtle-foreground">
                    o arrástralo aquí
                  </span>
                )}
              </button>
            ) : (
              <p className="flex h-12 items-center gap-2.5 px-4 text-[15px] font-semibold text-subtle-foreground">
                <WifiOff aria-hidden className="size-[18px]" strokeWidth={2.2} />
                Otro documento · Necesita conexión
              </p>
            )}
          </li>
        )}
      </ul>
      {full && (
        <p className="px-1 text-[13px] text-muted-foreground">
          Has llegado a {MAX_FILES} documentos. Quita alguno para añadir otro.
        </p>
      )}
      {!online && files.length > 0 && (
        <p className="flex items-center gap-1.5 px-1 text-[13px] text-muted-foreground">
          <WifiOff aria-hidden className="size-3.5 shrink-0" strokeWidth={2.2} />
          Para abrirlos hace falta conexión.
        </p>
      )}
    </section>
  )
}

/** La línea roja bajo la caja (X1–X3): lo que no se ha podido adjuntar y por qué. */
export function FileProblemLine({ problem }: { problem: FileProblem }) {
  return (
    <p role="alert" className="px-1 text-[13px] leading-snug text-error">
      {problem.message}
    </p>
  )
}

/**
 * La hoja del documento (36 × 44 px) con la esquina doblada y su extensión (PDF, XLS, DOC…), en el
 * tono de la marca y sin un color por tipo (diseño 29). Mientras sube, el círculo que gira; si
 * falló, la flecha de reintentar en rojo.
 */
export function FileIcon({
  mime,
  state = 'saved',
}: {
  mime: string
  state?: 'saved' | 'uploading' | 'error'
}) {
  const error = state === 'error'
  return (
    <span
      aria-hidden
      className={cn(
        'relative grid h-11 w-9 shrink-0 place-items-end justify-center rounded-[7px] pb-1.5 [clip-path:polygon(0_0,calc(100%-11px)_0,100%_11px,100%_100%,0_100%)]',
        error ? 'bg-error/12 text-error' : 'bg-brand-tint text-primary',
      )}
    >
      <span
        className={cn(
          'absolute top-0 right-0 size-[11px] rounded-bl-[3px]',
          error ? 'bg-error/30' : 'bg-primary/30',
        )}
      />
      {state === 'saved' ? (
        <span className="font-mono text-[9.5px] leading-none font-bold tracking-[0.02em]">
          {fileType(mime).badge}
        </span>
      ) : error ? (
        <RotateCw className="mb-1 size-4" strokeWidth={2.4} />
      ) : (
        <span className="mb-1 size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
      )}
    </span>
  )
}

const ROW =
  'relative flex min-h-[66px] items-center gap-3.5 py-2.5 pr-1.5 pl-3.5 not-first:before:absolute not-first:before:top-0 not-first:before:right-0 not-first:before:left-[62px] not-first:before:h-px not-first:before:bg-border-soft'

interface FileRowProps {
  file: ItemFile
  url: string | undefined
  online: boolean
  isDesktop: boolean
  onRemove: () => void
}

/**
 * Un documento (F4): tocarlo lo abre en una pestaña (en el iPhone, el visor de siempre, con
 * compartir y guardar); su ··· abre las opciones (F6, D3). Sin red no hay enlace: tocarlo no hace
 * nada y la línea de debajo de la caja lo explica (X7).
 */
function FileRow({ file, url, online, isDesktop, onRemove }: FileRowProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const summary = fileSummary(file)
  const open = () => {
    if (url) window.open(url, '_blank', 'noopener,noreferrer')
  }
  const body = (
    <>
      <FileIcon mime={file.mime} />
      <span className="min-w-0 flex-1">
        <span
          className={cn(
            'block truncate text-[15px] font-semibold',
            online ? 'text-foreground' : 'text-muted-foreground',
          )}
        >
          {file.name}
        </span>
        <span className="block truncate text-[12.5px] text-muted-foreground">{summary}</span>
      </span>
    </>
  )
  const options: FileOption[] = [
    {
      id: 'open',
      label: isDesktop ? 'Abrir en una pestaña' : 'Abrir',
      hint: isDesktop ? null : viewerHint(navigator.userAgent, navigator.maxTouchPoints),
      icon: ExternalLink,
      disabled: !url,
      run: open,
    },
    { id: 'remove', label: 'Quitar', icon: Trash2, run: onRemove, destructive: true },
  ]

  return (
    <li className={cn(ROW, menuOpen && 'bg-brand-tint')}>
      {url ? (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Abrir ${file.name}`}
          className="flex min-w-0 flex-1 items-center gap-3.5 rounded-lg outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          {body}
        </a>
      ) : (
        <span className="flex min-w-0 flex-1 items-center gap-3.5">{body}</span>
      )}
      <FileOptions
        file={file}
        summary={summary}
        options={options}
        isDesktop={isDesktop}
        open={menuOpen}
        onOpenChange={setMenuOpen}
      />
    </li>
  )
}

/** Lo que sube (F3, D2) o no se pudo subir (X5). */
function PendingRow({
  entry,
  onRetry,
  onDiscard,
}: {
  entry: PendingFile
  onRetry: () => void
  onDiscard: () => void
}) {
  const error = entry.status === 'error'
  const percent = Math.round(entry.progress * 100)
  return (
    <li className={ROW}>
      <FileIcon mime={entry.checked.mime} state={error ? 'error' : 'uploading'} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-semibold text-muted-foreground">
          {entry.checked.name}
        </span>
        {error ? (
          <span className="block text-[12.5px] font-semibold text-error">No se pudo subir</span>
        ) : (
          <>
            <span className="block text-[12.5px] text-muted-foreground">Subiendo… {percent} %</span>
            <span
              role="progressbar"
              aria-label={`Subiendo ${entry.checked.name}`}
              aria-valuenow={percent}
              aria-valuemin={0}
              aria-valuemax={100}
              className="mt-1 block h-[3px] overflow-hidden rounded-full bg-border-soft"
            >
              <span
                className="block h-full rounded-full bg-primary transition-[width] duration-200"
                style={{ width: `${String(percent)}%` }}
              />
            </span>
          </>
        )}
      </span>
      {error && (
        <button
          type="button"
          onClick={onRetry}
          className="flex h-9 shrink-0 items-center gap-1.5 rounded-[10px] bg-fill px-3 text-sm font-semibold text-foreground outline-none hover:bg-border focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          <RotateCw aria-hidden className="size-3.5" strokeWidth={2.4} />
          Reintentar
        </button>
      )}
      <button
        type="button"
        aria-label={error ? `Quitar ${entry.checked.name}` : `Cancelar ${entry.checked.name}`}
        onClick={onDiscard}
        className="grid h-11 w-10 shrink-0 place-items-center rounded-[10px] text-muted-foreground outline-none hover:bg-fill hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"
      >
        <X aria-hidden className="size-4" strokeWidth={2.2} />
      </button>
    </li>
  )
}

interface FileOption {
  id: string
  label: string
  hint?: string | null
  icon: typeof ExternalLink
  run: () => void
  destructive?: boolean
  disabled?: boolean
}

/**
 * El ··· de un documento: en el móvil, una hoja con su hoja, su nombre y su tipo, y «Abrir» y
 * «Quitar» (F6); en escritorio, un menú junto a la fila (D3).
 */
function FileOptions({
  file,
  summary,
  options,
  isDesktop,
  open,
  onOpenChange,
}: {
  file: ItemFile
  summary: string
  options: readonly FileOption[]
  isDesktop: boolean
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const trigger = (
    <button
      type="button"
      aria-label={`${file.name}: opciones`}
      onClick={
        isDesktop
          ? undefined
          : () => {
              onOpenChange(true)
            }
      }
      className="grid h-11 w-10 shrink-0 place-items-center rounded-[10px] text-muted-foreground outline-none hover:bg-fill hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"
    >
      <Ellipsis aria-hidden className="size-5" strokeWidth={2.4} />
    </button>
  )

  if (isDesktop) {
    return (
      <DropdownMenu.Root open={open} onOpenChange={onOpenChange} modal={false}>
        <DropdownMenu.Trigger asChild>{trigger}</DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content
            align="end"
            sideOffset={4}
            className="z-50 w-[240px] rounded-2xl border border-border-soft bg-popover p-1.5 text-popover-foreground shadow-popover outline-none"
          >
            {options.map((entry) => (
              <DropdownMenu.Item
                key={entry.id}
                disabled={entry.disabled}
                onSelect={entry.run}
                className={cn(
                  'flex h-11 cursor-pointer items-center gap-3 rounded-xl px-3.5 text-sm font-medium outline-none select-none data-disabled:cursor-default data-disabled:opacity-50 data-highlighted:bg-fill',
                  entry.destructive &&
                    'mt-1 rounded-none border-t border-border-soft pt-1 text-destructive',
                )}
              >
                <entry.icon aria-hidden className="size-4" strokeWidth={2} />
                {entry.label}
              </DropdownMenu.Item>
            ))}
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
    )
  }

  return (
    <>
      {trigger}
      <BottomSheet nested open={open} onOpenChange={onOpenChange} title={file.name}>
        <div className="flex items-center gap-3.5">
          <FileIcon mime={file.mime} />
          <div className="min-w-0">
            <p className="truncate text-[17px] font-bold">{file.name}</p>
            <p className="text-[13px] text-subtle-foreground">{summary}</p>
          </div>
        </div>
        <div className="flex flex-col gap-2">
          {options.map((entry) => (
            <OptionButton
              key={entry.id}
              option={entry}
              onSelect={() => {
                onOpenChange(false)
                entry.run()
              }}
            />
          ))}
        </div>
      </BottomSheet>
    </>
  )
}

function OptionButton({ option, onSelect }: { option: FileOption; onSelect: () => void }) {
  return (
    <button
      type="button"
      disabled={option.disabled}
      onClick={onSelect}
      className={cn(
        'flex h-14 w-full items-center gap-3 rounded-2xl border border-border-soft bg-background px-4 text-[16px] font-medium outline-none active:bg-fill disabled:opacity-50',
        option.destructive ? 'text-destructive' : 'text-foreground',
      )}
    >
      <option.icon
        aria-hidden
        className={cn('size-[18px]', !option.destructive && 'text-muted-foreground')}
        strokeWidth={2}
      />
      <span className="flex-1 text-left">{option.label}</span>
      {option.hint && <span className="text-[13px] text-subtle-foreground">{option.hint}</span>}
    </button>
  )
}
