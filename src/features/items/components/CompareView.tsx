import { Check, ChevronLeft, ChevronRight, ExternalLink, Link2, Store, X } from 'lucide-react'
import { Dialog } from 'radix-ui'
import { useRef, useState, type ReactNode } from 'react'

import { usePriceHistory } from '@/features/prices'
import { formatCents, priceChange } from '@/lib/money'
import { cn } from '@/lib/utils'

import type { OptionMark } from '../chooseOne'
import { compareHint, lowestSeen, optionStore } from '../compare'
import { usePhotoSrc } from '../hooks/usePhoto'
import { linkDomain } from '../links'
import { hasThumb } from '../photos'
import { changeDescription, changeLabel, itemPrice } from '../prices'
import { storesOf } from '../stores'
import type { Item } from '../types'
import { useWorkspaceActions } from './itemActionsContext'

interface CompareViewProps {
  sublist: Item
  /** Lo que se compara, en su orden (`compareOptions`). */
  options: readonly Item[]
  /** «Más barata», «+50,99 €», «Elegida»… de cada una (`optionMarks`). */
  marks: ReadonlyMap<string, OptionMark>
  /** La del botón relleno: la elegida o, sin elegida, la más barata (`leadingOption`). */
  leadingId: string | null
  /** «2 opciones · desde 199 €». */
  summary: string
}

/**
 * Comparar en el móvil (diseño 24, A5 y A7b): a pantalla completa sobre la sublista, «Comparar ·
 * Volantes» con su resumen y la ✕ arriba, y una tarjeta por opción que casi ocupa el ancho, con la
 * siguiente asomando. Se pasan deslizando, con los puntos abajo, como el visor de fotos (23). Atrás
 * (o la ✕, o Esc) la cierra. No es modal: el aviso de «Elegir esta» se puede deshacer con ella
 * abierta.
 */
export function CompareSheet({
  open,
  onOpenChange,
  ...props
}: CompareViewProps & { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [index, setIndex] = useState(0)
  const track = useRef<HTMLDivElement>(null)
  const { sublist, options, summary } = props

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange} modal={false}>
      <Dialog.Portal>
        <Dialog.Content
          aria-describedby={undefined}
          onInteractOutside={(event) => {
            event.preventDefault()
          }}
          className="fixed inset-0 z-[60] flex flex-col bg-background pt-[env(safe-area-inset-top)] pb-[calc(env(safe-area-inset-bottom)+0.75rem)] text-foreground outline-none"
        >
          <div className="flex min-h-[60px] shrink-0 items-center gap-3 pr-3 pl-5">
            <div className="min-w-0 flex-1">
              <Dialog.Title className="truncate font-display text-lg leading-tight font-extrabold tracking-[-0.02em]">
                Comparar · {sublist.title}
              </Dialog.Title>
              <p className="truncate text-[12.5px] text-muted-foreground">{summary}</p>
            </div>
            <Dialog.Close
              aria-label="Cerrar Comparar"
              className="flex size-11 shrink-0 items-center justify-center rounded-full bg-fill outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
            >
              <X aria-hidden className="size-4" strokeWidth={2.2} />
            </Dialog.Close>
          </div>

          <div
            ref={track}
            onScroll={(event) => {
              const element = event.currentTarget
              const card = element.firstElementChild
              if (!(card instanceof HTMLElement) || card.offsetWidth === 0) return
              const at = Math.round(element.scrollLeft / (card.offsetWidth + 12))
              if (at !== index) setIndex(Math.min(at, options.length - 1))
            }}
            className="flex min-h-0 flex-1 snap-x snap-mandatory scroll-px-5 [scrollbar-width:none] items-start gap-3 overflow-x-auto px-5 pt-2 pb-3"
          >
            {options.map((option) => (
              <OptionCard
                key={option.id}
                option={option}
                {...props}
                photoSlot={options.some(hasThumb)}
                className="max-h-full w-[calc(100vw-4.25rem)] max-w-[360px] shrink-0 snap-start overflow-y-auto"
              />
            ))}
          </div>

          <div aria-hidden className="flex shrink-0 justify-center gap-1.5 pt-1">
            {options.map((option, at) => (
              <span
                key={option.id}
                className={cn(
                  'h-1.5 rounded-full transition-all',
                  at === index ? 'w-5 bg-primary' : 'w-1.5 bg-subtle-foreground',
                )}
              />
            ))}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

/** Lo que mueve cada flecha en escritorio: una columna de 300 px y su separación. */
const COLUMN_STEP = 316

/**
 * Comparar en escritorio (D2–D4): en la pantalla de la sublista, en vez de las filas. Con dos o
 * tres opciones, las columnas se reparten el ancho; con cuatro o más, columnas de 300 px con scroll
 * lateral y flechas.
 */
export function CompareColumns(props: CompareViewProps) {
  const { options } = props
  const strip = useRef<HTMLDivElement>(null)
  const scrolling = options.length >= 4
  const scrollBy = (direction: 1 | -1) => {
    strip.current?.scrollBy({ left: direction * COLUMN_STEP, behavior: 'smooth' })
  }

  return (
    <section aria-label="Comparar" className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-4 px-1">
        <p className="text-sm text-muted-foreground">{compareHint(options.length)}</p>
        {scrolling && (
          <div className="flex gap-1.5">
            <ArrowButton
              label="Anteriores"
              onClick={() => {
                scrollBy(-1)
              }}
            >
              <ChevronLeft aria-hidden className="size-4" strokeWidth={2.2} />
            </ArrowButton>
            <ArrowButton
              label="Siguientes"
              onClick={() => {
                scrollBy(1)
              }}
            >
              <ChevronRight aria-hidden className="size-4" strokeWidth={2.2} />
            </ArrowButton>
          </div>
        )}
      </div>
      <div
        ref={strip}
        className={cn(
          'gap-4',
          scrolling
            ? 'flex snap-x snap-mandatory [scrollbar-width:thin] items-stretch overflow-x-auto pb-2'
            : options.length === 3
              ? 'grid grid-cols-3'
              : 'grid grid-cols-2',
        )}
      >
        {options.map((option) => (
          <OptionCard
            key={option.id}
            option={option}
            {...props}
            photoSlot={options.some(hasThumb)}
            compact={scrolling}
            className={cn(scrolling && 'w-[300px] shrink-0 snap-start')}
          />
        ))}
      </div>
    </section>
  )
}

function ArrowButton({
  label,
  onClick,
  children,
}: {
  label: string
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="flex size-9 items-center justify-center rounded-full border border-border bg-card outline-none hover:bg-fill focus-visible:ring-[3px] focus-visible:ring-ring/50"
    >
      {children}
    </button>
  )
}

const SECTION = 'px-1.5 text-xs font-bold tracking-[0.08em] text-muted-foreground uppercase'

/**
 * Una opción (A5, D2): siempre en el mismo orden para compararlas de un vistazo. La foto, el
 * nombre, el precio con su marca, la tienda y en cuántas, si bajó y el más bajo visto, sus enlaces,
 * sus notas y «Elegir esta». Lo que no es compra no lleva el bloque del precio (A7b); lo que no
 * tiene, no sale.
 */
function OptionCard({
  option,
  marks,
  leadingId,
  photoSlot,
  compact = false,
  className,
}: CompareViewProps & {
  option: Item
  /** Si alguna lleva foto: las que no, dejan su hueco, para que todo quede a la misma altura. */
  photoSlot: boolean
  compact?: boolean
  className?: string
}) {
  const { choose } = useWorkspaceActions()
  const mark = marks.get(option.id)
  const chosen = mark?.kind === 'chosen'
  const links = storesOf(option)

  return (
    <article
      aria-label={option.title}
      className={cn(
        'flex flex-col gap-3 rounded-[22px] border border-border-soft bg-card p-3.5 shadow-card',
        className,
      )}
    >
      {photoSlot && <OptionPhoto option={option} compact={compact} />}
      <h3 className="px-0.5 font-display text-[19px] leading-[1.2] font-extrabold tracking-[-0.02em]">
        {option.title}
      </h3>
      {option.kind === 'shopping' && <OptionPrice option={option} mark={mark} />}

      {links.length > 0 && (
        <div className="flex flex-col border-t border-border-soft pt-3">
          <p className={SECTION}>Enlaces</p>
          <ul className="mt-1 flex flex-col">
            {links.map((link) => (
              <li key={link.id}>
                <a
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex h-11 items-center gap-3 rounded-xl px-1.5 text-[15px] outline-none hover:bg-fill focus-visible:ring-[3px] focus-visible:ring-ring/50"
                >
                  <Link2 aria-hidden className="size-4 shrink-0 text-primary" strokeWidth={2.2} />
                  <span className="min-w-0 flex-1 truncate">{linkDomain(link.url)}</span>
                  <ExternalLink
                    aria-hidden
                    className="size-4 shrink-0 text-muted-foreground"
                    strokeWidth={2}
                  />
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}

      {option.notes && (
        <div className="flex flex-col gap-1.5 border-t border-border-soft pt-3">
          <p className={SECTION}>Notas</p>
          <p className="px-0.5 text-[15px] leading-normal whitespace-pre-line">{option.notes}</p>
        </div>
      )}

      <button
        type="button"
        aria-pressed={chosen}
        onClick={() => {
          choose(option)
        }}
        className={cn(
          'mt-auto flex h-12 w-full shrink-0 items-center justify-center gap-2 rounded-2xl text-base font-bold outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50',
          chosen
            ? 'bg-brand-tint text-primary-strong'
            : option.id === leadingId
              ? 'bg-primary text-primary-foreground hover:bg-primary-hover'
              : 'border-[1.5px] border-border bg-card hover:bg-fill',
        )}
      >
        {chosen && <Check aria-hidden className="size-4" strokeWidth={2.6} />}
        {chosen ? 'Elegida' : 'Elegir esta'}
      </button>
    </article>
  )
}

/**
 * Su foto: la primera propia o la de la web. Sin foto, o si no carga, el hueco en `fill`, sin icono
 * roto.
 */
function OptionPhoto({ option, compact }: { option: Item; compact: boolean }) {
  const { src } = usePhotoSrc(option, 'full')
  const [broken, setBroken] = useState<string | null>(null)
  return (
    <div
      className={cn(
        'w-full shrink-0 overflow-hidden rounded-2xl bg-fill',
        compact ? 'h-[120px]' : 'aspect-[4/3] md:aspect-auto md:h-[150px]',
      )}
    >
      {src && broken !== src && (
        <img
          src={src}
          alt=""
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => {
            setBroken(src)
          }}
          className="size-full object-cover"
        />
      )}
    </div>
  )
}

/**
 * El bloque del precio (A5): el importe con «Más barata», «+50,99 €» o «Elegida»; la tienda y en
 * cuántas; y si bajó (o subió) con el más bajo visto, del histórico (2.2). Sin precio, «Sin
 * precio».
 */
function OptionPrice({ option, mark }: { option: Item; mark: OptionMark | undefined }) {
  const price = itemPrice(option)
  const history = usePriceHistory(option.id, option.priceCents, price !== null)
  const store = optionStore(option)
  const change = priceChange(option.previousPriceCents, option.priceCents)
  const lowest = history.data ? lowestSeen(option, history.data) : null

  return (
    <div className="flex flex-col gap-1.5 px-0.5">
      {price ? (
        <p className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
          <span className="font-display text-[26px] leading-none font-extrabold tracking-[-0.03em] whitespace-nowrap">
            <span className="sr-only">Precio: </span>
            {price.text}
          </span>
          {mark?.kind === 'cheapest' && (
            <span className="rounded-[7px] bg-price-down-bg px-2 py-0.5 text-xs font-bold text-price-down">
              Más barata
            </span>
          )}
          {mark?.kind === 'extra' && (
            <span className="text-xs font-bold text-muted-foreground">
              <span className="sr-only">Cuesta </span>
              {mark.text}
              <span className="sr-only"> más que la más barata</span>
            </span>
          )}
          {mark?.kind === 'chosen' && (
            <span className="flex items-center gap-1 rounded-[7px] bg-brand-tint px-2 py-0.5 text-xs font-bold text-primary-strong">
              <Check aria-hidden className="size-3" strokeWidth={2.8} />
              Elegida
            </span>
          )}
        </p>
      ) : (
        <p className="text-[15px] text-subtle-foreground">Sin precio</p>
      )}
      {store && (
        <p className="flex items-center gap-1.5 text-[13.5px] text-muted-foreground">
          <Store aria-hidden className="size-3.5 shrink-0" strokeWidth={2.2} />
          <span className="min-w-0 truncate">{store}</span>
        </p>
      )}
      {price && (change !== null || lowest !== null) && (
        <p className="flex flex-wrap items-center gap-2 text-[13.5px] text-muted-foreground">
          {change && (
            <span
              className={cn(
                'rounded-[7px] px-1.5 py-0.5 text-xs font-bold',
                change.direction === 'down'
                  ? 'bg-price-down-bg text-price-down'
                  : 'bg-price-up-bg text-price-up',
              )}
            >
              <span aria-hidden>{changeLabel(change)}</span>
              <span className="sr-only">{changeDescription(change)}</span>
            </span>
          )}
          {lowest !== null && <span>Más bajo visto: {formatCents(lowest, option.currency)}</span>}
        </p>
      )}
    </div>
  )
}
