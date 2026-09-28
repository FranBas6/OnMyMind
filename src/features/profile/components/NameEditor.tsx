import { Dialog } from 'radix-ui'
import { useRef, useState, type KeyboardEvent } from 'react'

import { KeyboardSheetContent } from '@/components/KeyboardSheet'
import { cn } from '@/lib/utils'

import { DISPLAY_NAME_MAX_LENGTH, displayNameSchema } from '../schemas'

/**
 * Lo que dice la pista del nombre. El diseño pone «Sale en el saludo de Inicio.», pero Inicio no
 * tiene saludo: el nombre se ve en tu avatar (su inicial) y al pie del sidebar.
 */
const NAME_HINT = 'Su inicial es la de tu avatar.'
const PLACEHOLDER = 'Cómo quieres que te llamemos'

function useNameDraft(initial: string, onSave: (name: string) => void, onDone: () => void) {
  const [value, setValue] = useState(initial)
  const [error, setError] = useState<string | null>(null)
  // Intro guarda y cierra, y al cerrarse el campo pierde el foco: sin esto guardaría dos veces.
  const finished = useRef(false)
  const save = () => {
    if (finished.current) return
    const result = displayNameSchema.safeParse(value)
    if (!result.success) {
      setError(result.error.issues[0]?.message ?? 'Ponle un nombre.')
      return
    }
    finished.current = true
    if (result.data !== initial.trim()) onSave(result.data)
    onDone()
  }
  const cancel = () => {
    finished.current = true
    onDone()
  }
  const change = (next: string) => {
    setValue(next.slice(0, DISPLAY_NAME_MAX_LENGTH))
    if (error) setError(null)
  }
  return { value, error, change, save, cancel }
}

function Counter({ length, error }: { length: number; error: boolean }) {
  const full = length >= DISPLAY_NAME_MAX_LENGTH
  return (
    <span
      aria-hidden
      className={cn(
        'shrink-0 text-[13px] whitespace-nowrap',
        error || full ? 'text-error' : 'text-subtle-foreground',
      )}
    >
      {length}/{DISPLAY_NAME_MAX_LENGTH}
    </span>
  )
}

interface NameEditorProps {
  name: string
  onSave: (name: string) => void
  onClose: () => void
}

/**
 * Móvil (diseño 09, P2–P4): hoja pequeña pegada al teclado con «Cancelar · Tu nombre · Listo»,
 * el campo, la pista y el contador 0/50. Vacío, «Ponle un nombre.» y el borde en `error`.
 */
export function NameSheet({ name, onSave, onClose, open }: NameEditorProps & { open: boolean }) {
  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose()
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-scrim" />
        <KeyboardSheetContent title="Tu nombre">
          <NameSheetForm key={String(open)} name={name} onSave={onSave} onClose={onClose} />
        </KeyboardSheetContent>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

function NameSheetForm({ name, onSave, onClose }: NameEditorProps) {
  const draft = useNameDraft(name, onSave, onClose)
  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault()
        draft.save()
      }}
      className="flex flex-col gap-3.5 pb-5"
    >
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onClose}
          className="h-11 pr-2 text-[15px] font-semibold text-muted-foreground outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          Cancelar
        </button>
        <p aria-hidden className="font-display text-base font-bold">
          Tu nombre
        </p>
        <button
          type="submit"
          className="h-11 pl-2 text-[15px] font-bold text-primary outline-none hover:text-primary-hover focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          Listo
        </button>
      </div>
      <NameInput draft={draft} large />
    </form>
  )
}

/**
 * Escritorio (diseño 09, D2 y D3): el nombre se convierte en campo en el sitio, con el contador
 * dentro. Intro guarda y Escape cancela; salir del campo también guarda.
 */
export function InlineNameEditor({ name, onSave, onClose }: NameEditorProps) {
  const draft = useNameDraft(name, onSave, onClose)
  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault()
        draft.save()
      }}
      className="max-w-[420px] flex-1"
    >
      <NameInput
        draft={draft}
        hint={`${NAME_HINT} Intro guarda, Esc cancela.`}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.preventDefault()
            draft.cancel()
          }
        }}
        onBlur={draft.save}
      />
    </form>
  )
}

function NameInput({
  draft,
  large = false,
  hint = NAME_HINT,
  onKeyDown,
  onBlur,
}: {
  draft: ReturnType<typeof useNameDraft>
  large?: boolean
  hint?: string
  onKeyDown?: (event: KeyboardEvent<HTMLInputElement>) => void
  onBlur?: () => void
}) {
  const { value, error, change } = draft
  return (
    <div className="flex flex-col gap-2">
      <div
        className={cn(
          'flex items-center gap-3 rounded-2xl border-[1.5px] bg-background px-[18px] focus-within:border-primary',
          large ? 'h-14' : 'h-12 bg-card',
          error ? 'border-error focus-within:border-error' : 'border-border',
        )}
      >
        <input
          autoFocus
          aria-label="Tu nombre"
          aria-invalid={error ? true : undefined}
          aria-describedby="name-message"
          enterKeyHint="done"
          autoComplete="nickname"
          placeholder={PLACEHOLDER}
          value={value}
          maxLength={DISPLAY_NAME_MAX_LENGTH}
          onChange={(event) => {
            change(event.target.value)
          }}
          onKeyDown={onKeyDown}
          onBlur={onBlur}
          className={cn(
            'min-w-0 flex-1 bg-transparent font-display font-bold outline-none placeholder:font-sans placeholder:font-normal placeholder:text-placeholder',
            large ? 'text-lg' : 'text-base',
          )}
        />
        {!large && <Counter length={value.length} error={Boolean(error)} />}
      </div>
      <p
        id="name-message"
        className="flex justify-between gap-3 px-1 text-[13px] leading-[1.4]"
        role={error ? 'alert' : undefined}
      >
        <span className={error ? 'text-error' : 'text-subtle-foreground'}>{error ?? hint}</span>
        {large && <Counter length={value.length} error={Boolean(error)} />}
      </p>
    </div>
  )
}
