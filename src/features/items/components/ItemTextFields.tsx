import { Pencil } from 'lucide-react'
import { useEffect, useRef, useState, type KeyboardEvent } from 'react'

import { cn } from '@/lib/utils'

import { ITEM_NOTES_MAX_LENGTH, ITEM_TITLE_MAX_LENGTH, itemTitleSchema } from '../schemas'

/** Tras dejar de escribir tanto tiempo, se guarda aunque el campo siga enfocado (plan 1.8). */
const IDLE_SAVE_MS = 600

/**
 * Guardado sin botón: el texto que se escribe es un borrador local que se envía al perder el
 * foco o tras 600 ms sin teclear. Mientras no se edita, el campo enseña el valor guardado, así
 * que un cambio que llega del servidor (o el rollback de un error) se ve sin sincronizar nada.
 */
function useDraft(saved: string, save: (value: string) => void) {
  const [draft, setDraft] = useState<string | null>(null)
  const timer = useRef<number | undefined>(undefined)
  // Lo escrito que aún no se ha enviado, y la última `save`: si la hoja se cierra antes de los
  // 600 ms, se envía al desmontar en vez de perderse.
  const pending = useRef<string | null>(null)
  const latestSave = useRef(save)

  useEffect(() => {
    latestSave.current = save
  })

  useEffect(
    () => () => {
      window.clearTimeout(timer.current)
      if (pending.current !== null) latestSave.current(pending.current)
    },
    [],
  )

  const flush = () => {
    window.clearTimeout(timer.current)
    if (pending.current !== null) save(pending.current)
    pending.current = null
  }

  const change = (value: string) => {
    setDraft(value)
    pending.current = value
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(flush, IDLE_SAVE_MS)
  }

  const commit = () => {
    flush()
    setDraft(null)
  }

  return { value: draft ?? saved, change, commit }
}

/** Ajusta la altura del textarea a su contenido (sin barra de scroll). */
function autoGrow(element: HTMLTextAreaElement | null) {
  if (!element) return
  element.style.height = 'auto'
  element.style.height = `${element.scrollHeight}px`
}

interface TitleFieldProps {
  title: string
  done: boolean
  onSave: (title: string) => void
  className?: string
}

/**
 * Título editable en línea (diseño 06): Plus Jakarta 800, crece en varias líneas, tachado si
 * está hecho. Intro termina la edición (no hay saltos de línea en un título) y un título vacío
 * vuelve al que había.
 */
export function ItemTitleField({ title, done, onSave, className }: TitleFieldProps) {
  const save = (value: string) => {
    const parsed = itemTitleSchema.safeParse(value)
    if (parsed.success && parsed.data !== title) onSave(parsed.data)
  }
  const draft = useDraft(title, save)

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault()
      event.currentTarget.blur()
    }
  }

  return (
    <textarea
      ref={autoGrow}
      data-vaul-no-drag
      aria-label="Título"
      rows={1}
      value={draft.value}
      maxLength={ITEM_TITLE_MAX_LENGTH}
      onChange={(event) => {
        draft.change(event.target.value)
        autoGrow(event.currentTarget)
      }}
      onBlur={draft.commit}
      onKeyDown={onKeyDown}
      className={cn(
        'min-w-0 flex-1 resize-none overflow-hidden bg-transparent font-display leading-[1.2] font-extrabold tracking-[-0.02em] outline-none',
        done && 'text-muted-foreground line-through',
        className,
      )}
    />
  )
}

interface NotesFieldProps {
  notes: string | null
  onSave: (notes: string | null) => void
}

/**
 * Notas (diseño 06): caja `fill` de radio 16 con el texto; vacías, una caja punteada «Añadir
 * notas» con el lápiz. Es el mismo textarea: al enfocarlo se escribe ahí mismo, sin pasos extra.
 */
export function NotesField({ notes, onSave }: NotesFieldProps) {
  const save = (value: string) => {
    const next = value.trim() ? value.trim() : null
    if (next !== notes) onSave(next)
  }
  const draft = useDraft(notes ?? '', save)
  const [focused, setFocused] = useState(false)
  const empty = draft.value.trim() === '' && !focused

  return (
    <div className="relative">
      {empty && (
        <Pencil
          aria-hidden
          className="pointer-events-none absolute top-[17px] left-4 size-4 text-subtle-foreground"
          strokeWidth={2}
        />
      )}
      <textarea
        ref={autoGrow}
        data-vaul-no-drag
        aria-label="Notas"
        placeholder="Añadir notas"
        rows={empty ? 1 : 2}
        value={draft.value}
        maxLength={ITEM_NOTES_MAX_LENGTH}
        onFocus={() => {
          setFocused(true)
        }}
        onChange={(event) => {
          draft.change(event.target.value)
          autoGrow(event.currentTarget)
        }}
        onBlur={() => {
          setFocused(false)
          draft.commit()
        }}
        className={cn(
          'block w-full resize-none overflow-hidden rounded-2xl px-4 py-3.5 text-base leading-[1.45] outline-none placeholder:text-subtle-foreground md:rounded-[14px] md:text-sm',
          empty
            ? 'min-h-13 border-[1.5px] border-dashed border-control pl-[42px]'
            : 'min-h-16 bg-fill focus:ring-[3px] focus:ring-ring/30',
        )}
      />
    </div>
  )
}
