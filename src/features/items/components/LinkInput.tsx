import { Link2, X } from 'lucide-react'
import { useId, useState, type ClipboardEvent, type KeyboardEvent } from 'react'

import { cn } from '@/lib/utils'

import { normalizeLink } from '../links'

/**
 * «Pega un enlace…» (diseño 15, M2 y M6): abre con el foco y se guarda al pegar o con Intro. Si lo
 * escrito no es un enlace, lo dice y espera. Con portapapeles accesible, «Pegar» lo pega sin tener
 * que mantener pulsado.
 */
export function LinkInput({
  onSave,
  onCancel,
  validate,
}: {
  onSave: (url: string) => void
  onCancel: () => void
  /** Otra comprobación además de que sea un enlace; devuelve el error que decir (diseño 19, T9). */
  validate?: (url: string) => string | null
}) {
  const id = useId()
  const [text, setText] = useState('')
  const [error, setError] = useState<string | null>(null)
  const invalid = error !== null
  const check = (url: string | null): string | null =>
    url === null ? 'Eso no parece un enlace.' : (validate?.(url) ?? null)
  const canRead =
    typeof navigator !== 'undefined' &&
    'clipboard' in navigator &&
    'readText' in navigator.clipboard

  const submit = (value: string) => {
    const url = normalizeLink(value)
    const problem = check(url)
    if (url && !problem) onSave(url)
    else setError(problem)
  }
  const onPaste = (event: ClipboardEvent<HTMLInputElement>) => {
    const pasted = event.clipboardData.getData('text/plain')
    const url = normalizeLink(pasted)
    if (!url) return
    event.preventDefault()
    const problem = check(url)
    if (problem) {
      setText(pasted)
      setError(problem)
    } else onSave(url)
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
            setError(null)
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
          {error}
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
