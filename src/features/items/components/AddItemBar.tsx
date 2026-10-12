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

import { withBullets } from '../bullets'
import {
  CHOOSABLE_KINDS,
  KIND_LABELS,
  parseKindPrefix,
  proposalHint,
  type AddableKind,
  type ChoosableKind,
  type ProposalReason,
} from '../kind'
import { usePastedLines } from '../hooks/usePastedLines'
import { useWrittenDate } from '../hooks/useWrittenDate'
import { splitNoteText } from '../noteText'
import { linesToSave, pastedAsOneHeading, type LineToSave } from '../pastedLines'
import { ITEM_TITLE_MAX_LENGTH, itemTitleSchema } from '../schemas'
import { readsWrittenDates, type WrittenDate } from '../writtenDate'
import { FieldMarks, markedFieldClass } from './FieldMarks'
import { KindOptions } from './KindOptions'
import { KIND_ICONS } from './kindIcons'
import { PastedLinesBox, PastedNoteBox } from './PastedLinesBox'
import { WrittenDatePill } from './WrittenDatePill'

interface AddItemBarProps {
  placeholder: string
  /**
   * `kind` es el tipo elegido o, si no se ha tocado nada, el que propone la lista. Con una fecha
   * escrita en una tarea o un evento (3.5), `written` es lo que se entendió de ella. `notes`, lo
   * que sigue a la primera línea de lo pegado en una sola cosa (diseño 25, B4).
   */
  onAdd: (
    title: string,
    kind: AddableKind | undefined,
    written: WrittenDate | null,
    notes?: string | null,
  ) => void
  /** Pegar varias líneas (4.3, diseño 23, B4–B6): una cosa por cada una, en orden. */
  onAddMany: (lines: LineToSave[], kind: AddableKind | undefined) => void
  /**
   * `docked`: móvil, pegado encima de la barra de navegación y siempre visible (pantalla 4).
   * `inline`: escritorio, un campo de 56 px arriba de la lista con la pista ↩ (D1).
   */
  variant: 'docked' | 'inline'
  /** En una lista recién creada el campo ya está enfocado (diseño 05, E7 y D4). */
  autoFocus?: boolean
  /** El tipo que propone la lista y por qué (`kindProposal`), para el selector de tipo. */
  kinds?: {
    proposal: { kind: ChoosableKind; reason: ProposalReason }
    listName: string
    /** «Sublista» al final del selector y el prefijo «/ » (no dentro de una sublista). */
    sublists?: boolean
  }
  /** Para empezar con un tipo desde fuera: «Nueva sublista» del menú de la lista (diseño 12, S7). */
  handle?: Ref<AddItemBarHandle>
}

export interface AddItemBarHandle {
  /** Pone el tipo y enfoca el campo. */
  startWith: (kind: AddableKind) => void
}

// Que tocar el tipo o «Añadir» no le quite el foco al campo: en iOS eso cerraría el teclado.
const keepFocus = (event: MouseEvent) => {
  event.preventDefault()
}

/**
 * Campo para añadir ítems. Al enviar limpia el texto y conserva el foco, para encadenar varios
 * seguidos sin que se cierre el teclado. Se añade con el botón redondo ↑ de la derecha (gris hasta
 * que hay texto) o con Intro.
 *
 * **El tipo** (diseño 25, B5 y D3) va a la izquierda del campo: en móvil, un botón de 44 × 52 con su
 * icono (la hoja, el círculo de la tarea, el cuadrado de la compra o el calendario); en escritorio,
 * la pastilla «○ Tarea ▾». Empieza en el que propone la lista (el que más tiene; vacía, Nota) y se
 * cambia con un toque: una hoja «Tipo» en móvil y un popover con los prefijos en escritorio. Si se
 * elige otro, se resalta hasta guardar. En escritorio, además, los prefijos «[ ] » (tarea), «> »
 * (compra), «@ » (evento) y «/ » (sublista); la nota no tiene. El texto va a 16 px en móvil: por
 * debajo, Safari en iOS amplía la página al enfocar.
 *
 * **Pegar varias líneas** con el campo vacío (4.3, diseño 23, B4 y B5) las enseña en su caja, una
 * cosa por línea: encima del campo en móvil, debajo en escritorio. El botón dice «Añadir 4». «Como
 * una sola» deja el texto en el campo, con los saltos de línea como espacios. Si lo que se crea es
 * una nota (diseño 25, B4), se ofrece entero en una («Una nota con 7 líneas»), con «Una cosa por
 * línea» para partirlo.
 */
export function AddItemBar({
  placeholder,
  onAdd,
  onAddMany,
  variant,
  autoFocus = false,
  kinds,
  handle,
}: AddItemBarProps) {
  const [title, setTitle] = useState('')
  const [chosen, setChosen] = useState<AddableKind | null>(null)
  const [picking, setPicking] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  const lines = usePastedLines()
  const inline = variant === 'inline'
  const offered: readonly AddableKind[] = kinds?.sublists
    ? [...CHOOSABLE_KINDS, 'sublist']
    : CHOOSABLE_KINDS
  const proposed = kinds?.proposal.kind

  useImperativeHandle(handle, () => ({
    startWith: (kind) => {
      setChosen(kind)
      input.current?.focus()
    },
  }))

  const parsed = kinds && inline ? parseKindPrefix(title) : null
  const prefixed = parsed && offered.includes(parsed.kind) ? parsed : null
  const kind = kinds ? (prefixed?.kind ?? chosen ?? proposed) : undefined
  const changed = kind !== undefined && kind !== proposed

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

  const restart = () => {
    setChosen(null)
    input.current?.focus()
  }

  const submit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (lines.pasted?.single) {
      const split = splitNoteText(withBullets(lines.pasted.text))
      if (!split) return
      onAdd(split.title, kind, null, split.notes)
      lines.clear()
      restart()
      return
    }
    if (lines.pasted) {
      if (lines.count === 0) return
      onAddMany(linesToSave(lines.pasted.rows, kind ?? null), kind)
      lines.clear()
      restart()
      return
    }
    const parsed = itemTitleSchema.safeParse(dated.toSave.title)
    if (!parsed.success) return
    onAdd(parsed.data, kind, dated.toSave.written)
    setTitle('')
    dated.reset()
    restart()
  }

  const choose = (next: AddableKind) => {
    setChosen(next)
    setPicking(false)
    input.current?.focus()
  }

  const empty = lines.pasted ? !lines.pasted.single && lines.count === 0 : title.trim() === ''
  const addLabel = lines.pasted
    ? lines.pasted.single
      ? 'Añadir'
      : `Añadir ${String(lines.count)}`
    : null

  const KindIcon = kind ? KIND_ICONS[kind] : null
  const kindIcon = KindIcon && kind && (
    <KindIcon
      aria-hidden
      className={kind === 'sublist' ? 'size-4' : 'size-[18px]'}
      strokeWidth={kind === 'sublist' ? 3 : 2.2}
    />
  )
  const kindButton = kinds && kind && (
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
        'flex shrink-0 items-center justify-center outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50',
        inline
          ? 'h-14 gap-2 rounded-[18px] pr-3 pl-3.5 text-sm font-semibold'
          : 'h-[52px] w-11 rounded-[14px]',
        changed
          ? 'bg-brand-tint text-primary-strong'
          : 'bg-fill text-muted-foreground hover:text-foreground',
        picking && 'ring-[1.5px] ring-primary',
      )}
    >
      {kindIcon}
      {inline && (
        <>
          <span className={changed ? undefined : 'text-foreground'}>{KIND_LABELS[kind]}</span>
          <ChevronDown aria-hidden className="size-3.5 opacity-70" strokeWidth={2.4} />
        </>
      )}
    </button>
  )

  const field = (
    <form
      onSubmit={submit}
      className={cn(
        'flex min-w-0 flex-1 items-center gap-2 border bg-card focus-within:border-primary focus-within:shadow-[0_0_0_0.5px_var(--primary)] hover:border-control',
        inline
          ? 'h-14 rounded-[18px] border-border pr-2.5 pl-[18px]'
          : 'h-[52px] rounded-2xl border-[1.5px] border-border pr-[7px] pl-4',
      )}
    >
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
          readOnly={lines.pasted !== null}
          onChange={(event) => {
            setTitle(event.target.value)
          }}
          onPaste={(event) => {
            // Una lista pegada en el campo vacío se ofrece una cosa por línea (4.3) o, si se crea
            // una nota, entera en una (diseño 25, B4).
            const text = event.clipboardData.getData('text')
            if (title.trim() === '' && lines.offer(text, kind === 'note')) {
              event.preventDefault()
            }
          }}
          onScroll={(event) => {
            setScrollLeft(event.currentTarget.scrollLeft)
          }}
          placeholder={
            lines.pasted
              ? lines.pasted.single
                ? pastedAsOneHeading(lines.pasted.text, kind ?? null)
                : `${String(lines.count)} líneas pegadas`
              : placeholder
          }
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
        aria-label={addLabel ? undefined : 'Añadir'}
        disabled={empty}
        onMouseDown={keepFocus}
        className={cn(
          'grid shrink-0 place-items-center rounded-full bg-primary text-primary-foreground outline-none hover:bg-primary-hover focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:bg-control disabled:text-white',
          addLabel
            ? 'flex h-9 items-center gap-1.5 px-3.5 font-display text-sm font-bold'
            : 'size-9',
        )}
      >
        <ArrowUp aria-hidden className="size-[18px]" strokeWidth={2.6} />
        {addLabel}
      </button>
    </form>
  )

  // En móvil encima del campo (A9); en escritorio debajo, con la pista ↩ (D2).
  const pill = <WrittenDatePill state={dated} kind={dateKind} />

  const box =
    lines.pasted &&
    (lines.pasted.single ? (
      <PastedNoteBox
        text={lines.pasted.text}
        kind={kind ?? null}
        onSplit={() => {
          lines.setSingle(false)
        }}
        className={inline ? undefined : 'mb-2.5'}
      />
    ) : (
      <PastedLinesBox
        rows={lines.pasted.rows}
        overflow={lines.pasted.overflow}
        kind={kind ?? null}
        onToggleRemoved={lines.toggleRemoved}
        onToggleDate={lines.toggleDate}
        onSingle={() => {
          // Si se crea una nota, vuelve a la nota con todo; si no, el texto pasa al campo.
          if (kind === 'note') {
            lines.setSingle(true)
            return
          }
          const text = lines.pasted?.text ?? ''
          lines.clear()
          setTitle(
            text
              .replace(/\s*[\r\n]+\s*/g, ' ')
              .trim()
              .slice(0, ITEM_TITLE_MAX_LENGTH),
          )
          input.current?.focus()
        }}
        className={inline ? undefined : 'mb-2.5'}
      />
    ))

  if (!kinds || !kind) {
    if (inline) {
      return (
        <div className="flex flex-col gap-2.5">
          {field}
          {box}
        </div>
      )
    }
    return (
      <Docked>
        {box}
        {field}
      </Docked>
    )
  }

  const hint = proposalHint(kinds.proposal)

  if (inline) {
    return (
      <Popover.Root open={picking} onOpenChange={setPicking}>
        <div className="flex flex-col gap-2.5">
          <Popover.Anchor asChild>
            <div className="flex items-center gap-2">
              <Popover.Trigger asChild>{kindButton}</Popover.Trigger>
              {field}
            </div>
          </Popover.Anchor>
          {box}
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
            aria-label="Tipo"
            onOpenAutoFocus={(event) => {
              event.preventDefault()
            }}
            className="z-50 flex w-[340px] flex-col gap-0.5 rounded-2xl border border-border bg-popover p-1.5 text-popover-foreground shadow-popover outline-none"
          >
            <KindOptions<AddableKind>
              label="Tipo"
              value={kind}
              kinds={offered}
              compact
              prefixes
              onChange={choose}
            />
            <p className="px-2.5 pt-2 pb-1.5 text-xs leading-normal text-subtle-foreground">
              {hint}
            </p>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    )
  }

  return (
    <Docked>
      {box}
      {dated.understood && <div className="mb-2.5 flex">{pill}</div>}
      <div className="flex items-center gap-2">
        {kindButton}
        {field}
      </div>
      <BottomSheet open={picking} onOpenChange={setPicking} title="Tipo" className="gap-1.5">
        <div className="flex h-11 items-center justify-between px-1">
          <p className="font-display text-xl font-extrabold tracking-[-0.02em]">Tipo</p>
          <button
            type="button"
            onClick={() => {
              setPicking(false)
            }}
            className="rounded-md text-[15px] font-bold text-primary outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            Listo
          </button>
        </div>
        <KindOptions<AddableKind> label="Tipo" value={kind} kinds={offered} onChange={choose} />
        <p className="mt-1.5 rounded-[14px] bg-fill px-3.5 py-3 text-sm leading-[1.45]">
          {hint} Lo que elijas vale solo para lo que escribas ahora.
        </p>
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
