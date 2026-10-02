import { ChevronLeft, WifiOff, X } from 'lucide-react'
import { useEffect, useRef, useState, type KeyboardEvent } from 'react'

import {
  destinationShortName,
  ITEM_TITLE_MAX_LENGTH,
  newItemKindAndStatus,
  useLinkPreview,
  type Destination,
  type NewItemLink,
} from '@/features/items'
import { useOnline } from '@/hooks/useOnline'
import { cn } from '@/lib/utils'

import { defaultDestination, destinationChips, shoppingDestination } from '../destinations'
import { captureLink, capturedLink, captureTitle } from '../links'
import { DestinationChip, InboxMark, MoreButton } from './DestinationChip'
import { AllListsPopover, SaveInSheet } from './AllLists'
import { UrlCapturePreview } from './UrlCapturePreview'

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
  /** Con un enlace (2.3), también lo que se sabe de su página. */
  onSave: (title: string, destination: Destination, link: NewItemLink | undefined) => void
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
 */
export function CaptureForm({
  variant,
  destinations,
  initialText,
  origin,
  defaultListId,
  onSave,
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
    product && !touched && chosen?.list.kind !== 'shopping'
      ? shoppingDestination(destinations)
      : undefined
  const target = proposed ?? chosen
  const asShopping = product && target?.list.kind === 'shopping'
  const chips = destinationChips(destinations, {
    chosenId: target?.id,
    originId: origin?.id,
    defaultId: defaultListId,
    proposedId: proposed?.id,
  })
  const title = link ? captureTitle(link, preview.metadata) : text.trim()

  const save = () => {
    if (!title || !target) return
    const kind = newItemKindAndStatus(target.list.kind).kind
    onSave(title, target, link ? capturedLink(link, preview, kind) : undefined)
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
  const hint = !online ? (
    <span className="flex items-center gap-1.5">
      <WifiOff aria-hidden className="size-3.5" strokeWidth={2.2} />
      Sin conexión · se guarda igual
    </span>
  ) : dialog ? (
    waiting ? (
      'Puedes guardar ya · ⌘↩ para guardar'
    ) : (
      '⌘↩ para guardar'
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

  return (
    <div className="flex flex-col gap-3.5 md:gap-4">
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
        onPaste={() => {
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
        className={cn(
          'max-h-[calc(4*1.3em)] w-full resize-none bg-transparent font-display leading-[1.3] font-bold tracking-[-0.02em] outline-none placeholder:text-placeholder',
          // Solo el enlace: en índigo, más pequeño y partido por cualquier sitio (K1); en una
          // línea si cabe, que debajo ya va su tarjeta.
          link?.onlyLink
            ? 'min-h-[1.35em] text-[19px] leading-[1.35] tracking-[-0.01em] break-all text-primary'
            : ['min-h-[calc(2*1.3em)]', text.length > LONG_TEXT ? 'text-[22px]' : 'text-[26px]'],
        )}
      />

      {link && (
        <UrlCapturePreview url={link.url} state={preview.state} metadata={preview.metadata} />
      )}
      {asShopping && (
        // Una sola frase con la lista en negrita: la pantalla 9 la rompía en columnas.
        <p className="rounded-[14px] bg-brand-tint px-3.5 py-3 text-sm leading-[1.45] text-primary-strong">
          Parece un producto. Lo guardo en <b>{destinationShortName(target)}</b> como compra.
        </p>
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
        {dialog && <SaveButton disabled={!title} onClick={save} compact />}
      </div>

      {!dialog && (
        <div className="flex items-center justify-between gap-3 pb-3.5">
          <span className="text-[13px] text-subtle-foreground">{hint}</span>
          <SaveButton disabled={!title} onClick={save} />
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
  disabled,
  onClick,
  compact = false,
}: {
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
      Guardar
    </button>
  )
}
