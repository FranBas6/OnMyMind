import { Plus } from 'lucide-react'
import { useRef, useState, type SubmitEvent } from 'react'

import { cn } from '@/lib/utils'

import { ITEM_TITLE_MAX_LENGTH, itemTitleSchema } from '../schemas'

interface AddItemBarProps {
  placeholder: string
  onAdd: (title: string) => void
  /**
   * `docked`: móvil, pegado encima de la barra de navegación y siempre visible (pantalla 4).
   * `inline`: escritorio, un campo de 56 px arriba de la lista con la pista ↩ (D1).
   */
  variant: 'docked' | 'inline'
  /** En una lista recién creada el campo ya está enfocado (diseño 05, E7 y D4). */
  autoFocus?: boolean
}

/**
 * Campo para añadir ítems. Al enviar limpia el texto y conserva el foco, para encadenar varios
 * seguidos sin que se cierre el teclado. El + es también el botón de enviar. El texto va a 16 px
 * en móvil (el diseño dice 15): por debajo de 16, Safari en iOS amplía la página al enfocar.
 */
export function AddItemBar({ placeholder, onAdd, variant, autoFocus = false }: AddItemBarProps) {
  const [title, setTitle] = useState('')
  const input = useRef<HTMLInputElement>(null)

  const submit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault()
    const parsed = itemTitleSchema.safeParse(title)
    if (!parsed.success) return
    onAdd(parsed.data)
    setTitle('')
    input.current?.focus()
  }

  const field = (
    <form
      onSubmit={submit}
      className={cn(
        'flex items-center gap-3 border border-border bg-card focus-within:border-primary focus-within:shadow-[0_0_0_0.5px_var(--primary)] hover:border-control',
        variant === 'docked' ? 'h-[50px] rounded-2xl pr-3 pl-2' : 'h-14 rounded-[18px] pr-4 pl-3',
      )}
    >
      <button
        type="submit"
        aria-label="Añadir"
        // Que tocar el + no le quite el foco al campo: en iOS eso cerraría el teclado.
        onMouseDown={(event) => {
          event.preventDefault()
        }}
        className="grid size-9 shrink-0 place-items-center rounded-xl text-primary outline-none hover:bg-brand-tint focus-visible:ring-[3px] focus-visible:ring-ring/50"
      >
        <Plus aria-hidden className="size-5 md:size-[22px]" strokeWidth={2.6} />
      </button>
      <input
        ref={input}
        value={title}
        onChange={(event) => {
          setTitle(event.target.value)
        }}
        placeholder={placeholder}
        aria-label={placeholder}
        maxLength={ITEM_TITLE_MAX_LENGTH}
        autoFocus={autoFocus}
        autoComplete="off"
        enterKeyHint="enter"
        className="h-full min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-subtle-foreground"
      />
      {variant === 'inline' && (
        <kbd
          aria-hidden
          className="rounded-md bg-fill px-2 py-[3px] font-sans text-xs text-muted-foreground"
        >
          ↩
        </kbd>
      )}
    </form>
  )

  if (variant === 'inline') return field

  return (
    <div className="sticky bottom-[calc(env(safe-area-inset-bottom)+3.5rem)] z-30 -mx-5 mt-auto border-t border-border-soft bg-background/92 px-4 pt-2.5 pb-3 backdrop-blur-md">
      {field}
    </div>
  )
}
