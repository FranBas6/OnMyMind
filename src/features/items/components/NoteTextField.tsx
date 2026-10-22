import {
  useEffect,
  useLayoutEffect,
  useReducer,
  useRef,
  useState,
  type ClipboardEvent,
  type FocusEvent,
  type KeyboardEvent,
} from 'react'

import { cn } from '@/lib/utils'

import { enterInBullet, withBullets } from '../bullets'
import { joinNoteDraft, noteBody, splitNoteText, type NoteDraft, type SplitNote } from '../noteText'
import { ITEM_NOTES_MAX_LENGTH } from '../schemas'
import type { Item } from '../types'

/** Tras dejar de escribir tanto tiempo, se guarda aunque se siga en el texto (como el título, 1.8). */
const IDLE_SAVE_MS = 600

/** Dónde poner el cursor tras cambiar el texto desde aquí (partir, juntar, una viñeta). */
interface Caret {
  field: 'title' | 'body'
  at: number
}

/** Ajusta la altura del textarea a su contenido (sin barra de scroll). */
function autoGrow(element: HTMLTextAreaElement | null) {
  if (!element) return
  element.style.height = 'auto'
  element.style.height = `${element.scrollHeight}px`
}

interface NoteEditorProps {
  value: NoteDraft
  onChange: (next: NoteDraft) => void
  /** Al salir del texto (pasar de la primera línea al resto no cuenta). */
  onBlur?: () => void
  /** Pegar en la primera línea con el texto vacío: si lo trata quien lo usa, `preventDefault`. */
  onPaste?: (event: ClipboardEvent<HTMLTextAreaElement>) => void
  /** Teclas antes de las del texto (⌘↩ para guardar en la captura). */
  onKeyDown?: (event: KeyboardEvent<HTMLTextAreaElement>) => void
  placeholder: string
  /** En el resto mientras está vacío, para que se vea dónde va el contenido (Fran, 2026-10-22). */
  bodyPlaceholder?: string
  /** El nombre de la primera línea para lectores de pantalla; el resto es «El resto de la nota». */
  label: string
  autoFocus?: boolean
  titleClassName: string
  bodyClassName: string
}

/**
 * Un solo texto sin título aparte (diseño 25, B2 y B3), como en Notas del iPhone: la primera línea
 * se pinta más grande que el resto. Un `textarea` no pinta líneas de dos tamaños, así que son dos
 * campos que se comportan como uno: Intro en la primera línea pasa al resto, partiendo donde está
 * el cursor (y pegar varias líneas también parte), ↓ al final baja, y borrar al principio del resto
 * lo junta con la primera línea. En el resto, «- » pasa a «• » e Intro sigue la viñeta
 * (`bullets.ts`). Lo usan la ficha de una nota y la captura rápida.
 */
export function NoteEditor({
  value,
  onChange,
  onBlur,
  onPaste,
  onKeyDown,
  placeholder,
  bodyPlaceholder,
  label,
  autoFocus = false,
  titleClassName,
  bodyClassName,
}: NoteEditorProps) {
  const titleField = useRef<HTMLTextAreaElement | null>(null)
  const bodyField = useRef<HTMLTextAreaElement | null>(null)
  const caret = useRef<Caret | null>(null)
  // Pintar otra vez aunque el texto no cambie (Intro al final de la primera línea solo baja).
  const [, repaint] = useReducer((count: number) => count + 1, 0)

  // Tras partir o juntar, el cursor va donde toca (React lo dejaría al final).
  useLayoutEffect(() => {
    autoGrow(titleField.current)
    autoGrow(bodyField.current)
    const target = caret.current
    if (!target) return
    caret.current = null
    const field = target.field === 'title' ? titleField.current : bodyField.current
    field?.focus()
    field?.setSelectionRange(target.at, target.at)
  })

  const change = (next: NoteDraft, at?: Caret) => {
    if (at) {
      caret.current = at
      repaint()
    }
    onChange(next)
  }

  const blur = (event: FocusEvent) => {
    if (event.relatedTarget === titleField.current || event.relatedTarget === bodyField.current) {
      return
    }
    onBlur?.()
  }

  const changeTitle = (field: HTMLTextAreaElement) => {
    const text = field.value
    const end = text.indexOf('\n')
    if (end < 0) {
      change({ ...value, title: text })
      return
    }
    // Intro o un texto pegado con saltos: lo que sigue a la primera línea pasa al resto.
    const rest = withBullets(text.slice(end + 1))
    change(
      { title: text.slice(0, end), body: value.body ? `${rest}\n${value.body}` : rest },
      { field: 'body', at: Math.max(0, field.selectionStart - end - 1) },
    )
  }

  const titleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    onKeyDown?.(event)
    if (event.defaultPrevented) return
    const field = event.currentTarget
    // ↓ al final de la primera línea baja al resto.
    if (event.key === 'ArrowDown' && field.selectionStart === field.value.length) {
      event.preventDefault()
      bodyField.current?.focus()
      bodyField.current?.setSelectionRange(0, 0)
    }
  }

  const changeBody = (field: HTMLTextAreaElement) => {
    const text = withBullets(field.value)
    change(
      { ...value, body: text },
      text === field.value ? undefined : { field: 'body', at: field.selectionStart },
    )
  }

  const bodyKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    onKeyDown?.(event)
    if (event.defaultPrevented) return
    const field = event.currentTarget
    const { selectionStart: start, selectionEnd: end } = field
    if (event.key === 'Enter' && !event.nativeEvent.isComposing) {
      const next = enterInBullet({ value: field.value, start, end })
      if (!next) return
      event.preventDefault()
      change({ ...value, body: next.value }, { field: 'body', at: next.start })
      return
    }
    // Borrar al principio del resto lo junta con la primera línea.
    if (event.key === 'Backspace' && start === 0 && end === 0) {
      event.preventDefault()
      const lineEnd = value.body.indexOf('\n')
      const first = lineEnd < 0 ? value.body : value.body.slice(0, lineEnd)
      const rest = lineEnd < 0 ? '' : value.body.slice(lineEnd + 1)
      change({ title: value.title + first, body: rest }, { field: 'title', at: value.title.length })
    }
  }

  const empty = value.title === '' && value.body === ''

  return (
    <div className="flex flex-col">
      <textarea
        ref={(element) => {
          titleField.current = element
          autoGrow(element)
        }}
        data-vaul-no-drag
        aria-label={label}
        placeholder={empty ? placeholder : undefined}
        rows={1}
        value={value.title}
        autoFocus={autoFocus}
        enterKeyHint="enter"
        onChange={(event) => {
          changeTitle(event.currentTarget)
        }}
        onPaste={onPaste}
        onKeyDown={titleKeyDown}
        onBlur={blur}
        className={cn(
          'min-w-0 resize-none overflow-hidden bg-transparent wrap-break-word outline-none placeholder:text-subtle-foreground',
          titleClassName,
        )}
      />
      <textarea
        ref={(element) => {
          bodyField.current = element
          autoGrow(element)
        }}
        data-vaul-no-drag
        aria-label="El resto de la nota"
        placeholder={value.body === '' ? bodyPlaceholder : undefined}
        rows={1}
        value={value.body}
        maxLength={ITEM_NOTES_MAX_LENGTH}
        enterKeyHint="enter"
        onChange={(event) => {
          changeBody(event.currentTarget)
        }}
        onKeyDown={bodyKeyDown}
        onBlur={blur}
        className={cn(
          'min-w-0 resize-none overflow-hidden bg-transparent wrap-break-word outline-none placeholder:text-subtle-foreground',
          bodyClassName,
        )}
      />
    </div>
  )
}

interface NoteTextFieldProps {
  item: Pick<Item, 'id' | 'title' | 'notes'>
  /** Guarda el texto partido: la primera línea al título y el resto a las notas. */
  onSave: (note: SplitNote) => void
  /** Se cierra con todo el texto borrado (diseño 25, B2e). */
  onEmptyClose: () => void
  /** Con el cursor ya dentro (la nota protegida, al pasar de leer a editar). */
  autoFocus?: boolean
  /** Al salir del texto, tras guardarlo. */
  onBlur?: () => void
}

/**
 * El texto de la ficha de una nota (diseño 25, B2): la primera línea en Plus Jakarta 24 px y el
 * resto en 16,5 px (`NoteEditor`). Se guarda como las notas de siempre: al salir del texto o tras
 * 600 ms sin teclear, partido en título y notas (`splitNoteText`). Mientras no se edita, enseña lo
 * guardado, así que un cambio que llega del servidor se ve sin más. Sin nada escrito no se guarda,
 * y si se cierra así lo dice `onEmptyClose`.
 */
export function NoteTextField({
  item,
  onSave,
  onEmptyClose,
  autoFocus = false,
  onBlur,
}: NoteTextFieldProps) {
  const [draft, setDraft] = useState<NoteDraft | null>(null)
  const value: NoteDraft = draft ?? { title: item.title, body: noteBody(item) }
  const timer = useRef<number | undefined>(undefined)
  // Lo escrito sin enviar y las últimas funciones: al cerrarse antes de los 600 ms, se envía (o,
  // si se borró todo, se avisa) al desmontar.
  const pending = useRef<NoteDraft | null>(null)
  const latest = useRef({ item, onSave, onEmptyClose })

  useEffect(() => {
    latest.current = { item, onSave, onEmptyClose }
  })

  useEffect(
    () => () => {
      window.clearTimeout(timer.current)
      const last = pending.current
      if (!last) return
      if (splitNoteText(joinNoteDraft(last))) send(latest.current, last)
      else latest.current.onEmptyClose()
    },
    [],
  )

  const change = (next: NoteDraft) => {
    setDraft(next)
    pending.current = next
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => {
      if (pending.current) send(latest.current, pending.current)
    }, IDLE_SAVE_MS)
  }

  const commit = () => {
    window.clearTimeout(timer.current)
    const last = pending.current
    if (!last) {
      setDraft(null)
      onBlur?.()
      return
    }
    // Vacío se queda a la vista, sin guardar, hasta cerrar (B2e) o volver a escribir.
    if (!splitNoteText(joinNoteDraft(last))) return
    pending.current = null
    send(latest.current, last)
    setDraft(null)
    onBlur?.()
  }

  return (
    <NoteEditor
      value={value}
      onChange={change}
      onBlur={commit}
      autoFocus={autoFocus}
      placeholder="Escribe…"
      // Vacía del todo ya dice «Escribe…» arriba: «Escribe aquí…» sale cuando hay primera línea.
      bodyPlaceholder={value.title ? 'Escribe aquí…' : undefined}
      label="Texto de la nota"
      titleClassName="font-display text-2xl leading-[1.25] font-extrabold tracking-[-0.02em]"
      bodyClassName={cn('mt-1.5 text-[16.5px] leading-normal', !value.body && 'min-h-12')}
    />
  )
}

/** Envía lo escrito, partido, si cambia algo de lo guardado. */
function send(
  { item, onSave }: Pick<NoteTextFieldProps, 'item' | 'onSave'>,
  draft: NoteDraft,
): void {
  const split = splitNoteText(joinNoteDraft(draft))
  if (!split) return
  if (split.title === item.title && split.notes === item.notes) return
  onSave(split)
}
