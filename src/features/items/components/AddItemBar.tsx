import { ArrowUp, ChevronDown, CornerDownLeft } from 'lucide-react'
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
import { useWrittenDate } from '../hooks/useWrittenDate'
import { ITEM_TITLE_MAX_LENGTH, itemTitleSchema } from '../schemas'
import { readsWrittenDates, type WrittenDate } from '../writtenDate'
import { FieldMarks, markedFieldClass } from './FieldMarks'
import { KindOptions } from './KindOptions'
import { KIND_ICONS } from './kindIcons'
import { WrittenDatePill } from './WrittenDatePill'

interface AddItemBarProps {
  placeholder: string
  /**
   * `kind` es el tipo elegido o, si no se ha tocado nada, el tipo por defecto de la lista. Con una
   * fecha escrita en una tarea o un evento (3.5), `written` es lo que se entendió de ella.
   */
  onAdd: (title: string, kind: AddableKind | undefined, written: WrittenDate | null) => void
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

// Que tocar el tipo o «Añadir» no le quite el foco al campo: en iOS eso cerraría el teclado.
const keepFocus = (event: MouseEvent) => {
  event.preventDefault()
}

/**
 * Campo para añadir ítems. Al enviar limpia el texto y conserva el foco, para encadenar varios
 * seguidos sin que se cierre el teclado. Se añade con el botón redondo ↑ de la derecha (gris hasta
 * que hay texto) o con Intro. A la izquierda, el icono del tipo con el que se va a añadir y una
 * flechita: abre un selector pequeño de tipo (hoja en móvil, popover en escritorio), y si se elige
 * uno que no es el de por defecto, el icono se resalta hasta guardar (decisión de Fran del
 * 2026-10-01: antes era un «+» que confundía, y el tipo distinto salía como chip, diseño 12 T3).
 * En escritorio, además, los prefijos «> » (compra) y «@ » (evento). El texto va a 16 px en móvil
 * (el diseño dice 15): por debajo de 16, Safari en iOS amplía la página al enfocar.
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

  // Fechas escritas (3.5, diseño 21, A8, A9 y D2): en tareas y eventos, sin el prefijo de tipo.
  const body = prefixed ? prefixed.title : title
  const dateKind = kind && readsWrittenDates(kind) ? kind : null
  const dated = useWrittenDate(body, dateKind)
  const offset = title.length - body.length
  const marks =
    dated.understood && !dated.undone
      ? dated.understood.parsed.ranges.map(({ start, end }) => ({
          start: start + offset,
          end: end + offset,
        }))
      : null
  const [scrollLeft, setScrollLeft] = useState(0)

  const submit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault()
    const parsed = itemTitleSchema.safeParse(dated.toSave.title)
    if (!parsed.success) return
    onAdd(parsed.data, kind, dated.toSave.written)
    setTitle('')
    setChosen(null)
    dated.reset()
    input.current?.focus()
  }

  const choose = (next: AddableKind) => {
    setChosen(next)
    setPicking(false)
    input.current?.focus()
  }

  const empty = title.trim() === ''
  // El tipo con el que se va a añadir, a la izquierda (decisión de Fran, 2026-10-01): su icono y
  // una flechita, para que se lea «tipo» y no «añadir». Resaltado si no es el de por defecto.
  const KindIcon = kind ? KIND_ICONS[kind] : null
  const kindButton = kinds && kind && KindIcon && (
    <button
      type="button"
      aria-label={`Tipo: ${KIND_LABELS[kind]}. Cambiar`}
      aria-haspopup="dialog"
      aria-expanded={picking}
      onMouseDown={keepFocus}
      onClick={() => {
        setPicking((open) => !open)
      }}
      className={cn(
        'flex h-9 shrink-0 items-center gap-0.5 rounded-[11px] pr-1.5 pl-2 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50',
        chip ? 'bg-brand-tint text-primary-strong' : 'text-muted-foreground hover:bg-fill',
        picking && !chip && 'bg-fill',
      )}
    >
      <KindIcon
        aria-hidden
        className={kind === 'sublist' ? 'size-4' : 'size-[18px]'}
        strokeWidth={kind === 'sublist' ? 3 : 2.2}
      />
      <ChevronDown aria-hidden className="size-3.5 opacity-70" strokeWidth={2.4} />
    </button>
  )

  const field = (
    <form
      onSubmit={submit}
      className={cn(
        'flex items-center gap-2 border border-border bg-card focus-within:border-primary focus-within:shadow-[0_0_0_0.5px_var(--primary)] hover:border-control',
        inline ? 'h-14 rounded-[18px] pr-2.5 pl-2.5' : 'h-[50px] rounded-2xl pr-[7px] pl-2',
        !kindButton && (inline ? 'pl-[18px]' : 'pl-4'),
        picking && 'border-primary',
      )}
    >
      {kindButton &&
        (inline ? <Popover.Trigger asChild>{kindButton}</Popover.Trigger> : kindButton)}
      <div className="relative h-full min-w-0 flex-1">
        {marks && (
          <FieldMarks
            text={title}
            ranges={marks}
            scroll={{ left: scrollLeft, top: 0 }}
            multiline={false}
            className="text-base"
          />
        )}
        <input
          ref={input}
          value={title}
          onChange={(event) => {
            setTitle(event.target.value)
          }}
          onScroll={(event) => {
            setScrollLeft(event.currentTarget.scrollLeft)
          }}
          placeholder={placeholder}
          aria-label={placeholder}
          maxLength={ITEM_TITLE_MAX_LENGTH}
          autoFocus={autoFocus}
          autoComplete="off"
          enterKeyHint="enter"
          className={cn(
            'relative h-full w-full bg-transparent text-base outline-none placeholder:text-subtle-foreground',
            marks && markedFieldClass,
          )}
        />
      </div>
      {/* Añadir sin tener que saber lo de Intro (decisión de Fran): gris hasta que hay texto. */}
      <button
        type="submit"
        aria-label="Añadir"
        disabled={empty}
        onMouseDown={keepFocus}
        className="grid size-9 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground outline-none hover:bg-primary-hover focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:bg-control disabled:text-white"
      >
        <ArrowUp aria-hidden className="size-[18px]" strokeWidth={2.6} />
      </button>
    </form>
  )

  // En móvil encima del campo (A9); en escritorio debajo, con la pista ↩ (D2).
  const pill = <WrittenDatePill state={dated} kind={dateKind} />

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
        <div className="flex flex-col gap-2.5">
          <Popover.Anchor asChild>{field}</Popover.Anchor>
          {dated.understood && (
            <div className="flex items-center gap-3">
              {pill}
              <span className="flex items-center gap-1 text-[13px] text-subtle-foreground">
                <CornerDownLeft aria-hidden className="size-3.5" strokeWidth={2.2} />
                para guardar
              </span>
            </div>
          )}
        </div>
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
      {dated.understood && <div className="mb-2.5 flex">{pill}</div>}
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
