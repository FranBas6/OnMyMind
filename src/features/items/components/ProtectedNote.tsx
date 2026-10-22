import { useQueryClient } from '@tanstack/react-query'
import { Check, Copy, FileText, Lock } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'

import {
  clearClipboardLater,
  copySecret,
  getUnlocked,
  LockedNoteCard,
  rememberOpenedNote,
  sealNote,
  UnlockedBand,
  type OpenedNote,
} from '@/features/private'
import { useCopied } from '@/hooks/useCopied'
import { useLongPress } from '@/hooks/useLongPress'
import { cn } from '@/lib/utils'

import { lineValue } from '../lineValue'
import type { SplitNote } from '../noteText'
import type { Item, ItemPatch } from '../types'
import { NoteTextField } from './NoteTextField'

const TITLE = 'font-display text-2xl leading-[1.25] font-extrabold tracking-[-0.02em]'
const BODY = 'text-[16.5px] leading-normal'
/** Lo que dura «Copiado» en una línea. */
const LINE_COPIED_MS = 2000

interface ProtectedNoteProps {
  item: Item
  isDesktop: boolean
  /** Lo que se ve de ella: bloqueada, de la clave anterior o desbloqueada con su texto. */
  opened: OpenedNote
  onUpdate: (item: Item, patch: ItemPatch) => void
  /** Se cierra con todo el texto borrado, como cualquier nota (diseño 25, B2e). */
  onEmptyClose: () => void
}

/**
 * El texto de una nota protegida en su ficha (5.7, diseño 26). Bloqueada (C8, D4), el candado
 * delante de la primera línea y las barras grises. Desbloqueada (C8b, D6), la franja con lo que le
 * queda y el texto, que se edita y se cifra otra vez al guardarlo, y «Copiar» (sin la primera
 * línea). Cada línea se copia sola con su botón: de «Contraseña: 123456», solo `123456` (Fran,
 * 2026-10-12). Lo copiado se borra del portapapeles a los 30 s. Tocar el texto lo edita.
 */
export function ProtectedNote({
  item,
  isDesktop,
  opened,
  onUpdate,
  onEmptyClose,
}: ProtectedNoteProps) {
  if (opened.state === 'locked' || opened.state === 'lost') {
    return (
      <>
        <h2 className={cn('flex items-start gap-2.5 wrap-break-word', TITLE)}>
          <Lock aria-hidden className="mt-1.5 size-5 shrink-0" strokeWidth={2.4} />
          <span className="min-w-0">{item.title}</span>
        </h2>
        <LockedNoteCard isDesktop={isDesktop} lost={opened.state === 'lost'} />
      </>
    )
  }
  return (
    <UnlockedNote
      item={item}
      isDesktop={isDesktop}
      text={opened.text}
      onUpdate={onUpdate}
      onEmptyClose={onEmptyClose}
    />
  )
}

function UnlockedNote({
  item,
  isDesktop,
  text,
  onUpdate,
  onEmptyClose,
}: Omit<ProtectedNoteProps, 'opened'> & { text: string | null }) {
  const queryClient = useQueryClient()
  const [editing, setEditing] = useState(false)
  const [copied, markCopied] = useCopied()
  // Lo desbloqueado al editar: si se bloquea sola mientras se escribe, lo último se cifra igual.
  const unlocked = useRef(getUnlocked())
  useEffect(() => {
    unlocked.current = getUnlocked() ?? unlocked.current
  })

  const copy = async (value: string) => {
    if (await copySecret(value)) markCopied()
    else toast.error('No se ha podido copiar el texto.')
  }

  // Una línea, desde su botón o manteniéndola pulsada: «Copiado» en ella, y no en «Copiar».
  const [copiedLine, setCopiedLine] = useState<number | null>(null)
  const lineTimer = useRef<number | undefined>(undefined)
  useEffect(
    () => () => {
      window.clearTimeout(lineTimer.current)
    },
    [],
  )
  const copyLine = async (index: number, value: string) => {
    if (!(await copySecret(value))) {
      toast.error('No se ha podido copiar el texto.')
      return
    }
    setCopiedLine(index)
    window.clearTimeout(lineTimer.current)
    lineTimer.current = window.setTimeout(() => {
      setCopiedLine(null)
    }, LINE_COPIED_MS)
  }

  // ⌘⇧C copia el texto sin la primera línea (D6).
  const body = text ?? ''
  useEffect(() => {
    if (!isDesktop) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || !event.shiftKey || event.key.toLowerCase() !== 'c') {
        return
      }
      event.preventDefault()
      void copySecret(body).then((ok) => {
        if (ok) markCopied()
      })
    }
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [isDesktop, body, markCopied])

  // Guardar: la primera línea va en claro; el resto, cifrado otra vez con lo desbloqueado.
  const save = (split: SplitNote) => {
    const patch: ItemPatch = {}
    if (split.title !== item.title) patch.title = split.title
    const next = split.notes ?? ''
    if (next === body) {
      if (patch.title !== undefined) onUpdate(item, patch)
      return
    }
    void sealNote(next, unlocked.current).then((sealed) => {
      rememberOpenedNote(queryClient, item.id, sealed, next)
      onUpdate(item, { ...patch, sealed })
    })
  }

  const editor = text !== null && (
    // Lo que se copie seleccionando también se borra a los 30 s.
    <div onCopy={clearClipboardLater} onCut={clearClipboardLater}>
      <NoteTextField
        key={item.id}
        item={{ id: item.id, title: item.title, notes: text || null }}
        autoFocus
        onSave={save}
        onEmptyClose={onEmptyClose}
        onBlur={() => {
          setEditing(false)
        }}
      />
    </div>
  )

  return (
    <>
      <UnlockedBand />
      {text === null ? (
        <p className={TITLE}>{item.title}</p>
      ) : editing ? (
        editor
      ) : (
        <ReadLines
          title={item.title}
          text={text}
          isDesktop={isDesktop}
          copiedLine={copiedLine}
          onCopyLine={(index, value) => void copyLine(index, value)}
          onEdit={() => {
            setEditing(true)
          }}
        />
      )}
      <div className="flex items-center gap-3">
        <button
          type="button"
          disabled={body === ''}
          onClick={() => void copy(body)}
          className={cn(
            'flex h-11 shrink-0 items-center gap-2 rounded-xl px-3.5 text-sm font-bold outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-50',
            copied ? 'bg-brand-tint text-primary' : 'bg-fill text-foreground hover:bg-border',
          )}
        >
          {copied ? (
            <Check aria-hidden className="size-4" strokeWidth={2.6} />
          ) : (
            <Copy aria-hidden className="size-4" strokeWidth={2.2} />
          )}
          {copied ? 'Copiado' : 'Copiar'}
          {isDesktop && (
            <kbd className="rounded-[5px] bg-card px-1.5 py-0.5 font-sans text-[11px] font-semibold text-muted-foreground">
              ⌘⇧C
            </kbd>
          )}
        </button>
        <p className="text-xs leading-[1.45] text-muted-foreground">
          {copied || copiedLine !== null
            ? 'Se borra del portapapeles en 30 s.'
            : 'Copia todo menos la primera línea. El icono de cada línea copia solo lo suyo.'}
        </p>
      </div>
    </>
  )
}

/**
 * El texto desbloqueado, para leer (C8b, D6). Cada línea con algo lleva su botón de copiar, que en
 * «Contraseña: 123456» copia solo `123456` (`lineValue`); en el móvil se ve siempre y mantener
 * pulsada la línea hace lo mismo, y en escritorio sale al pasar el ratón (y se puede seleccionar).
 * Tocar el texto lo edita.
 */
function ReadLines({
  title,
  text,
  isDesktop,
  copiedLine,
  onCopyLine,
  onEdit,
}: {
  title: string
  text: string
  isDesktop: boolean
  copiedLine: number | null
  onCopyLine: (index: number, value: string) => void
  onEdit: () => void
}) {
  // Seleccionar con el ratón para copiar no es editar.
  const edit = () => {
    if (!window.getSelection()?.toString()) onEdit()
  }
  return (
    <div aria-label="Texto de la nota" onCopy={clearClipboardLater} className="flex flex-col">
      <p
        onClick={edit}
        className={cn('cursor-text wrap-break-word', TITLE, !isDesktop && 'select-none')}
      >
        {title}
      </p>
      <div className="mt-1.5 flex flex-col">
        {text.split('\n').map((line, index) => (
          <CopyLine
            key={index}
            line={line}
            isDesktop={isDesktop}
            copied={copiedLine === index}
            onCopy={(value) => {
              onCopyLine(index, value)
            }}
            onEdit={edit}
          />
        ))}
      </div>
    </div>
  )
}

function CopyLine({
  line,
  isDesktop,
  copied,
  onCopy,
  onEdit,
}: {
  line: string
  isDesktop: boolean
  copied: boolean
  onCopy: (value: string) => void
  onEdit: () => void
}) {
  const target = lineValue(line)
  const press = useLongPress(() => {
    if (target) onCopy(target.value)
  })
  return (
    <div className="group -mx-2 flex min-h-[1.5em] items-start gap-2 rounded-lg px-2 hover:bg-fill/60">
      <p
        {...(isDesktop ? {} : press)}
        onClick={onEdit}
        className={cn(
          'min-w-0 flex-1 cursor-text wrap-break-word whitespace-pre-wrap',
          BODY,
          !isDesktop && 'select-none [-webkit-touch-callout:none]',
        )}
      >
        {line}
      </p>
      {target && (
        <button
          type="button"
          aria-label={`Copiar ${target.label ?? 'la línea'}`}
          onClick={() => {
            onCopy(target.value)
          }}
          className={cn(
            'flex h-7 shrink-0 items-center gap-1 self-center rounded-lg px-1.5 text-xs font-bold outline-none focus-visible:opacity-100 focus-visible:ring-[3px] focus-visible:ring-ring/50',
            copied
              ? 'bg-brand-tint text-primary opacity-100'
              : 'text-subtle-foreground hover:bg-border hover:text-foreground',
            isDesktop && !copied && 'opacity-0 group-hover:opacity-100',
          )}
        >
          {copied ? (
            <>
              <Check aria-hidden className="size-3.5" strokeWidth={2.6} />
              Copiado
            </>
          ) : (
            <Copy aria-hidden className="size-4" strokeWidth={2.2} />
          )}
        </button>
      )}
    </div>
  )
}

/** «Tipo · Nota protegida» (C8): no se cambia mientras esté protegida. */
export function ProtectedKindRow() {
  return (
    <div className="flex h-13 items-center justify-between gap-3 rounded-2xl border border-border-soft bg-card px-4 text-[15px]">
      <span className="font-medium">Tipo</span>
      <span className="flex items-center gap-2 font-semibold whitespace-nowrap">
        <FileText aria-hidden className="size-[15px] text-muted-foreground" strokeWidth={2.2} />
        Nota protegida
      </span>
    </div>
  )
}

/**
 * En lugar de «+ Foto», «+ Enlace» y «+ Documento» (diseño 29, P1): una nota protegida no los
 * lleva, y lo dice, en una caja gris con el candado.
 */
export function ProtectedMediaNote() {
  return (
    <p className="flex gap-2.5 rounded-2xl bg-fill px-4 py-3.5 text-[13.5px] leading-[1.45] text-muted-foreground">
      <Lock aria-hidden className="mt-0.5 size-3.5 shrink-0" strokeWidth={2.4} />
      Una nota protegida no lleva fotos, enlaces ni documentos: no se guardan con la clave y
      parecerían protegidos.
    </p>
  )
}
