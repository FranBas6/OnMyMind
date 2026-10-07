import { Link } from '@tanstack/react-router'

import { ResponsiveSheet } from '@/components/ResponsiveSheet'
import { type PriceDrop, usePriceDrops } from '@/features/prices'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import { formatCents } from '@/lib/money'

import { usePhotoSrc } from '../hooks/usePhoto'

/**
 * «Bajaron esta mañana» (diseño 22, N3): la hoja que abre el aviso de varias bajadas a la vez
 * (`/?bajadas=hoy`). Una fila por compra, con su lista y su tienda, el precio de ahora y lo que bajó;
 * tocarla abre su ficha. En escritorio, el diálogo de 440 px.
 */
export function PriceDropsSheet({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const isDesktop = useMediaQuery('(min-width: 768px)')
  const drops = usePriceDrops(open)

  const done = (
    <button
      type="button"
      onClick={() => {
        onOpenChange(false)
      }}
      className="rounded-md font-display text-base font-bold text-primary outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
    >
      Listo
    </button>
  )

  return (
    <ResponsiveSheet
      open={open}
      onOpenChange={onOpenChange}
      isDesktop={isDesktop}
      title="Bajaron esta mañana"
      headerAction={done}
    >
      <p className="-mt-2 text-[14px] text-muted-foreground">
        Las compras en las que pediste «Avisarme si baja».
      </p>
      {drops.isError && (
        <p role="alert" className="text-[14px] text-muted-foreground">
          No hemos podido cargarlas. Prueba otra vez en un momento.
        </p>
      )}
      {drops.data?.length === 0 && (
        <p className="text-[14px] text-muted-foreground">
          Ya no queda ninguna: han vuelto a subir o ya las compraste.
        </p>
      )}
      {drops.data && drops.data.length > 0 && (
        <ul className="flex flex-col gap-2">
          {drops.data.map((drop) => (
            <li key={drop.itemId}>
              <DropRow
                drop={drop}
                onOpen={() => {
                  onOpenChange(false)
                }}
              />
            </li>
          ))}
        </ul>
      )}
    </ResponsiveSheet>
  )
}

function DropRow({ drop, onOpen }: { drop: PriceDrop; onOpen: () => void }) {
  const { src } = usePhotoSrc(drop, 'thumb')
  return (
    <Link
      to="/lists/$listId"
      params={{ listId: drop.listId }}
      search={{ item: drop.itemId }}
      onClick={onOpen}
      className="flex min-h-16 items-center gap-3 rounded-[18px] border border-border-soft bg-card px-4 py-3 outline-none hover:bg-fill/50 focus-visible:ring-[3px] focus-visible:ring-ring/50"
    >
      {(drop.imagePath ?? drop.imageUrl) && (
        <span aria-hidden className="block size-11 shrink-0 overflow-hidden rounded-[12px] bg-fill">
          {src && (
            <img
              src={src}
              alt=""
              loading="lazy"
              referrerPolicy="no-referrer"
              className="size-full object-cover"
            />
          )}
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-base font-medium">{drop.title}</span>
        <span className="block truncate text-[13px] text-muted-foreground">
          {[drop.listName, drop.store].filter(Boolean).join(' · ')}
        </span>
      </span>
      <span className="flex shrink-0 flex-col items-end">
        <span className="font-display text-base font-extrabold tracking-[-0.02em]">
          {formatCents(drop.priceCents, drop.currency)}
        </span>
        <span className="text-[12.5px] font-bold text-price-down">
          ↓ {formatCents(drop.previousPriceCents - drop.priceCents, drop.currency)}
        </span>
      </span>
    </Link>
  )
}
