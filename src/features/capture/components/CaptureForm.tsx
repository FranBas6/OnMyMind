import { ChevronLeft, WifiOff, X } from 'lucide-react'
import { useEffect, useRef, useState, type KeyboardEvent } from 'react'

import {
  destinationShortName,
  FieldMarks,
  ITEM_TITLE_MAX_LENGTH,
  linesToSave,
  markedFieldClass,
  PastedLinesBox,
  readsWrittenDates,
  usePastedLines,
  useLinkPreview,
  useWrittenDate,
  WrittenDatePill,
  proposedKind,
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
 * enlace se corta en el límite del título, como antes con `maxLength`.
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
   * se entendió de ella.
   */
  onSave: (
    title: string,
    destination: Destination,
    link: NewItemLink | undefined,
    written: WrittenDate | null,
  ) => void
  /** Pegar varias líneas (4.3): una cosa por cada una, en orden. */
  onSaveMany: (lines: LineToSave[], destination: Destination) => void
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
    product && !touched && chosen && proposedKind(chosen.list) !== 'shopping'
      ? shoppingDestination(destinations)
      : undefined
  const target = proposed ?? chosen
  const asShopping = product && target !== undefined && proposedKind(target.list) === 'shopping'
  const chips = destinationChips(destinations, {
    chosenId: target?.id,
    originId: origin?.id,
    defaultId: defaultListId,
    proposedId: proposed?.id,
  })
  const kind = target ? proposedKind(target.list) : null
  // Fechas escritas (3.5, diseño 21): solo si se guarda una tarea o un evento, y sin enlace. Con
  // «En mente» o una lista de compras elegida no hay marca ni pastilla (A6).
  const dateKind = !link && kind && readsWrittenDates(kind) ? kind : null
  const dated = useWrittenDate(text, dateKind)
  const marks = dated.understood && !dated.undone ? dated.understood.parsed.ranges : null
  const [scrollTop, setScrollTop] = useState(0)
  const title = link ? captureTitle(link, preview.metadata) : dated.toSave.title

  const save = () => {
    if (lines.pasted) {
      if (lines.count > 0 && target && kind) {
        onSaveMany(linesToSave(lines.pasted.rows, kind), target)
      }
      return
    }
    if (!title || !target || !kind) return
    onSave(
      title,
      target,
      link ? capturedLink(link, preview, kind) : undefined,
      dated.toSave.written,
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
    setText(nextLink ? next : next.slice(0, ITEM_TITLE_MAX_LENGTH))
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

  const waiting = link !== null && preview.state === 'searching'
  const saveKeys = `${shortcutKey()}↩ para guardar`
  const hint = !online ? (
    <span className="flex items-center gap-1.5">
      <WifiOff aria-hidden className="size-3.5" strokeWidth={2.2} />
      Sin conexión · se guarda igual
    </span>
  ) : dialog ? (
    waiting ? (
      `Puedes guardar ya · ${saveKeys}`
    ) : (
      saveKeys
    )
  ) : waiting ? (
    'Puedes guardar ya'
  ) : null

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

  const saveLabel = lines.pasted ? `Añadir ${String(lines.count)}` : 'Guardar'
  const canSave = lines.pasted ? lines.count > 0 : Boolean(title)

  return (
    <div className="flex flex-col gap-3.5 md:gap-4" onKeyDown={onListKeyDown}>
      {dialog ? (
        <div className="flex items-center justify-between gap-3 text-xs text-subtle-foreground">
          <span className="flex items-center gap-2">
            <InboxMark className="size-3.5" />
            Captura rápida{origin ? ` · desde ${destinationShortName(origin)}` : ''}
          </span>
          <span className="flex items-center gap-2">
            {/* La pista va aquí y no junto a «Guardar»: allí le quitaba sitio al cuarto chip. */}
            {hint && <span className="mr-1.5 text-xs text-subtle-foreground">{hint}</span>}
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

      {lines.pasted ? (
        <PastedLinesBox
          rows={lines.pasted.rows}
          overflow={lines.pasted.overflow}
          kind={kind}
          onToggleRemoved={lines.toggleRemoved}
          onToggleDate={lines.toggleDate}
          onSingle={() => {
            const pastedText = lines.pasted?.text ?? ''
            lines.clear()
            changeText(pastedText)
            requestAnimationFrame(() => field.current?.focus())
          }}
        />
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

      <div
        className={cn(
          'flex items-center gap-2',
          dialog && 'justify-between gap-4 border-t border-border-soft pt-4',
        )}
      >
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
        {dialog && <SaveButton label={saveLabel} disabled={!canSave} onClick={save} compact />}
      </div>

      {!dialog && (
        <div className="flex items-center justify-between gap-3 pb-3.5">
          <span className="text-[13px] text-subtle-foreground">{hint}</span>
          <SaveButton label={saveLabel} disabled={!canSave} onClick={save} />
        </div>
      )}
    </div>
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
