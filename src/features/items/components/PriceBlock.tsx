import { Check, Euro, LoaderCircle, Pencil, RefreshCw, WifiOff } from 'lucide-react'
import { useId, useRef, useState, type KeyboardEvent } from 'react'

import { BottomSheet } from '@/components/BottomSheet'
import { firstPrice, PriceHistory, savedCents, usePriceHistory } from '@/features/prices'
import { centsToInput, currencySymbol, formatCents, parsePriceInput } from '@/lib/money'
import { cn } from '@/lib/utils'

import type { WebPriceState } from '../hooks/useLinkMetadata'
import type { RefreshState } from '../hooks/useRefreshPrice'
import { changeDescription, changeLabel, itemPrice, priceLine } from '../prices'
import { isFinalStatus } from '../status'
import { cheapestLabel, cheapestLink, hasStores, storeName } from '../stores'
import type { Item, ItemLink, ItemPatch } from '../types'

interface PriceBlockProps {
  item: Item
  online: boolean
  isDesktop: boolean
  /** Cómo va el precio de la web (`useLinkMetadata`). */
  webPrice: WebPriceState
  /** El nombre de la web, si ya se sabe, para «Amazon no da el precio.». */
  siteName: string | null
  /** «Actualizar precio» (`useRefreshPrice`): vive en el detalle porque lo ven también las tiendas. */
  refresh: { state: RefreshState; refresh: () => Promise<void>; reset: () => void }
  /** Una frase de las tiendas («MediaMarkt es la más barata…», «Ahora la más barata es…»). */
  notice: string | null
  onUpdate: (item: Item, patch: ItemPatch) => void
}

/** Lo que dice el campo cuando «Actualizar precio» no tiene web que mirar (diseño 16, B16). */
const NO_LINK_HINT = 'Sin enlace no hay web que mirar. Escribe el precio nuevo.'

/**
 * El precio de una compra (diseño 16, B1–B18 y D1–D4, y 19), debajo de la foto y del enlace, de
 * donde sale (decisión de Fran: el diseño lo ponía bajo el título).
 * - Con precio: el importe grande con su variación («↓ 8 % desde 302 €»), una línea con la tienda,
 *   el origen y cuándo, la gráfica del histórico si ha cambiado alguna vez, y «Actualizar precio»
 *   y «Cambiar».
 * - Con varias tiendas (diseño 19): el de la más barata, «En MediaMarkt, la más barata de 3», y sin
 *   «Cambiar», que vive en cada tienda.
 * - Comprada: «Pagaste 259 €» y, si bajó desde el primer precio, «Ahorraste 43 €». Sin actualizar:
 *   ya no hay nada que mirar, pero se puede corregir lo pagado (con varias tiendas, «¿Dónde lo
 *   compraste?»).
 * - Sin precio: una fila gris «Añadir precio», como «+ Foto»; mientras se busca en la web,
 *   «Buscando precio…»; si la web no lo da, se dice sin que suene a error.
 */
export function PriceBlock({
  item,
  online,
  isDesktop,
  webPrice,
  siteName,
  refresh,
  notice,
  onUpdate,
}: PriceBlockProps) {
  const [editing, setEditing] = useState<false | 'price' | 'no-link'>(false)
  const [choosing, setChoosing] = useState(false)
  const price = itemPrice(item)
  const stores = hasStores(item)
  // Con un solo precio no hay gráfica (B7): el histórico se pide si ha cambiado alguna vez.
  const changed = price !== null && item.previousPriceCents !== null
  const history = usePriceHistory(item.id, item.priceCents, changed || item.status === 'bought')

  if (editing) {
    return (
      <PriceInput
        item={item}
        hint={editing === 'no-link' ? NO_LINK_HINT : undefined}
        onSave={(patch) => {
          setEditing(false)
          if (patch) {
            refresh.reset()
            // Lo pagado en otro sitio ya no es de ninguna de las tiendas.
            onUpdate(item, stores ? { ...patch, priceLinkId: null, priceStore: null } : patch)
          }
        }}
      />
    )
  }
  const edit = () => {
    setEditing('price')
  }

  if (!price || item.priceCents === null) {
    // Con varias tiendas el precio se pone en cada una (diseño 19, T5).
    if (stores) return null
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
          onClick={edit}
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

  const bought = item.status === 'bought'
  const first = history.data ? firstPrice(history.data, item.currency) : null
  const saved = bought ? savedCents(first, item.priceCents) : 0
  const { change } = price
  const chart = changed && history.data && (
    <PriceHistory
      records={history.data}
      stores={stores}
      current={{
        cents: item.priceCents,
        currency: item.currency,
        source: item.priceSource ?? 'manual',
        checkedAt: item.priceCheckedAt,
        store: item.priceStore,
      }}
    />
  )
  const best = cheapestLink(item.links)
  const where =
    stores && item.priceStore
      ? `en ${item.priceStore}${item.priceLinkId === best?.id ? ', la más barata' : ''}`
      : item.urlSite
  const line = bought
    ? [
        where,
        saved > 0 && first !== null
          ? `desde ${formatCents(first, item.currency)}, su primer precio`
          : null,
      ]
        .filter(Boolean)
        .join(' · ') || priceLine(item)
    : stores
      ? [cheapestLabel(item), priceWhen(item)].filter(Boolean).join(' · ')
      : priceLine(item)
  const { state } = refresh
  const searching = state.status === 'searching'
  const searchingLabel =
    stores && state.status === 'searching'
      ? `Buscando en ${String(state.ids.length)} tiendas…`
      : undefined
  // Con varias tiendas, lo pagado se corrige eligiendo dónde se compró (diseño 19, T22).
  const changePaid =
    stores && bought
      ? () => {
          setChoosing(true)
        }
      : edit

  return (
    <section
      aria-label="Precio"
      className="flex flex-col rounded-[20px] border border-border-soft bg-background p-4"
    >
      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
        {bought && <span className="text-[15px] font-semibold text-muted-foreground">Pagaste</span>}
        <p className="font-display text-[34px] leading-none font-extrabold tracking-[-0.03em]">
          {price.text}
        </p>
        {!bought && change && item.previousPriceCents !== null && (
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
      <p className="mt-2 text-[13px] text-muted-foreground">{line}</p>
      {saved > 0 && (
        <p className="mt-3 self-start rounded-[10px] bg-price-down-bg px-2.5 py-1 text-[13px] font-bold text-price-down">
          Ahorraste {formatCents(saved, item.currency)}
        </p>
      )}
      {item.previousPriceCents === null && !bought && (
        <p className="mt-3 text-[13px] leading-snug text-muted-foreground">
          Es el primer precio. El histórico aparece cuando cambie.
        </p>
      )}
      {chart}
      {!bought && (
        <RefreshNote
          state={
            refresh.state.status === 'idle' && notice
              ? { status: 'notice', text: notice }
              : refresh.state
          }
          onWrite={edit}
        />
      )}
      <div className="mt-3 flex items-center gap-2">
        {!isFinalStatus(item.status) && (
          <RefreshButton
            searching={searching}
            label={searchingLabel}
            offline={!online && item.url !== null}
            onClick={() => {
              if (item.url) void refresh.refresh()
              else setEditing('no-link')
            }}
          />
        )}
        {(!stores || bought) && (
          <button
            type="button"
            onClick={changePaid}
            className="-mr-1 ml-auto flex h-11 shrink-0 items-center gap-1.5 rounded-xl px-2 text-sm font-semibold text-muted-foreground outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            <Pencil aria-hidden className="size-3.5" strokeWidth={2.2} />
            Cambiar
          </button>
        )}
      </div>
      {stores && bought && (
        <WhereBought
          item={item}
          open={choosing}
          isDesktop={isDesktop}
          onOpenChange={setChoosing}
          onOther={() => {
            setChoosing(false)
            setEditing('price')
          }}
          onChoose={(link) => {
            setChoosing(false)
            if (link.priceCents === null) return
            onUpdate(item, {
              priceCents: link.priceCents,
              currency: link.currency,
              priceSource: link.priceSource ?? 'manual',
              priceCheckedAt: link.priceCheckedAt,
              priceLinkId: link.id,
              priceStore: storeName(link),
            })
          }}
        />
      )}
    </section>
  )
}

/** «mirado el 30 jul», «ahora», «hoy»: la fecha de la línea con varias tiendas. */
function priceWhen(item: Item): string | null {
  // `priceLine` sin la tienda ni el origen: con varias, lo dice «En MediaMarkt…».
  return (
    priceLine({ urlSite: null, priceSource: 'web', priceCheckedAt: item.priceCheckedAt }).replace(
      /^de la web( · )?/,
      '',
    ) || null
  )
}

/**
 * «¿Dónde lo compraste?» (diseño 19, T22 y D4): las tiendas con su precio, para elegir, y «Otro
 * sitio u otro precio…», que abre el campo. Al elegir cambian «Pagaste», «Ahorraste» y lo que suma
 * en Perfil. Hoja en móvil; en escritorio, una caja sobre el bloque.
 */
function WhereBought({
  item,
  open,
  isDesktop,
  onOpenChange,
  onChoose,
  onOther,
}: {
  item: Item
  open: boolean
  isDesktop: boolean
  onOpenChange: (open: boolean) => void
  onChoose: (link: ItemLink) => void
  onOther: () => void
}) {
  const [chosen, setChosen] = useState<string | null>(item.priceLinkId)
  const picked = item.links.find((link) => link.id === chosen)
  const options = (
    <div role="radiogroup" aria-label="¿Dónde lo compraste?" className="flex flex-col gap-1">
      {item.links
        .filter((link) => link.priceCents !== null)
        .map((link) => {
          const selected = link.id === chosen
          return (
            <button
              key={link.id}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => {
                setChosen(link.id)
                if (isDesktop) onChoose(link)
              }}
              className={cn(
                'flex h-13 items-center gap-3 rounded-xl px-3 text-left text-[15px] font-semibold outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50',
                selected ? 'bg-brand-tint text-primary-strong' : 'hover:bg-fill',
              )}
            >
              <span
                aria-hidden
                className={cn(
                  'grid size-5 shrink-0 place-items-center rounded-full border-2',
                  selected ? 'border-primary' : 'border-control',
                )}
              >
                {selected && <span className="size-2.5 rounded-full bg-primary" />}
              </span>
              <span className="min-w-0 flex-1 truncate">{storeName(link)}</span>
              <span className="font-display font-extrabold">
                {formatCents(link.priceCents ?? 0, link.currency)}
              </span>
            </button>
          )
        })}
      <button
        type="button"
        onClick={onOther}
        className="flex h-13 items-center gap-3 rounded-xl px-3 text-left text-[15px] text-muted-foreground outline-none hover:bg-fill focus-visible:ring-[3px] focus-visible:ring-ring/50"
      >
        <span aria-hidden className="size-5 shrink-0 rounded-full border-2 border-control" />
        Otro sitio u otro precio…
      </button>
    </div>
  )

  if (isDesktop) {
    return open ? (
      <div className="mt-3 rounded-2xl border border-border-soft bg-popover p-3 shadow-popover">
        <p className="px-1 font-display text-lg font-extrabold">¿Dónde lo compraste?</p>
        <p className="mb-2 px-1 text-[13px] text-subtle-foreground">
          Cambia lo que pagaste y lo ahorrado.
        </p>
        {options}
      </div>
    ) : null
  }
  return (
    <BottomSheet nested open={open} onOpenChange={onOpenChange} title="¿Dónde lo compraste?">
      <div>
        <p className="font-display text-xl font-extrabold tracking-[-0.02em]">
          ¿Dónde lo compraste?
        </p>
        <p className="mt-0.5 text-[13px] text-subtle-foreground">
          Cambia lo que pagaste y lo ahorrado.
        </p>
      </div>
      {options}
      <button
        type="button"
        disabled={!picked}
        onClick={() => {
          if (picked) onChoose(picked)
        }}
        className="mt-1 h-13 rounded-2xl bg-primary font-display text-base font-bold text-primary-foreground outline-none hover:bg-primary-hover focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:bg-control"
      >
        {picked?.priceCents != null
          ? `Pagaste ${formatCents(picked.priceCents, picked.currency)}`
          : 'Elige dónde'}
      </button>
    </BottomSheet>
  )
}

/**
 * «Actualizar precio» (diseño 16, B1 y B10): con borde en `primary`; mientras mira, «Buscando
 * precio…» («Buscando en 3 tiendas…», diseño 19, T16); sin conexión, gris y con «Necesita
 * conexión» (B15). Sin enlace también sale: abre el campo (B16).
 */
function RefreshButton({
  searching,
  label,
  offline,
  onClick,
}: {
  searching: boolean
  label?: string | undefined
  offline: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      disabled={searching || offline}
      onClick={onClick}
      className={cn(
        'flex h-12 min-w-0 flex-1 items-center justify-center gap-2 rounded-md px-3 font-display text-[15px] font-bold outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50',
        offline
          ? 'bg-fill text-muted-foreground'
          : 'border-[1.5px] border-primary text-primary hover:bg-brand-tint disabled:hover:bg-transparent',
      )}
    >
      {searching ? (
        <LoaderCircle aria-hidden className="size-4 shrink-0 animate-spin" strokeWidth={2.4} />
      ) : (
        <RefreshCw aria-hidden className="size-4 shrink-0" strokeWidth={2.4} />
      )}
      <span className="truncate">
        {searching ? (label ?? 'Buscando precio…') : 'Actualizar precio'}
      </span>
      {offline && (
        <span className="shrink-0 font-sans text-xs font-medium text-subtle-foreground">
          · Necesita conexión
        </span>
      )}
    </button>
  )
}

/**
 * El resultado de «Actualizar precio», en una línea dentro del bloque y sin toast (diseño 16,
 * B11–B14, y 19, T14 y T17–T19). Ninguno suena a error: lo que no se pudo mirar invita a escribirlo.
 */
function RefreshNote({
  state,
  onWrite,
}: {
  state: RefreshState | { status: 'notice'; text: string }
  onWrite: () => void
}) {
  const write = (label: string) => (
    <button
      type="button"
      onClick={onWrite}
      className="font-semibold text-primary outline-none hover:text-primary-hover focus-visible:underline"
    >
      {label}
    </button>
  )
  const done = (text: string, tone: 'success' | 'muted') => (
    <span className={cn('flex items-start gap-1.5', tone === 'success' && 'text-success')}>
      <Check aria-hidden className="mt-0.5 size-3.5 shrink-0" strokeWidth={2.6} />
      {text}
    </span>
  )
  const content =
    state.status === 'new' ? (
      done('Precio nuevo de la web, ahora.', 'success')
    ) : state.status === 'same' ? (
      done(`Sigue a ${state.text}. Mirado ahora.`, 'muted')
    ) : state.status === 'summary' ? (
      state.failedIds.length > 0 ? (
        state.text
      ) : (
        done(state.text, state.tone)
      )
    ) : state.status === 'notice' ? (
      state.text
    ) : state.status === 'none' ? (
      <>Esta vez no vemos el precio en la web. Si lo sabes, {write('escríbelo')}.</>
    ) : state.status === 'blocked' ? (
      <>La web no nos deja mirar el precio. Puedes {write('escribirlo tú')}.</>
    ) : state.status === 'failed' ? (
      <>No hemos podido mirar la web ahora. Prueba otra vez en un momento.</>
    ) : null
  return (
    <p role="status" className="mt-3 text-[13px] leading-snug text-muted-foreground empty:hidden">
      {content}
    </p>
  )
}

/** El campo del precio de una compra, que se guarda como escrito a mano. */
function PriceInput({
  item,
  hint,
  onSave,
}: {
  item: Item
  /** Una línea sobre el campo que explica por qué se abre (B16: sin enlace no hay web). */
  hint?: string | undefined
  /** El cambio que guardar, o `undefined` para salir sin cambiar nada. */
  onSave: (patch: ItemPatch | undefined) => void
}) {
  return (
    <PriceField
      cents={item.priceCents}
      currency={item.currency}
      hint={hint}
      onRemove={
        item.priceCents === null
          ? undefined
          : () => {
              onSave({ priceCents: null, priceSource: null })
            }
      }
      onSave={(cents) => {
        if (cents === undefined) onSave(undefined)
        else
          onSave(
            cents === null
              ? { priceCents: null, priceSource: null }
              : { priceCents: cents, priceSource: 'manual', currency: item.currency },
          )
      }}
    />
  )
}

/**
 * El campo del precio (diseño 16, B3–B5, y 19, T6 y T13): teclado numérico con coma, «Se guarda
 * como «Puesto a mano».» y, a la derecha, quitar el precio (o la tienda). Se guarda con Intro o al
 * salir del campo, como el título y las notas; Escape lo deja como estaba. Lo que no se entiende se
 * dice y no se guarda. `onSave` recibe los céntimos, `null` si se vació o `undefined` si no cambió.
 */
export function PriceField({
  cents,
  currency,
  hint,
  savedAs = 'Se guarda como «Puesto a mano».',
  removeLabel = 'Quitar precio',
  onRemove,
  onSave,
}: {
  cents: number | null
  currency: string
  hint?: string | undefined
  savedAs?: string
  removeLabel?: string
  onRemove?: (() => void) | undefined
  onSave: (cents: number | null | undefined) => void
}) {
  const id = useId()
  const [text, setText] = useState(cents === null ? '' : centsToInput(cents))
  const [invalid, setInvalid] = useState(false)
  // Quitar sale antes que el `blur` del campo: que no se guarde también lo escrito.
  const removing = useRef(false)

  const commit = () => {
    if (removing.current) return
    const value = parsePriceInput(text)
    if (value === undefined) {
      setInvalid(true)
      return
    }
    onSave(value === cents ? undefined : value)
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
          {currencySymbol(currency)}
        </span>
      </div>
      {hint && <p className="px-1 text-[13px] text-muted-foreground">{hint}</p>}
      <div className="flex items-start justify-between gap-3 px-1 text-[13px]">
        {invalid ? (
          <p id={`${id}-hint`} role="alert" className="text-error">
            Eso no parece un precio.
          </p>
        ) : (
          <p id={`${id}-hint`} className="text-subtle-foreground">
            {savedAs}
          </p>
        )}
        {onRemove && (
          <button
            type="button"
            // Que no salga antes del campo y lo guarde.
            onMouseDown={(event) => {
              event.preventDefault()
              removing.current = true
            }}
            onClick={() => {
              removing.current = true
              onRemove()
            }}
            className="shrink-0 font-semibold text-error outline-none hover:opacity-80 focus-visible:underline"
          >
            {removeLabel}
          </button>
        )}
      </div>
    </div>
  )
}
