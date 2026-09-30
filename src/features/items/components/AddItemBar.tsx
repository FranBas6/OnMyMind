import { Plus } from 'lucide-react'
import { Popover } from 'radix-ui'
import {
  useImperativeHandle,
  useRef,
  useState,
  type MouseEvent,
  type ReactNode,
  type Ref,
  type SubmitEvent,
} from 'react'

import { BottomSheet } from '@/components/BottomSheet'
import { cn } from '@/lib/utils'

import {
  CHOOSABLE_KINDS,
  KIND_ARTICLE_NOUN,
  KIND_LABELS,
  parseKindPrefix,
  type AddableKind,
  type ChoosableKind,
} from '../kind'
import { ITEM_TITLE_MAX_LENGTH, itemTitleSchema } from '../schemas'
import { KindOptions } from './KindOptions'
import { KIND_ICONS } from './kindIcons'

interface AddItemBarProps {
  placeholder: string
  /** `kind` es el tipo elegido o, si no se ha tocado nada, el tipo por defecto de la lista. */
  onAdd: (title: string, kind: AddableKind | undefined) => void
  /**
   * `docked`: móvil, pegado encima de la barra de navegación y siempre visible (pantalla 4).
   * `inline`: escritorio, un campo de 56 px arriba de la lista con la pista ↩ (D1).
   */
  variant: 'docked' | 'inline'
  /** En una lista recién creada el campo ya está enfocado (diseño 05, E7 y D4). */
  autoFocus?: boolean
  /**
   * Con él, el + abre el selector de tipo (diseño 12, T2 y D2). Sin él («En mente», que no tiene
   * tipos), el + solo añade.
   */
  kinds?: {
    defaultKind: ChoosableKind
    listName: string
    /** «Sublista» al final del selector y el prefijo «/ » (no dentro de una sublista). */
    sublists?: boolean
  }
  /** Para empezar con un tipo desde fuera: «Nueva sublista» del menú de la lista (diseño 12, S7). */
  handle?: Ref<AddItemBarHandle>
}

export interface AddItemBarHandle {
  /** Pone el tipo (sale su chip) y enfoca el campo. */
  startWith: (kind: AddableKind) => void
}

// Que tocar el + o el chip no le quite el foco al campo: en iOS eso cerraría el teclado.
const keepFocus = (event: MouseEvent) => {
  event.preventDefault()
}

/**
 * Campo para añadir ítems. Al enviar limpia el texto y conserva el foco, para encadenar varios
 * seguidos sin que se cierre el teclado. Escribir y pulsar ↩ crea un ítem del tipo por defecto de
 * la lista, como siempre. El + abre un selector pequeño de tipo (hoja en móvil, popover en
 * escritorio); en escritorio, además, los prefijos «> » (compra) y «@ » (evento). Un tipo distinto
 * del de por defecto sale como chip a la derecha hasta guardar (diseño 12, T3). El texto va a 16 px
 * en móvil (el diseño dice 15): por debajo de 16, Safari en iOS amplía la página al enfocar.
 */
export function AddItemBar({
  placeholder,
  onAdd,
  variant,
  autoFocus = false,
  kinds,
  handle,
}: AddItemBarProps) {
  const [title, setTitle] = useState('')
  const [chosen, setChosen] = useState<AddableKind | null>(null)
  const [picking, setPicking] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  const inline = variant === 'inline'
  const offered: readonly AddableKind[] = kinds?.sublists
    ? [...CHOOSABLE_KINDS, 'sublist']
    : CHOOSABLE_KINDS

  useImperativeHandle(handle, () => ({
    startWith: (kind) => {
      setChosen(kind)
      input.current?.focus()
    },
  }))

  const parsed = kinds && inline ? parseKindPrefix(title) : null
  const prefixed = parsed && offered.includes(parsed.kind) ? parsed : null
  const kind = kinds ? (prefixed?.kind ?? chosen ?? kinds.defaultKind) : undefined
  const chip = kinds && kind && kind !== kinds.defaultKind ? kind : null

  const submit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault()
    const parsed = itemTitleSchema.safeParse(prefixed ? prefixed.title : title)
    if (!parsed.success) return
    onAdd(parsed.data, kind)
    setTitle('')
    setChosen(null)
    input.current?.focus()
  }

  const choose = (next: AddableKind) => {
    setChosen(next)
    setPicking(false)
    input.current?.focus()
  }

  const plusClassName = cn(
    'grid size-9 shrink-0 place-items-center rounded-[11px] text-primary outline-none hover:bg-brand-tint focus-visible:ring-[3px] focus-visible:ring-ring/50',
    picking && 'bg-brand-tint',
  )
  const plusIcon = <Plus aria-hidden className="size-5 md:size-[22px]" strokeWidth={2.6} />
  const plus = kinds ? (
    <button
      type="button"
      aria-label="Elegir el tipo"
      aria-haspopup="dialog"
      aria-expanded={picking}
      onMouseDown={keepFocus}
      onClick={() => {
        setPicking((open) => !open)
      }}
      className={plusClassName}
    >
      {plusIcon}
    </button>
  ) : (
    <button type="submit" aria-label="Añadir" onMouseDown={keepFocus} className={plusClassName}>
      {plusIcon}
    </button>
  )

  const ChipIcon = chip ? KIND_ICONS[chip] : null
  const field = (
    <form
      onSubmit={submit}
      className={cn(
        'flex items-center gap-3 border border-border bg-card focus-within:border-primary focus-within:shadow-[0_0_0_0.5px_var(--primary)] hover:border-control',
        inline ? 'h-14 rounded-[18px] pr-4 pl-2.5' : 'h-[50px] rounded-2xl pr-3 pl-2',
        picking && 'border-primary',
      )}
    >
      {kinds && inline ? <Popover.Trigger asChild>{plus}</Popover.Trigger> : plus}
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
      {chip && ChipIcon && (
        <button
          type="button"
          aria-label={`Tipo: ${KIND_LABELS[chip]}. Cambiar`}
          onMouseDown={keepFocus}
          onClick={() => {
            setPicking(true)
          }}
          className="inline-flex h-7 shrink-0 items-center gap-[5px] rounded-[9px] bg-brand-tint px-2.5 text-xs font-bold text-primary-strong outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          <ChipIcon aria-hidden className="size-[13px]" strokeWidth={2.2} />
          {KIND_LABELS[chip]}
        </button>
      )}
      {inline && (
        <kbd
          aria-hidden
          className="rounded-md bg-fill px-2 py-[3px] font-sans text-xs text-muted-foreground"
        >
          ↩
        </kbd>
      )}
    </form>
  )

  if (!kinds || !kind) {
    if (inline) return field
    return <Docked>{field}</Docked>
  }

  const heading = `Añadir a ${kinds.listName}`
  const options = (compact: boolean) => (
    <KindOptions<AddableKind>
      label={heading}
      value={kind}
      kinds={offered}
      defaultKind={kinds.defaultKind}
      compact={compact}
      onChange={choose}
    />
  )

  if (inline) {
    return (
      <Popover.Root open={picking} onOpenChange={setPicking}>
        <Popover.Anchor asChild>{field}</Popover.Anchor>
        <Popover.Portal>
          <Popover.Content
            align="start"
            sideOffset={6}
            aria-label={heading}
            onOpenAutoFocus={(event) => {
              event.preventDefault()
            }}
            className="z-50 flex w-[340px] flex-col gap-0.5 rounded-[18px] border border-border-soft bg-popover p-2 text-popover-foreground shadow-popover outline-none"
          >
            <p className="px-3 pt-2 pb-1.5 text-[11px] font-bold tracking-[0.06em] text-subtle-foreground uppercase">
              {heading}
            </p>
            {options(true)}
            <p className="px-3 pt-2 pb-1.5 text-xs leading-normal text-subtle-foreground">
              Escribe y pulsa ↩ para {KIND_ARTICLE_NOUN[kinds.defaultKind]}. Prefijos rápidos: «&gt;
              » compra, «@ » evento{kinds.sublists ? ', «/ » sublista' : ''}.
            </p>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    )
  }

  return (
    <Docked>
      {field}
      <BottomSheet open={picking} onOpenChange={setPicking} title={heading} className="px-4">
        <p className="px-3.5 pt-1 pb-2 text-xs font-bold tracking-[0.06em] text-subtle-foreground uppercase">
          {heading}
        </p>
        {options(false)}
      </BottomSheet>
    </Docked>
  )
}

/** Móvil: pegado encima de la barra de navegación (pantalla 4). */
function Docked({ children }: { children: ReactNode }) {
  return (
    <div className="sticky bottom-[calc(env(safe-area-inset-bottom)+3.5rem)] z-30 -mx-5 mt-auto border-t border-border-soft bg-background/92 px-4 pt-2.5 pb-3 backdrop-blur-md">
      {children}
    </div>
  )
}
