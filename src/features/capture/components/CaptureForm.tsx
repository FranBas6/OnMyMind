import { ChevronDown, ChevronLeft, WifiOff, X } from 'lucide-react'
import { Popover } from 'radix-ui'
import { useEffect, useRef, useState, type ClipboardEvent, type KeyboardEvent } from 'react'

import {
  destinationShortName,
  FieldMarks,
  ITEM_NOTES_MAX_LENGTH,
  ITEM_TITLE_MAX_LENGTH,
  joinNoteDraft,
  KIND_ICONS,
  KIND_LABELS,
  KindOptions,
  kindProposal,
  linesToSave,
  markedFieldClass,
  NoteEditor,
  noteDraftOf,
  PastedLinesBox,
  PastedNoteBox,
  proposalHint,
  readsWrittenDates,
  splitNoteText,
  usePastedLines,
  useLinkPreview,
  useWrittenDate,
  withBullets,
  WrittenDatePill,
  type ChoosableKind,
  type Destination,
  type LineToSave,
  type NewItemLink,
  type WrittenDate,
} from '@/features/items'
import { useOnline } from '@/hooks/useOnline'
import { cn } from '@/lib/utils'
import { shortcutKey } from '@/lib/device'

import { defaultDestination, destinationChips, shoppingDestination } from '../destinations'
import { captureLink, capturedLink, captureTitle } from '../links'
import { DestinationChip, InboxMark, MoreButton } from './DestinationChip'
import { AllListsPopover, SaveInSheet } from './AllLists'
import { UrlCapturePreview } from './UrlCapturePreview'

/** La letra del campo; la copia con las marcas de la fecha escrita lleva la misma (3.5). */
const FIELD_TYPE = 'font-display leading-[1.3] font-bold tracking-[-0.02em]'
/** A partir de aquí el texto baja de 26 a 22 px (diseño 07, C3). */
const LONG_TEXT = 48
/**
 * El campo admite enlaces largos (los de las tiendas llevan de todo detrás); lo que no es un
 * enlace se corta en el límite del título, como antes con `maxLength`; una nota, en el de su
 * primera línea y el resto.
 */
const FIELD_MAX_LENGTH = 4000
/** Escribiendo un enlace a mano, se mira la página cuando se deja de teclear; pegado, al momento. */
const LOOKUP_DELAY_MS = 500

interface CaptureFormProps {
  variant: 'sheet' | 'dialog'
  /** Listas y sublistas (`destinationsOf`), en su orden. */
  destinations: readonly Destination[]
  initialText: string
  /** La lista o sublista en la que se abrió (sale elegida y con «Desde Lisboa»). */
  origin: Destination | undefined
  /** La lista por defecto de Perfil: sale elegida si no se abre desde una lista. */
  defaultListId: string | null
  /**
   * Con un enlace (2.3), también lo que se sabe de su página; con una fecha escrita (3.5), lo que
   * se entendió de ella. `kind`, el tipo con el que se guarda (5.4); `notes`, lo que sigue a la
   * primera línea.
   */
  onSave: (
    title: string,
    destination: Destination,
    link: NewItemLink | undefined,
    written: WrittenDate | null,
    kind: ChoosableKind,
    notes: string | null,
  ) => void
  /** Pegar varias líneas (4.3): una cosa por cada una, en orden. */
  onSaveMany: (lines: LineToSave[], destination: Destination, kind: ChoosableKind) => void
  onClose: () => void
}

/**
 * Lo común a la hoja de móvil y al flotante de escritorio (pantalla 3 y diseño 07): el texto
 * grande, «Guardar en» con chips y «···», la pista del atajo (o «Sin conexión · se guarda
 * igual») y «Guardar», en gris hasta que hay texto. En móvil, Intro guarda (la tecla del teclado
 * lo dice); en escritorio, ⌘↩ guarda e Intro salta de línea.
 *
 * **Modo enlace (2.3, pantalla 9 y diseño 16, K1–K5):** si lo escrito lleva un enlace, debajo sale
 * su tarjeta. Si la página tiene precio, se propone la lista de compras más usada y lo dice una
 * frase («Parece un producto. Lo guardo en **Compras** como compra.»), salvo que ya se haya
 * elegido un destino a mano. Se puede guardar sin esperar a la página. El portapapeles solo se lee
 * cuando se pega: leerlo al abrir haría salir el globo de permiso de iOS cada vez.
 *
 * **Varias líneas (4.3, diseño 23, B1–B3, B7 y E3):** pegar una lista con el campo vacío la enseña
 * en su caja, una cosa por línea, en lugar del campo; «Guardar» pasa a «Añadir 7». «Como una sola»
 * vuelve al campo con el texto tal cual. Con algo ya escrito, se pega como siempre.
 *
 * **El tipo (5.4, diseño 25, B3, B4 y D4):** abajo a la izquierda, la pastilla «Nota ▾» con el que
 * propone la lista elegida («En mente», nota), que se cambia con un toque. Una nota se escribe
 * como en su ficha (`NoteEditor`): la primera línea en grande, el resto debajo con viñetas, e Intro
 * hace otra línea; se guarda con «Guardar» o ⌘↩. Lo demás guarda con Intro en el móvil, como
 * siempre. Pegar varias líneas en una nota la deja entera («Una nota con 7 líneas»), con «Una cosa
 * por línea» para partirla.
 */
export function CaptureForm({
  variant,
  destinations,
  initialText,
  origin,
  defaultListId,
  onSave,
  onSaveMany,
  onClose,
}: CaptureFormProps) {
  const [text, setText] = useState(initialText)
  const [chosenId, setChosenId] = useState(
    () => defaultDestination(destinations, origin?.id, defaultListId)?.id,
  )
  // Elegido a mano: la propuesta de un producto ya no lo cambia.
  const [touched, setTouched] = useState(false)
  const [picking, setPicking] = useState(false)
  // El tipo elegido con la pastilla; sin él, el que propone la lista elegida.
  const [chosenKind, setChosenKind] = useState<ChoosableKind | null>(null)
  const [pickingKind, setPickingKind] = useState(false)
  const field = useRef<HTMLTextAreaElement>(null)
  const lines = usePastedLines()
  const online = useOnline()
  const dialog = variant === 'dialog'

  const link = captureLink(text)
  const [lookupUrl, setLookupUrl] = useState(() => captureLink(initialText)?.url ?? null)
  const pasting = useRef(false)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  useEffect(
    () => () => {
      clearTimeout(timer.current)
    },
    [],
  )
  const preview = useLinkPreview(link?.url === lookupUrl ? lookupUrl : null)

  const chosen =
    destinations.find((destination) => destination.id === chosenId) ??
    defaultDestination(destinations, origin?.id, defaultListId)
  // Un producto va a la lista de compras más usada, si no se ha elegido otra cosa (K1).
  const product = link !== null && Boolean(preview.metadata?.price)
  const proposed =
    product && !touched && chosen && kindProposal(chosen.list).kind !== 'shopping'
      ? shoppingDestination(destinations)
      : undefined
  const target = proposed ?? chosen
  const proposal = target ? kindProposal(target.list) : null
  const kind = chosenKind ?? proposal?.kind ?? null
  // Una nota se escribe en su editor. Con un enlace, la captura sigue en «modo enlace» (2.3): se
  // guarda con su página, también si es una nota.
  const noteMode = kind === 'note' && !link
  const asShopping = product && !noteMode && target !== undefined && kind === 'shopping'
  const chips = destinationChips(destinations, {
    chosenId: target?.id,
    originId: origin?.id,
    defaultId: defaultListId,
    proposedId: proposed?.id,
  })
  // Fechas escritas (3.5, diseño 21): solo si se guarda una tarea o un evento, y sin enlace. Con
  // una nota o una compra no hay marca ni pastilla (A6).
  const dateKind = !link && kind && readsWrittenDates(kind) ? kind : null
  const dated = useWrittenDate(text, dateKind)
  const marks = dated.understood && !dated.undone ? dated.understood.parsed.ranges : null
  const [scrollTop, setScrollTop] = useState(0)
  // Lo escrito se guarda partido: la primera línea de título y el resto en las notas (5.4).
  const note = link ? null : splitNoteText(noteMode ? withBullets(text) : dated.toSave.title)
  const title = link ? captureTitle(link, preview.metadata) : (note?.title ?? '')

  const save = () => {
    if (!target || !kind) return
    if (lines.pasted?.single) {
      const pastedNote = splitNoteText(withBullets(lines.pasted.text))
      if (pastedNote) onSave(pastedNote.title, target, undefined, null, kind, pastedNote.notes)
      return
    }
    if (lines.pasted) {
      if (lines.count > 0) onSaveMany(linesToSave(lines.pasted.rows, kind), target, kind)
      return
    }
    if (!title) return
    onSave(
      title,
      target,
      link ? capturedLink(link, preview, kind) : undefined,
      dated.toSave.written,
      kind,
      note?.notes ?? null,
    )
  }

  const pick = (destination: Destination) => {
    setChosenId(destination.id)
    setTouched(true)
  }
  const choose = (destination: Destination) => {
    pick(destination)
    setPicking(false)
    field.current?.focus()
  }

  const changeText = (next: string) => {
    const nextLink = captureLink(next)
    // Una nota: su primera línea y el resto. Se calcula aquí: al cargar el módulo, lo de
    // `@/features/items` aún puede no estar (las importaciones de la app dan la vuelta).
    const max = noteMode ? ITEM_TITLE_MAX_LENGTH + 1 + ITEM_NOTES_MAX_LENGTH : ITEM_TITLE_MAX_LENGTH
    setText(nextLink ? next : next.slice(0, max))
    clearTimeout(timer.current)
    const url = nextLink?.url ?? null
    if (pasting.current || url === null) setLookupUrl(url)
    else
      timer.current = setTimeout(() => {
        setLookupUrl(url)
      }, LOOKUP_DELAY_MS)
    pasting.current = false
  }

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== 'Enter' || event.nativeEvent.isComposing) return
    if (event.metaKey || event.ctrlKey || (!dialog && !event.shiftKey)) {
      event.preventDefault()
      save()
    }
  }
  // En una nota, Intro hace otra línea también en el móvil: guarda ⌘↩ (o «Guardar»).
  const onNoteKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== 'Enter' || event.nativeEvent.isComposing) return
    if (event.metaKey || event.ctrlKey) {
      event.preventDefault()
      save()
    }
  }
  const onNotePaste = (event: ClipboardEvent<HTMLTextAreaElement>) => {
    // Varias líneas en una nota vacía: entera, con «Una cosa por línea» (diseño 25, B4).
    if (text.trim() === '' && lines.offer(event.clipboardData.getData('text'), true)) {
      event.preventDefault()
      return
    }
    pasting.current = true
  }

  const waiting = link !== null && preview.state === 'searching'
  const saveKeys = noteMode
    ? `↩ otra línea · ${shortcutKey()}↩ guardar`
    : `${shortcutKey()}↩ para guardar`
  const hint = !online ? (
    <span className="flex items-center gap-1.5">
      <WifiOff aria-hidden className="size-3.5" strokeWidth={2.2} />
      Sin conexión · se guarda igual
    </span>
  ) : waiting ? (
    dialog ? (
      `Puedes guardar ya · ${saveKeys}`
    ) : (
      'Puedes guardar ya'
    )
  ) : lines.pasted ? null : dialog ? (
    saveKeys
  ) : noteMode ? (
    'Intro, otra línea'
  ) : (
    'Intro guarda'
  )

  const chooseKind = (next: ChoosableKind) => {
    setChosenKind(next)
    setPickingKind(false)
  }
  // El tipo, con la pastilla de abajo a la izquierda (diseño 25, B3 y D4).
  const kindPill = kind && (
    <KindPill
      kind={kind}
      changed={chosenKind !== null && chosenKind !== proposal?.kind}
      open={pickingKind}
      onClick={() => {
        field.current?.blur()
        setPickingKind((open) => !open)
      }}
    />
  )

  // Móvil: la pastilla cambia la captura por «Tipo», en la misma hoja, como «Guardar en».
  if (!dialog && pickingKind && kind && proposal) {
    return (
      <div className="flex flex-col gap-1.5 pb-[calc(env(safe-area-inset-bottom)+1rem)]">
        <div className="flex h-11 items-center justify-between px-1">
          <p className="font-display text-xl font-extrabold tracking-[-0.02em]">Tipo</p>
          <button
            type="button"
            onClick={() => {
              setPickingKind(false)
            }}
            className="h-9 rounded-lg px-1 text-[15px] font-bold text-primary outline-none hover:text-primary-hover focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            Listo
          </button>
        </div>
        <KindOptions<ChoosableKind> label="Tipo" value={kind} onChange={chooseKind} />
        <p className="mt-1.5 rounded-[14px] bg-fill px-3.5 py-3 text-sm leading-[1.45]">
          {proposalHint(proposal)} Lo que elijas vale solo para lo que escribas ahora.
        </p>
      </div>
    )
  }

  // Móvil: «···» cambia la captura por «Guardar en» en la misma hoja (diseño 12, A3). El texto
  // escrito se queda: el formulario vuelve con él al elegir o con «Listo».
  if (!dialog && picking) {
    return (
      <SaveInSheet
        destinations={destinations}
        chosenId={target?.id}
        onChoose={choose}
        onDone={() => {
          setPicking(false)
          field.current?.focus()
        }}
      />
    )
  }

  // Con la lista pegada no hay campo: ⌘↩ (o Ctrl↩) guarda desde cualquier sitio de la captura.
  const onListKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!lines.pasted || event.key !== 'Enter' || !(event.metaKey || event.ctrlKey)) return
    event.preventDefault()
    save()
  }

  const saveLabel =
    lines.pasted && !lines.pasted.single ? `Añadir ${String(lines.count)}` : 'Guardar'
  const canSave = lines.pasted ? lines.pasted.single || lines.count > 0 : Boolean(title)

  return (
    <div className="flex flex-col gap-3.5 md:gap-4" onKeyDown={onListKeyDown}>
      {dialog ? (
        <div className="flex items-center justify-between gap-3 text-xs text-subtle-foreground">
          <span className="flex items-center gap-2">
            <InboxMark className="size-3.5" />
            Captura rápida{origin ? ` · desde ${destinationShortName(origin)}` : ''}
          </span>
          <span className="flex items-center gap-2">
            <kbd className="rounded-[5px] bg-fill px-1.5 py-0.5 font-sans text-[11px] text-muted-foreground">
              Esc
            </kbd>
            <button
              type="button"
              aria-label="Cerrar"
              onClick={onClose}
              className="grid size-7 place-items-center rounded-lg bg-fill text-muted-foreground outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"
            >
              <X aria-hidden className="size-4" strokeWidth={2.2} />
            </button>
          </span>
        </div>
      ) : (
        origin && (
          <p className="-mb-1.5 flex items-center gap-1 text-xs text-subtle-foreground">
            <ChevronLeft aria-hidden className="size-3.5" strokeWidth={2.2} />
            Desde {destinationShortName(origin)}
          </p>
        )
      )}

      {lines.pasted?.single ? (
        <PastedNoteBox
          text={lines.pasted.text}
          kind={kind}
          onSplit={() => {
            lines.setSingle(false)
          }}
        />
      ) : lines.pasted ? (
        <PastedLinesBox
          rows={lines.pasted.rows}
          overflow={lines.pasted.overflow}
          kind={kind}
          onToggleRemoved={lines.toggleRemoved}
          onToggleDate={lines.toggleDate}
          onSingle={() => {
            // En una nota, vuelve a la nota con todo; si no, el texto pasa al campo tal cual.
            if (kind === 'note') {
              lines.setSingle(true)
              return
            }
            const pastedText = lines.pasted?.text ?? ''
            lines.clear()
            changeText(pastedText)
            requestAnimationFrame(() => field.current?.focus())
          }}
        />
      ) : noteMode ? (
        <div className="max-h-[42dvh] overflow-y-auto overscroll-contain md:max-h-[50dvh]">
          <NoteEditor
            value={noteDraftOf(text)}
            onChange={(next) => {
              changeText(joinNoteDraft(next))
            }}
            onPaste={onNotePaste}
            onKeyDown={onNoteKeyDown}
            placeholder="¿Qué tienes en mente?"
            label="¿Qué tienes en mente?"
            autoFocus
            titleClassName={cn(
              FIELD_TYPE,
              'placeholder:text-placeholder',
              text.length > LONG_TEXT ? 'text-[22px]' : 'text-[26px]',
            )}
            bodyClassName="mt-1 text-base leading-normal"
          />
        </div>
      ) : (
        <>
          <div className="relative">
            {marks && (
              <FieldMarks
                text={text}
                ranges={marks}
                scroll={{ left: 0, top: scrollTop }}
                multiline
                className={cn(FIELD_TYPE, text.length > LONG_TEXT ? 'text-[22px]' : 'text-[26px]')}
              />
            )}
            <textarea
              ref={(element) => {
                field.current = element
                grow(element)
              }}
              autoFocus
              data-vaul-no-drag
              aria-label="¿Qué tienes en mente?"
              placeholder="¿Qué tienes en mente?"
              rows={link?.onlyLink ? 1 : 2}
              value={text}
              maxLength={FIELD_MAX_LENGTH}
              enterKeyHint={dialog ? 'enter' : 'done'}
              onPaste={(event) => {
                // Una lista pegada en el campo vacío se ofrece una cosa por línea (4.3).
                if (text.trim() === '' && lines.offer(event.clipboardData.getData('text'))) {
                  event.preventDefault()
                  return
                }
                pasting.current = true
              }}
              onChange={(event) => {
                changeText(event.target.value)
                grow(event.currentTarget)
              }}
              onFocus={() => {
                setPicking(false)
              }}
              onKeyDown={onKeyDown}
              onScroll={(event) => {
                setScrollTop(event.currentTarget.scrollTop)
              }}
              className={cn(
                'relative block max-h-[calc(4*1.3em)] w-full resize-none bg-transparent outline-none placeholder:text-placeholder',
                FIELD_TYPE,
                marks && markedFieldClass,
                // Solo el enlace: en índigo, más pequeño y partido por cualquier sitio (K1); en una
                // línea si cabe, que debajo ya va su tarjeta.
                link?.onlyLink
                  ? 'min-h-[1.35em] text-[19px] leading-[1.35] tracking-[-0.01em] break-all text-primary'
                  : [
                      'min-h-[calc(2*1.3em)]',
                      text.length > LONG_TEXT ? 'text-[22px]' : 'text-[26px]',
                    ],
              )}
            />
          </div>

          {/* Lo que se entendió de la fecha, bajo el texto (diseño 21, A1–A5 y D1). */}
          <WrittenDatePill state={dated} kind={dateKind} />

          {link && (
            <UrlCapturePreview url={link.url} state={preview.state} metadata={preview.metadata} />
          )}
          {asShopping && (
            // Una sola frase con la lista en negrita: la pantalla 9 la rompía en columnas.
            <p className="rounded-[14px] bg-brand-tint px-3.5 py-3 text-sm leading-[1.45] text-primary-strong">
              Parece un producto. Lo guardo en <b>{destinationShortName(target)}</b> como compra.
            </p>
          )}
        </>
      )}

      <div className={cn('flex items-center gap-2', dialog && 'border-t border-border-soft pt-4')}>
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <span className="shrink-0 text-xs font-semibold text-subtle-foreground">Guardar en</span>
          <div
            role="radiogroup"
            aria-label="Guardar en"
            className="flex min-w-0 flex-1 [scrollbar-width:none] gap-2 overflow-x-auto [mask-image:linear-gradient(90deg,black_88%,transparent)]"
          >
            {chips.map((destination) => (
              <DestinationChip
                key={destination.id}
                destination={destination}
                selected={destination.id === target?.id}
                onClick={() => {
                  pick(destination)
                }}
              />
            ))}
          </div>
          {dialog ? (
            <AllListsPopover
              destinations={destinations}
              chosenId={target?.id}
              open={picking}
              onOpenChange={setPicking}
              onChoose={choose}
            />
          ) : (
            <MoreButton
              active={picking}
              onClick={() => {
                // En su sitio sale «Guardar en», con todas las listas y sublistas (A3).
                field.current?.blur()
                setPicking(true)
              }}
            />
          )}
        </div>
      </div>

      <div className={cn('flex items-center justify-between gap-3', !dialog && 'pb-3.5')}>
        {dialog && kind && proposal ? (
          <Popover.Root open={pickingKind} onOpenChange={setPickingKind}>
            <Popover.Trigger asChild>{kindPill}</Popover.Trigger>
            <Popover.Portal>
              <Popover.Content
                align="start"
                side="top"
                sideOffset={6}
                aria-label="Tipo"
                className="z-50 flex w-[300px] flex-col gap-0.5 rounded-2xl border border-border bg-popover p-1.5 text-popover-foreground shadow-popover outline-none"
              >
                <KindOptions<ChoosableKind>
                  label="Tipo"
                  value={kind}
                  compact
                  onChange={chooseKind}
                />
                <p className="px-2.5 pt-2 pb-1.5 text-xs leading-normal text-subtle-foreground">
                  {proposalHint(proposal)}
                </p>
              </Popover.Content>
            </Popover.Portal>
          </Popover.Root>
        ) : (
          kindPill
        )}
        <span
          className={cn(
            'min-w-0 flex-1 text-right leading-[1.3] text-subtle-foreground',
            dialog ? 'text-[13px]' : 'text-[12.5px]',
          )}
        >
          {hint}
        </span>
        <SaveButton label={saveLabel} disabled={!canSave} onClick={save} compact={dialog} />
      </div>
    </div>
  )
}

/** La pastilla del tipo (diseño 25, B3): 40 px, `fill`, su icono, «Nota» y la flechita. */
function KindPill({
  kind,
  changed,
  open,
  ...props
}: {
  kind: ChoosableKind
  changed: boolean
  open: boolean
  onClick?: () => void
}) {
  const Icon = KIND_ICONS[kind]
  return (
    <button
      type="button"
      aria-label={`Tipo: ${KIND_LABELS[kind]}. Cambiar`}
      aria-expanded={open}
      // Que tocarla no cierre el teclado antes de tiempo.
      onMouseDown={(event) => {
        event.preventDefault()
      }}
      className={cn(
        'flex h-10 shrink-0 items-center gap-2 rounded-full px-3 text-[13.5px] font-semibold outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50',
        changed ? 'bg-brand-tint text-primary-strong' : 'bg-fill text-foreground hover:bg-border',
      )}
      {...props}
    >
      <Icon aria-hidden className="size-4" strokeWidth={2.2} />
      {KIND_LABELS[kind]}
      <ChevronDown aria-hidden className="size-3.5 opacity-70" strokeWidth={2.4} />
    </button>
  )
}

/** El campo crece con el texto hasta cuatro líneas; después hace scroll dentro (diseño 07, C3). */
function grow(element: HTMLTextAreaElement | null) {
  if (!element) return
  element.style.height = 'auto'
  element.style.height = `${element.scrollHeight}px`
}

function SaveButton({
  label,
  disabled,
  onClick,
  compact = false,
}: {
  label: string
  disabled: boolean
  onClick: () => void
  compact?: boolean
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      // Que tocar «Guardar» no le quite el foco al campo antes de tiempo (el teclado no parpadea).
      onMouseDown={(event) => {
        event.preventDefault()
      }}
      className={cn(
        'flex items-center gap-2 bg-primary font-display font-bold text-primary-foreground outline-none hover:bg-primary-hover focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:bg-control disabled:text-white',
        compact
          ? 'h-11 rounded-[14px] px-[22px] text-sm'
          : 'h-12 rounded-2xl px-[26px] text-[15px]',
      )}
    >
      {label}
    </button>
  )
}
