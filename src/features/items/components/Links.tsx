import { ExternalLink, Link2, LoaderCircle, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'

import { cn } from '@/lib/utils'

import { useItemLinkMetadata } from '../hooks/useLinkMetadata'
import { linkDomain, linkPath, linkTitle } from '../links'
import { sameLink } from '../stores'
import type { Item, ItemLink, ItemLinkPatch } from '../types'
import { LinkInput } from './LinkInput'
import { LinkOptions, type LinkOption } from './LinkOptions'

interface LinksSectionProps {
  item: Item
  isDesktop: boolean
  online: boolean
  onAdd: (url: string) => void
  onUpdate: (linkId: string, patch: ItemLinkPatch) => void
  onRemove: (link: ItemLink) => void
}

/**
 * «Enlaces» (diseño 23, D11 y D13): con dos o más enlaces en algo que no es una compra, la fila del
 * enlace pasa a ser esta caja, como «Dónde comprarlo» pero sin precio. Una fila por enlace (título,
 * dominio y ↗) y «+ Otro enlace» al final. Tocar uno abre «Abrir en la web · Quitar enlace». Sin
 * red, lo pegado se guarda con su dominio y busca el título al volver.
 */
export function LinksSection({
  item,
  isDesktop,
  online,
  onAdd,
  onUpdate,
  onRemove,
}: LinksSectionProps) {
  const [adding, setAdding] = useState(false)
  const waiting = !online && item.links.some((link) => link.urlTitle === null)

  return (
    <section aria-label="Enlaces" className="flex flex-col gap-2">
      <h2 className="px-1 text-xs font-bold tracking-[0.06em] text-muted-foreground uppercase">
        Enlaces
      </h2>
      <ul className="overflow-hidden rounded-md border border-border-soft bg-background">
        {item.links.map((link) => (
          <LinkBoxRow
            key={link.id}
            item={item}
            link={link}
            isDesktop={isDesktop}
            online={online}
            onUpdate={(patch) => {
              onUpdate(link.id, patch)
            }}
            onRemove={() => {
              onRemove(link)
            }}
          />
        ))}
        <li className="border-t border-border-soft">
          {adding ? (
            <div className="p-2.5">
              <LinkInput
                validate={(url) =>
                  item.links.some((link) => sameLink(link.url, url)) ? 'Este enlace ya está.' : null
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
            <button
              type="button"
              onClick={() => {
                setAdding(true)
              }}
              className="flex h-12 w-full items-center gap-2.5 px-4 text-[15px] font-semibold text-primary outline-none hover:text-primary-hover focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:ring-inset"
            >
              <Plus aria-hidden className="size-[18px]" strokeWidth={2.4} />
              Otro enlace
            </button>
          )}
        </li>
      </ul>
      {/* D13: lo que sí se ha podido hacer sin red. */}
      {waiting && (
        <p className="px-1 text-[13.5px] leading-snug text-subtle-foreground">
          El enlace se ha guardado. Las fotos necesitan conexión para subirse.
        </p>
      )}
    </section>
  )
}

interface LinkBoxRowProps {
  item: Item
  link: ItemLink
  isDesktop: boolean
  online: boolean
  onUpdate: (patch: ItemLinkPatch) => void
  onRemove: () => void
}

/**
 * Un enlace (D11): el icono en `brand-tint`, el título de la página (o su dominio, si no lo da) y
 * el dominio debajo, y ↗. Mientras se busca el título, el dominio en gris y el círculo que gira;
 * sin red, «Buscará el título al volver la red» (D13).
 */
function LinkBoxRow({ item, link, isDesktop, online, onUpdate, onRemove }: LinkBoxRowProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const lookup = useItemLinkMetadata(link, item, onUpdate)
  const domain = linkDomain(link.url)
  const waiting = lookup.waiting || (!online && link.urlTitle === null)
  const pending = lookup.searching || waiting
  // Sin título (`''` es «la página no da título»), el dominio y, debajo, la ruta.
  const title = linkTitle(link) ?? domain
  const detail = lookup.searching
    ? 'Buscando título…'
    : waiting
      ? 'Buscará el título al volver la red'
      : link.urlTitle
        ? domain
        : linkPath(link.url)

  const options: LinkOption[] = [
    {
      id: 'open',
      label: 'Abrir en la web',
      icon: ExternalLink,
      run: () => window.open(link.url, '_blank', 'noopener,noreferrer'),
    },
    { id: 'remove', label: 'Quitar enlace', icon: Trash2, run: onRemove, destructive: true },
  ]

  return (
    <li className="relative flex min-h-15 items-center gap-3 py-2 pr-1.5 pl-3.5 not-first:before:absolute not-first:before:top-0 not-first:before:right-0 not-first:before:left-[62px] not-first:before:h-px not-first:before:bg-border-soft">
      <LinkOptions
        name={title}
        summary={domain}
        options={options}
        isDesktop={isDesktop}
        open={menuOpen}
        onOpenChange={setMenuOpen}
      />
      <span className="grid size-9 shrink-0 place-items-center rounded-[10px] bg-brand-tint text-primary">
        {pending ? (
          <LoaderCircle
            aria-hidden
            className={cn('size-4', lookup.searching && 'animate-spin')}
            strokeWidth={2.4}
          />
        ) : (
          <Link2 aria-hidden className="size-4" strokeWidth={2.2} />
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span
          className={cn(
            'block truncate text-[15px] font-semibold',
            pending ? 'text-muted-foreground' : 'text-foreground',
          )}
        >
          {title}
        </span>
        <span className="block truncate text-[12.5px] text-muted-foreground">{detail}</span>
      </span>
      <a
        href={link.url}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`Abrir ${domain}`}
        className="relative z-10 grid h-11 w-10 shrink-0 place-items-center rounded-[10px] text-muted-foreground outline-none hover:bg-fill hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"
      >
        <ExternalLink aria-hidden className="size-[15px]" strokeWidth={2.2} />
      </a>
    </li>
  )
}
