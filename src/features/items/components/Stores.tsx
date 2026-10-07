import { useQuery } from '@tanstack/react-query'
import {
  ExternalLink,
  LoaderCircle,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
  WifiOff,
  X,
} from 'lucide-react'
import { DropdownMenu } from 'radix-ui'
import { format } from 'date-fns'
import { useEffect, useRef, useState, type ReactNode } from 'react'

import { BottomSheet } from '@/components/BottomSheet'
import { morningChange, usePriceHistory } from '@/features/prices'
import { formatCents } from '@/lib/money'
import { cn } from '@/lib/utils'

import type { RefreshState } from '../hooks/useRefreshPrice'
import { linkDomain, URL_TITLE_MAX_LENGTH } from '../links'
import { priceOrigin } from '../prices'
import { linkMetadataQueryOptions } from '../queries'
import { cheapestLink, extraOver, sameLink, stoppedNote, storeName } from '../stores'
import type { Item, ItemLink, ItemLinkPatch } from '../types'
import { LinkInput } from './LinkInput'
import { OriginLine, PriceField } from './PriceBlock'

interface StoresSectionProps {
  item: Item
  isDesktop: boolean
  online: boolean
  refresh: RefreshState
  onAdd: (url: string) => void
  onUpdate: (linkId: string, patch: ItemLinkPatch) => void
  onRemove: (link: ItemLink) => void
  /** Volver a probar una tienda que ya no se podía seguir (↻, diseño 22, T1). */
  onRetry: (linkId: string) => void
  /** Una frase para el bloque de precio («MediaMarkt es la más barata: 20 € menos…»). */
  onNotice: (text: string) => void
}

/**
 * «Dónde comprarlo» (diseño 19, T10 y D1): con dos o más tiendas, la fila del enlace pasa a ser
 * esta caja, con una fila por tienda (nombre, dominio, precio y ↗) y «+ Otra tienda» al final. La
 * más barata lleva «Más barata»; las demás, cuánto más cuestan. Tocar una tienda abre su menú
 * (Abrir en la web · Cambiar el precio · Quitar tienda).
 */
export function StoresSection({
  item,
  isDesktop,
  online,
  refresh,
  onAdd,
  onUpdate,
  onRemove,
  onRetry,
  onNotice,
}: StoresSectionProps) {
  const [adding, setAdding] = useState(false)
  const best = cheapestLink(item.links)
  const priced = item.links.filter((link) => link.priceCents !== null).length
  // Qué tienda bajó (o subió) esta mañana: la del último cambio del precio, si fue solo (T1).
  const history = usePriceHistory(item.id, item.priceCents, item.previousPriceCents !== null)
  const morning = history.data ? morningChange(history.data, item.currency) : null
  const stopped = item.links.filter((link) => link.priceTracking === 'stopped')

  return (
    <section aria-label="Dónde comprarlo" className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between px-1">
        <h2 className="text-xs font-bold tracking-[0.06em] text-subtle-foreground uppercase">
          Dónde comprarlo
        </h2>
        <span className="text-[12.5px] text-subtle-foreground">{item.links.length} tiendas</span>
      </div>
      <ul className="overflow-hidden rounded-md border border-border-soft bg-card">
        {item.links.map((link) => (
          <StoreRow
            key={link.id}
            item={item}
            link={link}
            cheapest={priced > 1 && link.id === best?.id}
            extra={extraOver(link, best)}
            isDesktop={isDesktop}
            online={online}
            searching={refresh.status === 'searching' && refresh.ids.includes(link.id)}
            failed={refresh.status === 'summary' && refresh.failedIds.includes(link.id)}
            morning={morning?.after.store === storeName(link) ? morning.direction : null}
            onRetry={() => {
              onRetry(link.id)
            }}
            onUpdate={(patch) => {
              onUpdate(link.id, patch)
            }}
            onRemove={() => {
              onRemove(link)
            }}
            onNotice={onNotice}
          />
        ))}
        <li className="border-t border-border-soft">
          {adding ? (
            <div className="p-2.5">
              <LinkInput
                validate={(url) =>
                  item.links.some((link) => sameLink(link.url, url))
                    ? 'Esta tienda ya está en la lista.'
                    : null
                }
                onSave={(url) => {
                  setAdding(false)
                  onAdd(url)
                }}
                onCancel={() => {
                  setAdding(false)
                }}
              />
            </div>
          ) : (
            <AddStoreButton
              className="h-12 w-full px-4"
              onClick={() => {
                setAdding(true)
              }}
            />
          )}
        </li>
      </ul>
      {stopped.length > 0 && (
        <p className="px-1 text-[14px] leading-snug text-muted-foreground">
          {stoppedNote(stopped.map(storeName), item.links.length)}
        </p>
      )}
    </section>
  )
}

/** «+ Otra tienda» (diseño 19, T1): un enlace de texto en índigo, sin caja. */
export function AddStoreButton({
  className,
  onClick,
}: {
  className?: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex items-center gap-2 text-sm font-semibold text-primary outline-none hover:text-primary-hover focus-visible:ring-[3px] focus-visible:ring-ring/50',
        className,
      )}
    >
      <Plus aria-hidden className="size-4" strokeWidth={2.4} />
      Otra tienda
    </button>
  )
}

/**
 * Lo que trae la web de una tienda recién pegada, una vez (como el enlace de la 2a.6): su título,
 * su nombre y, si aún no tiene, su precio. Sin red espera y sale al volver la conexión.
 */
function useStoreMetadata(
  link: ItemLink,
  current: Item,
  onUpdate: (patch: ItemLinkPatch) => void,
  onNotice: (text: string) => void,
) {
  const needs = link.urlTitle === null
  const metadata = useQuery({ ...linkMetadataQueryOptions(link.url), enabled: needs })
  const applied = useRef(false)
  useEffect(() => {
    const data = metadata.data
    if (!needs || !data || applied.current) return
    applied.current = true
    const patch: ItemLinkPatch = {
      urlTitle: data.title?.slice(0, URL_TITLE_MAX_LENGTH) ?? '',
      urlSite: data.siteName?.slice(0, URL_TITLE_MAX_LENGTH) ?? null,
    }
    if (link.priceCents === null && data.price) {
      patch.priceCents = data.price.cents
      patch.currency = data.price.currency
      patch.priceSource = 'web'
      patch.priceCheckedAt = new Date()
      // La nueva pasa a ser la más barata (diseño 19, T4): se dice cuánto menos y que quién.
      if (
        current.priceCents !== null &&
        data.price.currency === current.currency &&
        data.price.cents < current.priceCents
      ) {
        const name = data.siteName ?? linkDomain(link.url)
        const before = current.priceStore ?? current.urlSite ?? linkDomain(current.url ?? '')
        onNotice(
          `${name} es la más barata: ${formatCents(current.priceCents - data.price.cents, current.currency)} menos que ${before}.`,
        )
      }
    }
    onUpdate(patch)
  }, [needs, metadata.data, link, current, onUpdate, onNotice])

  return {
    searching: needs && metadata.fetchStatus === 'fetching',
    waiting: needs && metadata.fetchStatus === 'paused',
  }
}

interface StoreRowProps {
  item: Item
  link: ItemLink
  cheapest: boolean
  extra: string | null
  isDesktop: boolean
  online: boolean
  /** «Actualizar precio» la está mirando. */
  searching: boolean
  /** «Actualizar precio» no pudo mirarla: se queda con su último precio (diseño 19, T18). */
  failed: boolean
  /** Si es la que bajó o subió sola esta mañana (diseño 22, T1). */
  morning: 'down' | 'up' | null
  onRetry: () => void
  onUpdate: (patch: ItemLinkPatch) => void
  onRemove: () => void
  onNotice: (text: string) => void
}

/** Una tienda (diseño 19, T3–T8, T10, T16–T18 y T23). */
function StoreRow({
  item,
  link,
  cheapest,
  extra,
  isDesktop,
  online,
  searching: refreshing,
  failed,
  morning,
  onRetry,
  onUpdate,
  onRemove,
  onNotice,
}: StoreRowProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [editing, setEditing] = useState(false)
  const lookup = useStoreMetadata(link, item, onUpdate, onNotice)
  const searching = refreshing || lookup.searching
  const name = storeName(link)
  const domain = linkDomain(link.url)
  const checked = link.priceCheckedAt ? format(link.priceCheckedAt, 'd MMM') : null
  const stopped = link.priceTracking === 'stopped'

  // Lo de debajo del nombre: el dominio y «Más barata», o cómo va (buscando, no da el precio…).
  const detail: ReactNode = searching ? (
    <span className="flex items-center gap-1.5">
      <LoaderCircle aria-hidden className="size-3 animate-spin text-primary" strokeWidth={2.6} />
      Buscando…
    </span>
  ) : lookup.waiting || (!online && link.urlTitle === null) ? (
    <Offline>Se buscará al volver la conexión.</Offline>
  ) : failed ? (
    `No contestó${checked ? ` · precio del ${checked}` : ''}`
  ) : !online ? (
    <Offline>{[domain, checked].filter(Boolean).join(' · ')}</Offline>
  ) : link.priceCents === null && link.urlTitle !== null ? (
    link.urlTitle === '' ? (
      'No deja mirar el precio'
    ) : (
      'No da el precio'
    )
  ) : (
    <span className="flex min-w-0 items-center gap-1.5">
      {/* Cómo se supo su precio (diseño 22, T1); sin precio todavía, su dominio. */}
      <span className="truncate">
        {link.priceSource !== null || stopped ? (
          <OriginLine lead={null} origin={priceOrigin(link, morning, new Date(), true)} />
        ) : (
          domain
        )}
      </span>
      {cheapest && (
        <span className="shrink-0 rounded-[6px] bg-price-down-bg px-1.5 py-px text-[11px] font-bold text-price-down">
          Más barata
        </span>
      )}
    </span>
  )

  const price =
    link.priceCents !== null ? (
      <span className="flex flex-col items-end text-right">
        <span
          className={cn(
            'font-display text-base font-extrabold tracking-[-0.02em] whitespace-nowrap',
            stopped && 'text-muted-foreground',
          )}
        >
          {formatCents(link.priceCents, link.currency)}
        </span>
        {extra && <span className="text-xs text-subtle-foreground">{extra}</span>}
      </span>
    ) : searching || lookup.waiting ? null : (
      <button
        type="button"
        onClick={() => {
          setEditing(true)
        }}
        className="relative z-10 text-sm font-semibold whitespace-nowrap text-primary outline-none hover:text-primary-hover focus-visible:underline"
      >
        Añadir precio
      </button>
    )

  const menuItems = [
    {
      id: 'open',
      label: 'Abrir en la web',
      icon: ExternalLink,
      run: () => window.open(link.url, '_blank', 'noopener,noreferrer'),
    },
    {
      id: 'price',
      label: 'Cambiar el precio',
      icon: Pencil,
      run: () => {
        setEditing(true)
      },
    },
    { id: 'remove', label: 'Quitar tienda', icon: Trash2, run: onRemove, destructive: true },
  ]

  const editor = (
    <PriceField
      cents={link.priceCents}
      currency={link.currency}
      hint={
        link.priceCents === null
          ? `${domain} no da el precio. Lo que escribas cuenta solo para esta tienda.`
          : link.priceSource === 'manual'
            ? link.priceTracking === 'on'
              ? 'Escrito a mano. «Actualizar precio» no lo pisa, pero la consulta de cada mañana sí, si la tienda da el precio.'
              : 'Escrito a mano. «Actualizar precio» no lo pisa en esta tienda.'
            : undefined
      }
      savedAs="Se guarda como «a mano»."
      removeLabel="Quitar tienda"
      onRemove={() => {
        setEditing(false)
        onRemove()
      }}
      onSave={(cents) => {
        setEditing(false)
        if (cents === undefined) return
        onUpdate(
          cents === null
            ? { priceCents: null, priceSource: null }
            : { priceCents: cents, priceSource: 'manual', priceCheckedAt: new Date() },
        )
      }}
    />
  )

  // En escritorio el campo va en el sitio de la fila; en móvil, en una hoja con «Listo» (T6, T13).
  if (editing && isDesktop) {
    return <li className="border-t border-border-soft p-3 first:border-t-0">{editor}</li>
  }

  const summary = [
    domain,
    link.priceCents !== null ? formatCents(link.priceCents, link.currency) : null,
    link.priceSource
      ? `${link.priceSource === 'manual' ? 'a mano' : 'de la web'}${checked ? `, ${checked}` : ''}`
      : null,
  ]
    .filter(Boolean)
    .join(' · ')

  const rowBody = (
    <>
      <span className="min-w-0 flex-1">
        <span
          className={cn(
            'block truncate text-[15px] font-semibold',
            link.urlTitle === null ? 'text-muted-foreground' : 'text-foreground',
          )}
        >
          {name}
        </span>
        <span className="mt-0.5 block truncate text-[12.5px] text-subtle-foreground">{detail}</span>
      </span>
      {price}
    </>
  )

  const trigger = (
    <button
      type="button"
      aria-label={`${name}: opciones`}
      className="absolute inset-0 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:ring-inset"
      onClick={
        isDesktop
          ? undefined
          : () => {
              setMenuOpen(true)
            }
      }
    />
  )

  return (
    <li
      className={cn(
        'relative flex min-h-15 items-center gap-3 border-t border-border-soft py-2.5 pr-2 pl-4 first:border-t-0',
        cheapest && 'bg-background',
      )}
    >
      {isDesktop ? (
        <DropdownMenu.Root open={menuOpen} onOpenChange={setMenuOpen} modal={false}>
          <DropdownMenu.Trigger asChild>{trigger}</DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content
              align="end"
              sideOffset={4}
              className="z-50 w-[220px] rounded-2xl border border-border-soft bg-popover p-1.5 text-popover-foreground shadow-popover outline-none"
            >
              {menuItems.map((entry) => (
                <DropdownMenu.Item
                  key={entry.id}
                  onSelect={entry.run}
                  className={cn(
                    'flex h-11 cursor-pointer items-center gap-3 rounded-xl px-3.5 text-sm font-medium outline-none select-none data-highlighted:bg-fill',
                    entry.destructive &&
                      'mt-1 rounded-none border-t border-border-soft pt-1 text-destructive',
                  )}
                >
                  <entry.icon aria-hidden className="size-4" strokeWidth={2} />
                  {entry.label}
                </DropdownMenu.Item>
              ))}
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      ) : (
        trigger
      )}
      {rowBody}
      {searching ? (
        <button
          type="button"
          aria-label={`Quitar ${name}`}
          onClick={onRemove}
          className="relative z-10 grid size-9 shrink-0 place-items-center rounded-[10px] text-muted-foreground outline-none hover:bg-fill hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          <X aria-hidden className="size-4" strokeWidth={2.2} />
        </button>
      ) : stopped ? (
        <button
          type="button"
          aria-label={`Volver a probar ${name}`}
          disabled={!online}
          onClick={onRetry}
          className="relative z-10 grid size-9 shrink-0 place-items-center rounded-[10px] text-primary outline-none hover:bg-fill focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:text-subtle-foreground"
        >
          <RefreshCw aria-hidden className="size-4" strokeWidth={2.2} />
        </button>
      ) : (
        <a
          href={link.url}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Abrir ${domain}`}
          className="relative z-10 grid size-9 shrink-0 place-items-center rounded-[10px] text-primary outline-none hover:bg-fill focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          <ExternalLink aria-hidden className="size-4" strokeWidth={2.2} />
        </a>
      )}

      {!isDesktop && (
        <>
          <BottomSheet nested open={menuOpen} onOpenChange={setMenuOpen} title={name}>
            <div>
              <p className="font-display text-xl font-extrabold tracking-[-0.02em]">{name}</p>
              <p className="mt-0.5 text-[13px] text-subtle-foreground">{summary}</p>
            </div>
            <div className="-mx-2 flex flex-col gap-0.5">
              {menuItems.map((entry) => (
                <button
                  key={entry.id}
                  type="button"
                  onClick={() => {
                    setMenuOpen(false)
                    entry.run()
                  }}
                  className={cn(
                    'flex h-13 w-full items-center gap-3 rounded-xl px-3.5 text-[15px] font-medium outline-none active:bg-fill',
                    entry.destructive ? 'text-destructive' : 'text-foreground',
                  )}
                >
                  <entry.icon aria-hidden className="size-[18px]" strokeWidth={2} />
                  {entry.label}
                </button>
              ))}
            </div>
          </BottomSheet>
          <BottomSheet nested open={editing} onOpenChange={setEditing} title={`Precio en ${name}`}>
            <div className="flex items-baseline justify-between gap-3">
              <p className="font-display text-xl font-extrabold tracking-[-0.02em]">{name}</p>
              <button
                type="button"
                onClick={() => {
                  // Salir del campo lo guarda.
                  ;(document.activeElement as HTMLElement | null)?.blur()
                  setEditing(false)
                }}
                className="text-[15px] font-semibold text-primary outline-none hover:text-primary-hover focus-visible:underline"
              >
                Listo
              </button>
            </div>
            {editor}
          </BottomSheet>
        </>
      )}
    </li>
  )
}

function Offline({ children }: { children: ReactNode }) {
  return (
    <span className="flex min-w-0 items-center gap-1">
      <WifiOff aria-hidden className="size-3 shrink-0" strokeWidth={2.2} />
      <span className="truncate">{children}</span>
    </span>
  )
}
