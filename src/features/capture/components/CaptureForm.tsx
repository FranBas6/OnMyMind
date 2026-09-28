import { ChevronLeft, WifiOff, X } from 'lucide-react'
import { useRef, useState, type KeyboardEvent } from 'react'

import type { List } from '@/features/lists'
import { useOnline } from '@/hooks/useOnline'
import { cn } from '@/lib/utils'

import { defaultDestination, destinationChips } from '../destinations'
import { DestinationChip, InboxMark, MoreButton } from './DestinationChip'
import { AllListsPanel, AllListsPopover } from './AllLists'

/** Límite del título, como el de `items.title`. */
const TITLE_MAX_LENGTH = 300
/** A partir de aquí el texto baja de 26 a 22 px (diseño 07, C3). */
const LONG_TEXT = 48

interface CaptureFormProps {
  variant: 'sheet' | 'dialog'
  lists: readonly List[]
  initialText: string
  /** La lista en la que se abrió (sale elegida y con «Desde Casa»). */
  origin: List | undefined
  /** La lista por defecto de Perfil: sale elegida si no se abre desde una lista. */
  defaultListId: string | null
  onSave: (title: string, list: List) => void
  onClose: () => void
}

/**
 * Lo común a la hoja de móvil y al flotante de escritorio (pantalla 3 y diseño 07): el texto
 * grande, «Guardar en» con chips y «···», la pista del atajo (o «Sin conexión · se guarda
 * igual») y «Guardar», en gris hasta que hay texto. En móvil, Intro guarda (la tecla del teclado
 * lo dice); en escritorio, ⌘↩ guarda e Intro salta de línea.
 */
export function CaptureForm({
  variant,
  lists,
  initialText,
  origin,
  defaultListId,
  onSave,
  onClose,
}: CaptureFormProps) {
  const [text, setText] = useState(initialText)
  const [chosenId, setChosenId] = useState(
    () => defaultDestination(lists, origin?.id, defaultListId)?.id,
  )
  const [picking, setPicking] = useState(false)
  const field = useRef<HTMLTextAreaElement>(null)
  const online = useOnline()
  const dialog = variant === 'dialog'

  const chosen =
    lists.find((list) => list.id === chosenId) ??
    defaultDestination(lists, origin?.id, defaultListId)
  const chips = destinationChips(lists, {
    chosenId: chosen?.id,
    originId: origin?.id,
    defaultId: defaultListId,
  })
  const title = text.trim()

  const save = () => {
    if (!title || !chosen) return
    onSave(title, chosen)
  }

  const choose = (list: List) => {
    setChosenId(list.id)
    setPicking(false)
    field.current?.focus()
  }

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== 'Enter' || event.nativeEvent.isComposing) return
    if (event.metaKey || event.ctrlKey || (!dialog && !event.shiftKey)) {
      event.preventDefault()
      save()
    }
  }

  const hint = !online ? (
    <span className="flex items-center gap-1.5">
      <WifiOff aria-hidden className="size-3.5" strokeWidth={2.2} />
      Sin conexión · se guarda igual
    </span>
  ) : dialog ? (
    '⌘↩ para guardar'
  ) : null

  return (
    <div className="flex flex-col gap-3.5 md:gap-4">
      {dialog ? (
        <div className="flex items-center justify-between gap-3 text-xs text-subtle-foreground">
          <span className="flex items-center gap-2">
            <InboxMark className="size-3.5" />
            Captura rápida{origin ? ` · desde ${origin.name}` : ''}
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
            Desde {origin.name}
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
        rows={2}
        value={text}
        maxLength={TITLE_MAX_LENGTH}
        enterKeyHint={dialog ? 'enter' : 'done'}
        onChange={(event) => {
          setText(event.target.value)
          grow(event.currentTarget)
        }}
        onFocus={() => {
          setPicking(false)
        }}
        onKeyDown={onKeyDown}
        className={cn(
          'max-h-[calc(4*1.3em)] min-h-[calc(2*1.3em)] w-full resize-none bg-transparent font-display leading-[1.3] font-bold tracking-[-0.02em] outline-none placeholder:text-placeholder',
          text.length > LONG_TEXT ? 'text-[22px]' : 'text-[26px]',
        )}
      />

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
            {chips.map((list) => (
              <DestinationChip
                key={list.id}
                list={list}
                selected={list.id === chosen?.id}
                onClick={() => {
                  setChosenId(list.id)
                }}
              />
            ))}
          </div>
          {dialog ? (
            <AllListsPopover
              lists={lists}
              chosenId={chosen?.id}
              open={picking}
              onOpenChange={setPicking}
              onChoose={choose}
            />
          ) : (
            <MoreButton
              active={picking}
              onClick={() => {
                // El teclado se va y en su sitio salen todas las listas; «Teclado» lo devuelve.
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

      {!dialog && picking && (
        <AllListsPanel
          lists={lists}
          chosenId={chosen?.id}
          onChoose={choose}
          onKeyboard={() => {
            field.current?.focus()
          }}
        />
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
