import { Euro, LoaderCircle, Pencil, WifiOff } from 'lucide-react'
import { useId, useState, type KeyboardEvent } from 'react'

import { centsToInput, currencySymbol, formatCents, parsePriceInput } from '@/lib/money'
import { cn } from '@/lib/utils'

import type { WebPriceState } from '../hooks/useLinkMetadata'
import { changeDescription, changeLabel, itemPrice, priceLine } from '../prices'
import type { Item, ItemPatch } from '../types'

interface PriceBlockProps {
  item: Item
  /** Cómo va el precio de la web (`useLinkMetadata`). */
  webPrice: WebPriceState
  /** El nombre de la web, si ya se sabe, para «Amazon no da el precio.». */
  siteName: string | null
  onUpdate: (item: Item, patch: ItemPatch) => void
}

/**
 * El precio de una compra (diseño 16, B1–B9 y D3), debajo de la foto y del enlace, de donde sale
 * (decisión de Fran: el diseño lo ponía bajo el título). Con precio, el importe grande con su
 * variación («↓ 8 % desde 302 €»), una línea con la tienda, el origen y cuándo, y «Cambiar». Sin
 * precio, una fila gris «Añadir precio», como «+ Foto»; mientras se busca en la web, «Buscando
 * precio…»; si la web no lo da, se dice sin que suene a error. «Actualizar precio» y la gráfica
 * llegan en la 2.2.
 */
export function PriceBlock({ item, webPrice, siteName, onUpdate }: PriceBlockProps) {
  const [editing, setEditing] = useState(false)
  const price = itemPrice(item)

  if (editing) {
    return (
      <PriceInput
        item={item}
        onSave={(patch) => {
          setEditing(false)
          if (patch) onUpdate(item, patch)
        }}
      />
    )
  }

  if (!price) {
    if (webPrice === 'searching') {
      return (
        <div
          role="status"
          className="flex h-13 items-center gap-2.5 rounded-md border border-border-soft bg-background px-4 text-[15px] font-semibold text-muted-foreground"
        >
          <LoaderCircle
            aria-hidden
            className="size-4 animate-spin text-primary"
            strokeWidth={2.4}
          />
          Buscando precio…
        </div>
      )
    }
    return (
      <div className="flex flex-col gap-2">
        <button
          type="button"
          onClick={() => {
            setEditing(true)
          }}
          className="flex h-13 items-center gap-3 rounded-md bg-fill px-4 text-[15px] font-medium text-muted-foreground outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          <Euro aria-hidden className="size-4" strokeWidth={2.2} />
          Añadir precio
        </button>
        {webPrice === 'none' && (
          <p className="px-1 text-[13px] text-muted-foreground">
            {siteName ?? 'La web'} no da el precio. Puedes escribirlo tú.
          </p>
        )}
        {webPrice === 'offline' && (
          <p className="flex items-center gap-1.5 px-1 text-[13px] text-muted-foreground">
            <WifiOff aria-hidden className="size-3.5 shrink-0" strokeWidth={2.2} />
            El precio se buscará al volver la conexión.
          </p>
        )}
      </div>
    )
  }

  const { change } = price
  return (
    <section
      aria-label="Precio"
      className="flex flex-col rounded-[20px] border border-border-soft bg-background p-4"
    >
      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
        <p className="font-display text-[34px] leading-none font-extrabold tracking-[-0.03em]">
          {price.text}
        </p>
        {change && item.previousPriceCents !== null && (
          <span
            className={cn(
              'rounded-[8px] px-2 py-0.5 text-[12.5px] font-bold',
              change.direction === 'down'
                ? 'bg-price-down-bg text-price-down'
                : 'bg-price-up-bg text-price-up',
            )}
          >
            <span aria-hidden>
              {changeLabel(change)} desde {formatCents(item.previousPriceCents, item.currency)}
            </span>
            <span className="sr-only">
              {`${changeDescription(change)} desde ${formatCents(item.previousPriceCents, item.currency)}`}
            </span>
          </span>
        )}
      </div>
      <p className="mt-2 text-[13px] text-muted-foreground">{priceLine(item)}</p>
      {item.previousPriceCents === null && (
        <p className="mt-3 text-[13px] leading-snug text-muted-foreground">
          Es el primer precio. El histórico aparece cuando cambie.
        </p>
      )}
      <div className="mt-2 flex justify-end">
        <button
          type="button"
          onClick={() => {
            setEditing(true)
          }}
          className="-mr-1 flex h-10 items-center gap-1.5 rounded-xl px-2 text-sm font-semibold text-muted-foreground outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          <Pencil aria-hidden className="size-3.5" strokeWidth={2.2} />
          Cambiar
        </button>
      </div>
    </section>
  )
}

/**
 * El campo del precio (diseño 16, B3–B5), en el sitio del bloque (decisión de Fran): teclado
 * numérico con coma, «Se guarda como «Puesto a mano».» y, si ya había precio, «Quitar precio». Se
 * guarda con Intro o al salir del campo, como el título y las notas; Escape lo deja como estaba.
 * Lo que no se entiende se dice y no se guarda.
 */
function PriceInput({
  item,
  onSave,
}: {
  item: Item
  /** El cambio que guardar, o `undefined` para salir sin cambiar nada. */
  onSave: (patch: ItemPatch | undefined) => void
}) {
  const id = useId()
  const [text, setText] = useState(item.priceCents === null ? '' : centsToInput(item.priceCents))
  const [invalid, setInvalid] = useState(false)

  const commit = () => {
    const cents = parsePriceInput(text)
    if (cents === undefined) {
      setInvalid(true)
      return
    }
    if (cents === item.priceCents) {
      onSave(undefined)
      return
    }
    onSave(
      cents === null
        ? { priceCents: null, priceSource: null }
        : { priceCents: cents, priceSource: 'manual', currency: item.currency },
    )
  }
  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' && !event.nativeEvent.isComposing) {
      event.preventDefault()
      commit()
    }
    if (event.key === 'Escape') {
      // Que no cierre también el detalle.
      event.stopPropagation()
      onSave(undefined)
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <label
        htmlFor={id}
        className="px-1 text-xs font-bold tracking-[0.06em] text-subtle-foreground uppercase"
      >
        Precio
      </label>
      <div
        className={cn(
          'flex h-14 items-center gap-2 rounded-md border-[1.5px] bg-card px-4',
          invalid ? 'border-error' : 'border-primary',
        )}
      >
        <input
          id={id}
          autoFocus
          type="text"
          inputMode="decimal"
          enterKeyHint="done"
          autoComplete="off"
          value={text}
          aria-invalid={invalid || undefined}
          aria-describedby={`${id}-hint`}
          onChange={(event) => {
            setText(event.target.value)
            setInvalid(false)
          }}
          onKeyDown={onKeyDown}
          onBlur={commit}
          className="min-w-0 flex-1 bg-transparent font-display text-[22px] font-extrabold tracking-[-0.02em] text-foreground outline-none"
        />
        <span aria-hidden className="font-display text-xl font-bold text-muted-foreground">
          {currencySymbol(item.currency)}
        </span>
      </div>
      <div className="flex items-start justify-between gap-3 px-1 text-[13px]">
        {invalid ? (
          <p id={`${id}-hint`} role="alert" className="text-error">
            Eso no parece un precio.
          </p>
        ) : (
          <p id={`${id}-hint`} className="text-subtle-foreground">
            Se guarda como «Puesto a mano».
          </p>
        )}
        {item.priceCents !== null && (
          <button
            type="button"
            // Que no salga antes del campo y lo guarde.
            onMouseDown={(event) => {
              event.preventDefault()
            }}
            onClick={() => {
              onSave({ priceCents: null, priceSource: null })
            }}
            className="shrink-0 font-semibold text-error outline-none hover:opacity-80 focus-visible:underline"
          >
            Quitar precio
          </button>
        )}
      </div>
    </div>
  )
}
